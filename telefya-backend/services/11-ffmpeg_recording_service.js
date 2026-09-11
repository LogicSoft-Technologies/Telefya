const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const dgram = require("dgram");
const { spawn } = require("child_process");
const crypto = require("crypto");
const {
  get_latest_recording_chat_events_service,
} = require("./15-recording-event_service");
const {
  notify_recording_ready,
} = require("./20-push-notification_service");

const RECORDINGS_DIR = process.env.RECORDINGS_DIR
  ? path.resolve(process.env.RECORDINGS_DIR)
  : path.join(process.cwd(), "recordings");

const RECORDING_RETENTION_DAYS = Number(
  process.env.RECORDING_RETENTION_DAYS || 30,
);

// A nine-tile gallery is deliberately the highest server-side composite size.
// Larger rooms are recorded as roster-aware segments rather than opening an
// unbounded number of RTP decoders in one FFmpeg process.
const MAX_RECORDING_VIDEO_STREAMS = Math.min(
  Math.max(Number(process.env.MAX_RECORDING_VIDEO_STREAMS || 9), 1),
  9,
);

const MAX_RECORDING_AUDIO_STREAMS = Math.min(
  Math.max(Number(process.env.MAX_RECORDING_AUDIO_STREAMS || 16), 1),
  24,
);

const ROTATION_DEBOUNCE_MS = Math.max(
  Number(process.env.RECORDING_ROTATION_DEBOUNCE_MS || 2500),
  750,
);

const RECORDING_FPS = Math.min(
  Math.max(Number(process.env.RECORDING_FPS || 24), 15),
  30,
);

const RTP_INPUT_BUFFER_SIZE = Math.min(
  Math.max(Number(process.env.RECORDING_RTP_INPUT_BUFFER_SIZE || 16777216), 1048576),
  33554432,
);

const RTP_REORDER_QUEUE_SIZE = Math.min(
  Math.max(Number(process.env.RECORDING_RTP_REORDER_QUEUE_SIZE || 1024), 128),
  4096,
);

const RTP_MAX_DELAY_US = Math.min(
  Math.max(Number(process.env.RECORDING_RTP_MAX_DELAY_US || 2500000), 500000),
  10000000,
);

const activeRecordings = new Map();

async function ensureDir(directory) {
  await fsp.mkdir(directory, { recursive: true });
}

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex");
}

function safeRoomTitle(roomId) {
  return `Telefya recording - ${roomId}`;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForStableFile(filePath, attempts = 8, pauseMs = 150) {
  let previousSize = -1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!fs.existsSync(filePath)) {
      await sleep(pauseMs);
      continue;
    }

    const { size } = await fsp.stat(filePath);
    if (size > 0 && size === previousSize) return size;
    previousSize = size;
    await sleep(pauseMs);
  }

  return previousSize > 0 ? previousSize : 0;
}

async function probeRecordingFile(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.FFPROBE_PATH || "ffprobe", [
      "-v", "error",
      "-count_frames",
      "-show_entries", "format=format_name,duration",
      "-show_entries", "stream=codec_type,codec_name,width,height,nb_read_frames,avg_frame_rate",
      "-of", "json",
      filePath,
    ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`FFprobe rejected recording: ${stderr.trim()}`));
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const videoStream = data.streams?.find((stream) => stream.codec_type === "video");
        const hasVideo = Boolean(videoStream);
        const isMp4 = String(data.format?.format_name || "").includes("mp4");
        if (!hasVideo || !isMp4) {
          reject(new Error("FFprobe did not find a playable MP4 video stream."));
          return;
        }

        const duration = Number(data.format?.duration || 0);
        const frameCount = Number(videoStream.nb_read_frames || 0);
        const minimumExpectedFrames = Math.max(
          3,
          Math.floor(duration * Math.max(2, RECORDING_FPS * 0.1)),
        );

        if (!Number.isFinite(frameCount) || frameCount < minimumExpectedFrames) {
          reject(
            new Error(
              `Recording video was incomplete (${frameCount || 0} frames for ${duration.toFixed(1)} seconds).`,
            ),
          );
          return;
        }
        resolve(data);
      } catch (error) {
        reject(new Error(`Could not parse FFprobe output: ${error.message}`));
      }
    });
  });
}

function resolveWatermarkPath() {
  const configured = String(process.env.RECORDING_WATERMARK_PATH || "").trim();

  const candidates = [
    configured,
    path.resolve(process.cwd(), "../telefya-web/public/images/telefya-logo.png"),
    path.resolve(process.cwd(), "../telefya-web/public/images/telefya-logo.svg"),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function resolveRecorderFontPath() {
  const configured = String(process.env.RECORDING_FONT_PATH || "").trim();

  const candidates = [
    configured,
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function getFreeUdpPort() {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.once("error", reject);
    socket.bind(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

function getCodec(consumer) {
  const codec =
    consumer.rtpParameters.codecs.find(
      (item) => !String(item.mimeType || "").toLowerCase().includes("rtx"),
    ) || consumer.rtpParameters.codecs[0];

  if (!codec) {
    throw new Error(`No supported codec was available for ${consumer.kind}.`);
  }

  return {
    payloadType: codec.payloadType,
    mimeType: codec.mimeType,
    clockRate: codec.clockRate,
    channels: codec.channels,
    parameters: codec.parameters || {},
  };
}

function getCodecName(codec) {
  const codecName = String(codec.mimeType || "").split("/")[1] || "";
  if (codecName.toLowerCase() === "opus") return "opus";
  if (codecName.toLowerCase() === "vp8") return "VP8";
  if (codecName.toLowerCase() === "vp9") return "VP9";
  if (codecName.toLowerCase() === "h264") return "H264";
  return codecName;
}

function buildFmtp(parameters = {}) {
  return Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(";");
}

function buildSdp(streams, title) {
  const lines = [
    "v=0",
    "o=- 0 0 IN IP4 127.0.0.1",
    `s=${title}`,
    "c=IN IP4 127.0.0.1",
    "t=0 0",
    "a=tool:Telefya Recorder",
  ];

  streams.forEach((stream, index) => {
    const codecName = getCodecName(stream.codec);
    lines.push(`m=${stream.kind} ${stream.port} RTP/AVP ${stream.codec.payloadType}`);
    lines.push(`a=mid:${stream.kind}-${index}`);
    lines.push("a=recvonly");
    lines.push("a=rtcp-mux");
    lines.push(`a=rtcp:${stream.port} IN IP4 127.0.0.1`);

    if (stream.kind === "audio") {
      lines.push(
        `a=rtpmap:${stream.codec.payloadType} ${codecName}/${stream.codec.clockRate}/${stream.codec.channels || 2}`,
      );
    } else {
      lines.push(`a=rtpmap:${stream.codec.payloadType} ${codecName}/${stream.codec.clockRate}`);
      lines.push("a=framerate:30");
    }

    const fmtp = buildFmtp(stream.codec.parameters);
    if (fmtp) lines.push(`a=fmtp:${stream.codec.payloadType} ${fmtp}`);
  });

  return `${lines.join("\r\n")}\r\n`;
}

function escapeFilterPath(value) {
  return String(value)
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function escapeDrawText(value) {
  return String(value || "Participant")
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/%/g, "\\%");
}

function activityLabel(event) {
  if (event.event_type === "chat_message") {
    return `${event.actor_name || "Participant"}\n${event.message || ""}`;
  }

  return event.message || "Meeting activity";
}

async function writeRecordingActivityOverlay(dbQuery, active) {
  const events = await get_latest_recording_chat_events_service(
    dbQuery,
    active.recordingId,
    5,
  );

  const lines = events.flatMap((event) => {
    const text = activityLabel(event)
      .replace(/\r?\n/g, "\n")
      .replace(/[^\S\r\n]+/g, " ")
      .trim();

    return text ? text.split("\n").slice(0, 2) : [];
  });

  const output = lines.length
    ? lines.join("\n").slice(0, 850)
    : "Meeting chat and activity\nwill appear here.";

  if (active.currentSegment?.activityOverlayPath) {
    await fsp.writeFile(active.currentSegment.activityOverlayPath, output, "utf8");
  }
}

function getGalleryLayout(count, width, height) {
  const even = (value) => Math.max(2, Math.floor(value / 2) * 2);
  if (count <= 1) return { columns: 1, rows: 1, width: even(width), height: even(height) };
  if (count === 2) return { columns: 2, rows: 1, width: even(width / 2), height: even(height) };
  if (count <= 4) return { columns: 2, rows: 2, width: even(width / 2), height: even(height / 2) };
  if (count <= 6) return { columns: 3, rows: 2, width: even(width / 3), height: even(height / 2) };
  return { columns: 3, rows: 3, width: even(width / 3), height: even(height / 3) };
}

function buildGalleryFilter({ videoCount, videoSources, stageWidth, stageHeight, fontFile }) {
  if (videoCount <= 0) {
    return { filters: [`color=c=0x0a1636:s=${stageWidth}x${stageHeight}:r=${RECORDING_FPS}[stage]`], output: "[stage]" };
  }

  const gallery = getGalleryLayout(videoCount, stageWidth, stageHeight);
  const filters = [`color=c=0x0a1636:s=${stageWidth}x${stageHeight}:r=${RECORDING_FPS}[gallerybase]`];
  let output = "[gallerybase]";

  for (let index = 0; index < videoCount; index += 1) {
    const col = index % gallery.columns;
    const row = Math.floor(index / gallery.columns);
    const x = col * gallery.width;
    const y = row * gallery.height;
    const label = escapeDrawText(videoSources[index]?.userName || "Participant");
    const inset = videoCount === 1 ? 0 : 3;
    const tileWidth = gallery.width - inset * 2;
    const tileHeight = gallery.height - inset * 2;
    const tileLabelSize = videoCount >= 7 ? 12 : videoCount >= 5 ? 14 : 16;

    filters.push(
      `[0:v:${index}]setpts=PTS-STARTPTS,fps=${RECORDING_FPS},scale=${tileWidth}:${tileHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${tileWidth}:${tileHeight}:(ow-iw)/2:(oh-ih)/2:color=0x111c38,drawtext=fontfile='${fontFile}':text='${label}':fontcolor=white:fontsize=${tileLabelSize}:x=14:y=h-34:box=1:boxcolor=0x000000@0.52:boxborderw=8[tile${index}]`,
    );
    filters.push(`${output}[tile${index}]overlay=${x + inset}:${y + inset}[gallery${index}]`);
    output = `[gallery${index}]`;
  }

  filters.push(`${output}copy[stage]`);
  return { filters, output: "[stage]" };
}

function buildRecordingFilter({
  audioCount,
  videoCount,
  videoSources,
  recordingLayout,
  hasWatermark,
  activityOverlayPath,
  fontPath,
}) {
  const filters = [];
  const isMobile = recordingLayout === "mobile";
  const canvasWidth = isMobile ? 720 : 1280;
  const canvasHeight = isMobile ? 1280 : 720;
  const headerHeight = isMobile ? 82 : 68;
  const stageX = isMobile ? 14 : 18;
  const stageY = isMobile ? 98 : 84;
  const stageWidth = isMobile ? 692 : 878;
  const stageHeight = isMobile ? 710 : 534;
  const chatX = isMobile ? 14 : 916;
  const chatY = isMobile ? 832 : 84;
  const chatWidth = isMobile ? 692 : 346;
  const chatHeight = isMobile ? 272 : 534;
  const footerY = isMobile ? 1134 : 630;
  const activityPath = escapeFilterPath(activityOverlayPath);
  const fontFile = escapeFilterPath(fontPath);
  const controlY = isMobile ? 1182 : 657;
  const controlWidth = isMobile ? 96 : 94;
  const controlHeight = 40;
  const controlGap = isMobile ? 12 : 16;
  const controls = ["Mute", "Camera", "Share", "People", "More", "Leave"];
  const controlStartX = isMobile ? 22 : 330;

  const gallery = buildGalleryFilter({
    videoCount,
    videoSources,
    stageWidth,
    stageHeight,
    fontFile,
  });
  filters.push(...gallery.filters);
  filters.push(`color=c=0x050b1f:s=${canvasWidth}x${canvasHeight}:r=${RECORDING_FPS}[base]`);
  filters.push(`[base]${gallery.output}overlay=${stageX}:${stageY}[scene0]`);
  filters.push(`[scene0]drawbox=x=0:y=0:w=${canvasWidth}:h=${headerHeight}:color=0x071633:t=fill[scene1]`);
  filters.push(`[scene1]drawbox=x=${chatX}:y=${chatY}:w=${chatWidth}:h=${chatHeight}:color=0x0c1734:t=fill[scene2]`);
  filters.push(`[scene2]drawbox=x=${chatX + 18}:y=${chatY + 58}:w=${chatWidth - 36}:h=1:color=0xffffff@0.14:t=fill[scene3]`);
  filters.push(`[scene3]drawbox=x=0:y=${footerY}:w=${canvasWidth}:h=${canvasHeight - footerY}:color=0x071633:t=fill[scene4]`);
  filters.push(`[scene4]drawbox=x=20:y=${isMobile ? 24 : 17}:w=10:h=10:color=0xef4444:t=fill[scene5]`);
  filters.push(`[scene5]drawtext=fontfile='${fontFile}':text='Recording in progress':fontcolor=white:fontsize=${isMobile ? 20 : 18}:x=40:y=${isMobile ? 21 : 15}[scene6]`);
  filters.push(`[scene6]drawtext=fontfile='${fontFile}':text='${videoCount} video feed${videoCount === 1 ? "" : "s"}':fontcolor=0xb9c6e5:fontsize=${isMobile ? 14 : 13}:x=40:y=${isMobile ? 49 : 41}[scene7]`);
  filters.push(`[scene7]drawbox=x=${canvasWidth - 82}:y=${isMobile ? 22 : 17}:w=62:h=28:color=0xef4444:t=fill[scene8]`);
  filters.push(`[scene8]drawtext=fontfile='${fontFile}':text='REC':fontcolor=white:fontsize=12:x=${canvasWidth - 66}:y=${isMobile ? 29 : 24}[scene9]`);
  filters.push(`[scene9]drawtext=fontfile='${fontFile}':text='Chat & activity':fontcolor=white:fontsize=${isMobile ? 18 : 17}:x=${chatX + 18}:y=${chatY + 20}[scene10]`);
  filters.push(`[scene10]drawtext=fontfile='${fontFile}':text='Meeting updates':fontcolor=0x8fa5cc:fontsize=${isMobile ? 13 : 12}:x=${chatX + 18}:y=${chatY + 45}[scene11]`);
  filters.push(`[scene11]drawtext=fontfile='${fontFile}':textfile='${activityPath}':reload=60:fontcolor=0xdbeafe:fontsize=${isMobile ? 15 : 14}:line_spacing=${isMobile ? 12 : 10}:x=${chatX + 18}:y=${chatY + 82}[scene12]`);

  let scene = "[scene12]";
  controls.forEach((label, index) => {
    const x = controlStartX + index * (controlWidth + controlGap);
    const color = label === "Leave" ? "0x9f1239" : "0x132449";
    const next = `[control${index}]`;
    filters.push(`${scene}drawbox=x=${x}:y=${controlY}:w=${controlWidth}:h=${controlHeight}:color=${color}:t=fill${next}`);
    scene = next;
  });

  controls.forEach((label, index) => {
    const x = controlStartX + index * (controlWidth + controlGap);
    const next = `[label${index}]`;
    const textX = x + Math.max(10, Math.floor((controlWidth - label.length * (isMobile ? 7 : 6)) / 2));
    filters.push(`${scene}drawtext=fontfile='${fontFile}':text='${label}':fontcolor=white:fontsize=${isMobile ? 13 : 12}:x=${textX}:y=${controlY + 13}${next}`);
    scene = next;
  });

  let videoOutput = scene;
  if (hasWatermark) {
    filters.push("[1:v]scale=112:-1:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=0.72[telefya_logo]");
    filters.push(`${videoOutput}[telefya_logo]overlay=${isMobile ? "W-w-22:H-h-164" : "W-w-22:H-h-118"}:format=auto[vout]`);
    videoOutput = "[vout]";
  }

  let audioOutput = null;
  if (audioCount > 0) {
    const audioInputs = Array.from({ length: audioCount }, (_, index) => `[0:a:${index}]`).join("");
    filters.push(`${audioInputs}amix=inputs=${audioCount}:duration=longest:dropout_transition=2:normalize=0,aresample=async=1:first_pts=0[aout]`);
    audioOutput = "[aout]";
  }

  return { filterComplex: filters.join(";"), videoOutput, audioOutput };
}

function buildFfmpegArgs({ sdpPath, outputPath, audioCount, videoCount, videoSources, recordingLayout, watermarkPath, activityOverlayPath, fontPath }) {
  const hasWatermark = Boolean(watermarkPath);
  const args = [
    "-y", "-hide_banner", "-loglevel", "warning",
    "-protocol_whitelist", "file,udp,rtp",
    "-thread_queue_size", "8192",
    "-fflags", "+genpts+igndts+discardcorrupt",
    "-analyzeduration", "15000000",
    "-probesize", "10000000",
    "-reorder_queue_size", String(RTP_REORDER_QUEUE_SIZE),
    "-buffer_size", String(RTP_INPUT_BUFFER_SIZE),
    "-max_delay", String(RTP_MAX_DELAY_US),
    "-f", "sdp", "-i", sdpPath,
  ];

  if (hasWatermark) args.push("-loop", "1", "-framerate", String(RECORDING_FPS), "-i", watermarkPath);

  const filter = buildRecordingFilter({ audioCount, videoCount, videoSources, recordingLayout, hasWatermark, activityOverlayPath, fontPath });
  args.push("-filter_complex", filter.filterComplex, "-map", filter.videoOutput);
  if (filter.audioOutput) args.push("-map", filter.audioOutput);

  args.push(
    "-fps_mode", "cfr", "-r", String(RECORDING_FPS),
    "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency",
    "-profile:v", "main", "-level", "4.1", "-pix_fmt", "yuv420p",
    "-crf", "25", "-maxrate", "2500k", "-bufsize", "5000k", "-g", String(RECORDING_FPS * 2),
  );

  if (audioCount > 0) {
    args.push("-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2");
  } else {
    args.push("-an");
  }

  args.push("-max_muxing_queue_size", "4096", "-movflags", "+faststart", "-metadata", "title=Telefya Recording", "-metadata", "comment=Recorded by Telefya", outputPath);
  return args;
}

async function prepareVideoConsumer(consumer) {
  if (consumer.kind !== "video") return;
  try {
    if (typeof consumer.setPreferredLayers === "function") {
      await consumer.setPreferredLayers({ spatialLayer: 0, temporalLayer: 0 });
    }
  } catch (error) {
    console.warn("[Recording] Could not set preferred video layer:", error.message);
  }
}

function chooseRecordingProducers(producerInfos, hostUserId) {
  const valid = (Array.isArray(producerInfos) ? producerInfos : []).filter((item) => item?.producer?.id);
  const audioProducers = valid.filter((item) => item.kind === "audio").slice(0, MAX_RECORDING_AUDIO_STREAMS);
  const videos = valid.filter((item) => item.kind === "video");
  const screen = videos.find((item) => item.userData?.isScreen || item.userData?.appData?.isScreen);
  const hostVideo = videos.find((item) => item.userData?.userId === hostUserId);
  const seen = new Set();
  const selectedVideos = [screen, hostVideo, ...videos].filter((item) => {
    const id = item?.producer?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, MAX_RECORDING_VIDEO_STREAMS);

  return { selected: [...audioProducers, ...selectedVideos], audio: audioProducers, videos: selectedVideos };
}

async function closeItems(items) {
  for (const item of items || []) {
    try { if (item && !item.closed) item.close(); } catch {}
  }
}

async function requestVideoKeyFrames(consumers) {
  const videos = consumers.filter((consumer) => consumer.kind === "video");
  for (let attempt = 0; attempt < 7; attempt += 1) {
    for (const consumer of videos) {
      try { await consumer.requestKeyFrame(); } catch {}
    }
    await sleep(350);
  }
}

async function markRecordingFailed(dbQuery, recordingId, message) {
  await dbQuery(`UPDATE meeting_recordings SET status = 'failed', stopped_at = NOW() WHERE recording_id = ?`, [recordingId]);
  console.error(`[Recording ${recordingId}] ${message}`);
}

async function createSegment(active) {
  const { mediaSoupService, roomId, hostUserId, recordingLayout } = active;
  const router = mediaSoupService.getRouter(roomId);
  const snapshot = chooseRecordingProducers(mediaSoupService.getRoomProducerInfos(roomId), hostUserId);

  if (!snapshot.selected.length) {
    throw new Error("No media producers are available for the next recording segment.");
  }

  const segmentNumber = active.segments.length + 1;
  const baseName = `${active.recordingId}-segment-${String(segmentNumber).padStart(4, "0")}`;
  const segment = {
    number: segmentNumber,
    outputPath: path.join(RECORDINGS_DIR, `${baseName}.mp4`),
    sdpPath: path.join(os.tmpdir(), `${baseName}.sdp`),
    activityOverlayPath: path.join(os.tmpdir(), `${baseName}-activity.txt`),
    transports: [],
    consumers: [],
    done: null,
    settled: false,
    expectedStop: false,
  };

  const sdpStreams = [];
  try {
    for (const info of snapshot.selected) {
      const port = await getFreeUdpPort();
      const transport = await mediaSoupService.createRecordingPlainTransport(roomId);
      await transport.connect({ ip: "127.0.0.1", port });
      const consumer = await transport.consume({ producerId: info.producer.id, rtpCapabilities: router.rtpCapabilities, paused: true });
      await prepareVideoConsumer(consumer);
      segment.transports.push(transport);
      segment.consumers.push(consumer);
      sdpStreams.push({ kind: consumer.kind, port, codec: getCodec(consumer) });
    }

    await fsp.writeFile(segment.sdpPath, buildSdp(sdpStreams, safeRoomTitle(roomId)));
    await fsp.writeFile(segment.activityOverlayPath, "Meeting chat and activity\nwill appear here.", "utf8");

    const fontPath = resolveRecorderFontPath();
    if (!fontPath) throw new Error("No recording font was found. Set RECORDING_FONT_PATH in the backend .env.");

    const ffmpegArgs = buildFfmpegArgs({
      sdpPath: segment.sdpPath,
      outputPath: segment.outputPath,
      audioCount: snapshot.audio.length,
      videoCount: snapshot.videos.length,
      videoSources: snapshot.videos.map((item) => item.userData || {}),
      recordingLayout,
      watermarkPath: resolveWatermarkPath(),
      activityOverlayPath: segment.activityOverlayPath,
      fontPath,
    });

    console.log(`[Recording ${active.recordingId}] Starting segment ${segmentNumber}`, {
      roomId,
      audioCount: snapshot.audio.length,
      videoCount: snapshot.videos.length,
      participants: snapshot.videos.map((item) => item.userData?.userName || "Participant"),
    });

    segment.ffmpeg = spawn(process.env.FFMPEG_PATH || "ffmpeg", ffmpegArgs, {
      windowsHide: true,
      stdio: ["pipe", "ignore", "pipe"],
    });

    let stderr = "";
    segment.done = new Promise((resolve, reject) => {
      const finish = async (code, signal, launchError) => {
        if (segment.settled) return;
        segment.settled = true;
        await closeItems(segment.consumers);
        await closeItems(segment.transports);
        try { await fsp.unlink(segment.sdpPath); } catch {}
        try { await fsp.unlink(segment.activityOverlayPath); } catch {}

        const size = await waitForStableFile(segment.outputPath);
        const usable = size > 50 * 1024;
        const stoppedCleanly =
          code === 0 ||
          code === 255 ||
          signal === "SIGINT";

        if (launchError || !usable || !stoppedCleanly) {
          const error = new Error(
            launchError?.message ||
              `Segment ${segmentNumber} did not finalize cleanly (exit=${code}, signal=${signal || "none"}). ${stderr.slice(-1200)}`,
          );
          if (!segment.expectedStop) active.unexpectedError = error;
          segment.error = error;
          resolve({ code, signal, size, error });
          return;
        }

        active.segments.push(segment.outputPath);
        resolve({ code, signal, size });
      };

      segment.ffmpeg.once("error", (error) => finish(null, null, error).catch(reject));
      segment.ffmpeg.once("close", (code, signal) => finish(code, signal).catch(reject));
    });

    segment.ffmpeg.stderr.on("data", (data) => {
      const text = data.toString();
      stderr = `${stderr}${text}`.slice(-4000);
      if (text.includes("Error") || text.includes("RTP:")) {
        console.log(`[Recording ${active.recordingId}] ${text.trim()}`);
      }
    });

    active.currentSegment = segment;
    await sleep(350);
    if (segment.error) throw segment.error;
    for (const consumer of segment.consumers) await consumer.resume();
    await requestVideoKeyFrames(segment.consumers);
    await sleep(300);
    if (segment.error) throw segment.error;
    return segment;
  } catch (error) {
    await closeItems(segment.consumers);
    await closeItems(segment.transports);
    try { await fsp.unlink(segment.sdpPath); } catch {}
    try { await fsp.unlink(segment.activityOverlayPath); } catch {}
    throw error;
  }
}

async function stopCurrentSegment(active) {
  const segment = active.currentSegment;
  if (!segment) return null;
  segment.expectedStop = true;

  try {
    if (segment.ffmpeg.stdin && !segment.ffmpeg.stdin.destroyed) {
      segment.ffmpeg.stdin.write("q\n");
    } else {
      segment.ffmpeg.kill("SIGINT");
    }
  } catch {
    try { segment.ffmpeg.kill("SIGINT"); } catch {}
  }

  const result = await segment.done;
  active.currentSegment = null;
  if (result?.error) throw result.error;
  return result;
}

async function mergeSegments(active) {
  if (active.segments.length === 0) throw new Error("No recording segments were produced.");
  const listPath = path.join(os.tmpdir(), `${active.recordingId}-concat.txt`);
  const contents = active.segments
    .map((file) => `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fsp.writeFile(listPath, contents, "utf8");

  await new Promise((resolve, reject) => {
    const child = spawn(process.env.FFMPEG_PATH || "ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "warning",
      "-f", "concat", "-safe", "0", "-i", listPath,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
      active.outputPath,
    ], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });

    let stderr = "";
    child.stderr.on("data", (data) => { stderr = `${stderr}${data}`.slice(-3000); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Recording merge failed: ${stderr}`)));
  });

  try { await fsp.unlink(listPath); } catch {}
}

async function cleanActiveFiles(active) {
  if (active.rotationTimer) clearTimeout(active.rotationTimer);
  if (active.activityOverlayTimer) clearInterval(active.activityOverlayTimer);
  for (const file of active.segments) {
    try { await fsp.unlink(file); } catch {}
  }
}

async function start_ffmpeg_recording_service({ db_query, mediaSoupService, roomId, hostUserId, recordingLayout = "desktop" }) {
  if (!roomId) return { success: false, error: true, message: "roomId is required to start recording." };
  if (activeRecordings.has(roomId)) return { success: false, error: true, message: "This room is already being recorded." };
  if (!mediaSoupService.getRouter(roomId)) return { success: false, error: true, message: "Meeting media router is not available." };

  await ensureDir(RECORDINGS_DIR);
  const recordingId = createId();
  const fileName = `${recordingId}.mp4`;
  const active = {
    recordingId,
    roomId,
    hostUserId,
    recordingLayout: recordingLayout === "mobile" ? "mobile" : "desktop",
    mediaSoupService,
    outputPath: path.join(RECORDINGS_DIR, fileName),
    fileName,
    startedAt: new Date(),
    segments: [],
    currentSegment: null,
    rotationTimer: null,
    activityOverlayTimer: null,
    rotating: false,
    stopping: false,
    unexpectedError: null,
  };

  await db_query(`
    INSERT INTO meeting_recordings
    (recording_id, room_id, host_user_id, status, file_name, file_path, mime_type, started_at, expires_at)
    VALUES (?, ?, ?, 'recording', ?, ?, 'video/mp4', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))
  `, [recordingId, roomId, hostUserId || null, fileName, active.outputPath, RECORDING_RETENTION_DAYS]);

  activeRecordings.set(roomId, active);
  try {
    await createSegment(active);
    active.activityOverlayTimer = setInterval(() => {
      writeRecordingActivityOverlay(db_query, active).catch((error) => {
        console.warn(`[Recording ${recordingId}] Unable to refresh activity overlay:`, error.message);
      });
    }, 3000);
    await writeRecordingActivityOverlay(db_query, active);

    return {
      success: true,
      message: "Recording started.",
      data: { recordingId, roomId, fileName, mimeType: "video/mp4", startedAt: active.startedAt.toISOString(), layout: active.recordingLayout },
    };
  } catch (error) {
    activeRecordings.delete(roomId);
    await cleanActiveFiles(active);
    await markRecordingFailed(db_query, recordingId, error.message);
    return { success: false, error: true, message: error.message || "Unable to start recording." };
  }
}

async function rotateRecording(active, dbQuery, reason) {
  if (active.stopping || active.rotating) return;
  active.rotating = true;
  try {
    await stopCurrentSegment(active);
    await createSegment(active);
    console.log(`[Recording ${active.recordingId}] Rotated segment: ${reason}`);
  } catch (error) {
    active.unexpectedError = error;
    console.error(`[Recording ${active.recordingId}] Segment rotation failed:`, error.message);
  } finally {
    active.rotating = false;
  }
}

function schedule_ffmpeg_recording_rotation({ db_query, roomId, reason = "meeting roster changed" }) {
  const active = activeRecordings.get(roomId);
  if (!active || active.stopping) return false;
  if (active.rotationTimer) clearTimeout(active.rotationTimer);
  active.rotationTimer = setTimeout(() => {
    active.rotationTimer = null;
    rotateRecording(active, db_query, reason).catch((error) => {
      console.error(`[Recording ${active.recordingId}] Rotation error:`, error.message);
    });
  }, ROTATION_DEBOUNCE_MS);
  return true;
}

async function stop_ffmpeg_recording_service({ db_query, roomId }) {
  const active = activeRecordings.get(roomId);
  if (!active) return { success: false, error: true, message: "No active recording found for this room." };

  active.stopping = true;
  if (active.rotationTimer) clearTimeout(active.rotationTimer);
  if (active.activityOverlayTimer) {
    clearInterval(active.activityOverlayTimer);
    active.activityOverlayTimer = null;
  }
  await db_query(`UPDATE meeting_recordings SET status = 'processing', stopped_at = NOW() WHERE recording_id = ?`, [active.recordingId]);

  try {
    while (active.rotating) await sleep(100);
    await stopCurrentSegment(active);
    if (active.unexpectedError) throw active.unexpectedError;
    await mergeSegments(active);
    const fileSize = await waitForStableFile(active.outputPath);
    if (fileSize <= 50 * 1024) throw new Error("The final recording file was empty.");

    await probeRecordingFile(active.outputPath);

    const durationSeconds = Math.max(1, Math.round((Date.now() - active.startedAt.getTime()) / 1000));
    await db_query(`
      UPDATE meeting_recordings
      SET status = 'ready', stopped_at = NOW(), file_path = ?, file_name = ?, size_bytes = ?, duration_seconds = ?, expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
      WHERE recording_id = ?
    `, [active.outputPath, active.fileName, fileSize, durationSeconds, RECORDING_RETENTION_DAYS, active.recordingId]);
    void notify_recording_ready({
      hostUserId: active.hostUserId,
      recordingId: active.recordingId,
      roomId,
      title: active.fileName,
    }).catch((error) => {
      console.warn(
        "[push] Recording-ready notification failed:",
        error.message,
      );
    });

    console.log(`[Recording ${active.recordingId}] Ready`, { roomId, fileName: active.fileName, fileSize, durationSeconds, segments: active.segments.length });
    return { success: true, message: "Recording finalized.", data: { recordingId: active.recordingId, roomId, fileName: active.fileName, mimeType: "video/mp4" } };
  } catch (error) {
    await markRecordingFailed(db_query, active.recordingId, error.message);
    return { success: false, error: true, message: error.message || "Unable to finalize recording." };
  } finally {
    activeRecordings.delete(roomId);
    await cleanActiveFiles(active);
  }
}

async function cleanup_expired_recordings_service(dbQuery) {
  const rows = await dbQuery(`SELECT recording_id, file_path FROM meeting_recordings WHERE expires_at IS NOT NULL AND expires_at < NOW() AND status IN ('ready', 'failed', 'expired')`);
  for (const row of rows) {
    if (row.file_path && fs.existsSync(row.file_path)) {
      try { await fsp.unlink(row.file_path); } catch {}
    }
    await dbQuery(`UPDATE meeting_recordings SET status = 'deleted', file_path = NULL WHERE recording_id = ?`, [row.recording_id]);
  }
  return { success: true, message: "Expired recordings cleaned.", data: { deleted: rows.length } };
}

function getActiveRecording(roomId) {
  const active = activeRecordings.get(roomId);
  if (!active) return null;
  return { recordingId: active.recordingId, roomId, fileName: active.fileName, outputPath: active.outputPath, startedAt: active.startedAt };
}

module.exports = {
  start_ffmpeg_recording_service,
  stop_ffmpeg_recording_service,
  schedule_ffmpeg_recording_rotation,
  cleanup_expired_recordings_service,
  getActiveRecording,
};
