"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useMediasoupRoom } from "@/hooks/use-mediasoup-room";

declare global {
  interface Window {
    telefyaRecorderReady?: boolean;
    telefyaRecorderUploaded?: boolean;
    telefyaStartRecording?: () => Promise<void>;
    telefyaStopRecording?: () => Promise<void>;
  }
}

type ParticipantMeta = {
  userId?: string;
  id?: string;
  userName?: string;
  name?: string;
  micOn?: boolean;
  cameraOn?: boolean;
};

type RecorderStream = {
  id: string;
  userId?: string;
  userName?: string;
  kind: "audio" | "video";
  isScreen?: boolean;
  stream: MediaStream;
};

type VideoEntry = {
  id: string;
  userId?: string;
  name: string;
  isScreen?: boolean;
  micOn?: boolean;
  cameraOn?: boolean;
  video?: HTMLVideoElement;
};

type RecorderLayout = "desktop" | "mobile";

function normalizeParticipants(value: unknown): ParticipantMeta[] {
  if (Array.isArray(value)) return value as ParticipantMeta[];

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, ParticipantMeta>);
  }

  return [];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 12,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
) {
  if (ctx.measureText(value).width <= maxWidth) return value;

  let output = "";

  for (const character of value) {
    const candidate = `${output}${character}...`;

    if (ctx.measureText(candidate).width > maxWidth) break;

    output += character;
  }

  return output ? `${output}...` : "...";
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "T"
  );
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceWidth = video.videoWidth || 16;
  const sourceHeight = video.videoHeight || 9;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  }

  ctx.drawImage(video, sx, sy, sw, sh, x, y, width, height);
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, "#10295d");
  gradient.addColorStop(1, "#25125c");

  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  const size = Math.max(30, Math.min(width, height) * 0.24);

  ctx.beginPath();
  ctx.arc(x + width / 2, y + height / 2 - 8, size, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.max(15, size * 0.75)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials(name), x + width / 2, y + height / 2 - 7);
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  entry: VideoEntry,
  x: number,
  y: number,
  width: number,
  height: number,
  compact = false,
) {
  ctx.save();
  roundRect(ctx, x, y, width, height, compact ? 10 : 14);
  ctx.clip();

  const canDrawVideo =
    entry.video &&
    entry.video.readyState >= 2 &&
    entry.cameraOn !== false;

  if (canDrawVideo && entry.video) {
    drawCover(ctx, entry.video, x, y, width, height);
  } else {
    drawAvatar(ctx, entry.name, x, y, width, height);
  }

  const overlay = ctx.createLinearGradient(x, y + height * 0.55, x, y + height);
  overlay.addColorStop(0, "rgba(0,0,0,0)");
  overlay.addColorStop(1, "rgba(0,0,0,0.8)");
  ctx.fillStyle = overlay;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "rgba(7,22,51,0.82)";
  roundRect(ctx, x + 10, y + height - 39, Math.min(width - 20, 175), 28, 8);
  ctx.fill();

  ctx.fillStyle = entry.micOn === false ? "#ff8c96" : "#86efac";
  ctx.beginPath();
  ctx.arc(x + 24, y + height - 25, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${compact ? 11 : 13}px Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    truncateText(ctx, entry.name, Math.min(width - 58, 125)),
    x + 35,
    y + height - 25,
  );

  if (entry.cameraOn === false) {
    ctx.fillStyle = "rgba(7,22,51,0.88)";
    roundRect(ctx, x + width - 70, y + 10, 60, 24, 999);
    ctx.fill();
    ctx.fillStyle = "#dbeafe";
    ctx.font = "800 9px Arial";
    ctx.textAlign = "center";
    ctx.fillText("VIDEO OFF", x + width - 40, y + 22);
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, compact ? 10 : 14);
  ctx.stroke();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  width: number,
  people: number,
  layout: RecorderLayout,
) {
  ctx.fillStyle = "#071633";
  ctx.fillRect(0, 0, width, layout === "mobile" ? 82 : 68);

  if (logo?.complete) {
    const logoWidth = layout === "mobile" ? 116 : 132;
    const logoHeight = layout === "mobile" ? 35 : 40;
    ctx.drawImage(logo, 18, layout === "mobile" ? 22 : 14, logoWidth, logoHeight);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 24px Arial";
    ctx.fillText("Telefya", 20, 40);
  }

  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = "800 11px Arial";
  ctx.textAlign = "right";
  ctx.fillText(
    `${people} ${people === 1 ? "person" : "people"}`,
    width - 104,
    layout === "mobile" ? 41 : 35,
  );

  ctx.fillStyle = "#ef4444";
  roundRect(ctx, width - 80, layout === "mobile" ? 25 : 21, 60, 28, 999);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("REC", width - 50, layout === "mobile" ? 40 : 35);

  ctx.textAlign = "left";
}

function drawDesktopLayout(
  ctx: CanvasRenderingContext2D,
  entries: VideoEntry[],
  messages: Array<{ userName?: string; message?: string }>,
  logo: HTMLImageElement | null,
) {
  const width = 1280;
  const height = 720;
  const stageX = 16;
  const stageY = 82;
  const stageWidth = 910;
  const stageHeight = 534;
  const chatX = 942;
  const chatWidth = 322;

  ctx.fillStyle = "#050b1f";
  ctx.fillRect(0, 0, width, height);
  drawHeader(ctx, logo, width, entries.length, "desktop");

  ctx.fillStyle = "#071633";
  roundRect(ctx, stageX, stageY, stageWidth, stageHeight, 16);
  ctx.fill();

  const screen = entries.find((entry) => entry.isScreen);
  const people = entries.filter((entry) => entry.id !== screen?.id);

  if (screen) {
    drawTile(ctx, screen, stageX + 10, stageY + 10, 656, stageHeight - 20);

    people.slice(0, 4).forEach((person, index) => {
      drawTile(
        ctx,
        person,
        stageX + 678,
        stageY + 10 + index * 129,
        222,
        119,
        true,
      );
    });
  } else {
    const count = Math.max(people.length, 1);
    const columns = count <= 1 ? 1 : count <= 4 ? 2 : 3;
    const rows = Math.ceil(count / columns);
    const gap = 8;
    const tileWidth = (stageWidth - 20 - gap * (columns - 1)) / columns;
    const tileHeight = (stageHeight - 20 - gap * (rows - 1)) / rows;

    people.slice(0, 9).forEach((person, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);

      drawTile(
        ctx,
        person,
        stageX + 10 + column * (tileWidth + gap),
        stageY + 10 + row * (tileHeight + gap),
        tileWidth,
        tileHeight,
      );
    });
  }

  ctx.fillStyle = "#0c1734";
  roundRect(ctx, chatX, stageY, chatWidth, stageHeight, 16);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 18px Arial";
  ctx.fillText("Chat", chatX + 20, stageY + 34);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(chatX + 20, stageY + 52, chatWidth - 40, 1);

  const recentMessages = messages.slice(-5);
  let cursorY = stageY + 80;

  if (!recentMessages.length) {
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.font = "700 13px Arial";
    ctx.fillText("Meeting messages appear here.", chatX + 20, cursorY);
  }

  recentMessages.forEach((message) => {
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 12px Arial";
    ctx.fillText(
      truncateText(ctx, message.userName || "Participant", chatWidth - 40),
      chatX + 20,
      cursorY,
    );

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, chatX + 20, cursorY + 10, chatWidth - 40, 42, 9);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 11px Arial";
    ctx.fillText(
      truncateText(ctx, message.message || "", chatWidth - 62),
      chatX + 31,
      cursorY + 31,
    );

    cursorY += 71;
  });

  ctx.fillStyle = "#0c1734";
  ctx.fillRect(0, 628, width, 92);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(0, 628, width, 1);

  ["Mic", "Camera", "Share", "People", "More"].forEach((label, index) => {
    const x = 416 + index * 90;

    ctx.fillStyle = index === 4 ? "#2563eb" : "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(x, 665, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "800 10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, x, 705);
  });

  ctx.textAlign = "left";
}

function drawMobileLayout(
  ctx: CanvasRenderingContext2D,
  entries: VideoEntry[],
  messages: Array<{ userName?: string; message?: string }>,
  logo: HTMLImageElement | null,
) {
  const width = 720;
  const height = 1280;
  const top = 98;
  const bottomDock = 1122;

  ctx.fillStyle = "#050b1f";
  ctx.fillRect(0, 0, width, height);
  drawHeader(ctx, logo, width, entries.length, "mobile");

  const screen = entries.find((entry) => entry.isScreen);
  const people = entries.filter((entry) => entry.id !== screen?.id);

  if (screen) {
    drawTile(ctx, screen, 14, top, 692, 380);

    people.slice(0, 4).forEach((person, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);

      drawTile(
        ctx,
        person,
        14 + column * 348,
        494 + row * 222,
        344,
        208,
        true,
      );
    });
  } else {
    const visiblePeople = people.slice(0, 6);
    const count = Math.max(visiblePeople.length, 1);
    const columns = count <= 1 ? 1 : 2;
    const rows = Math.ceil(count / columns);
    const gap = 10;
    const availableHeight = 720;
    const tileWidth = (692 - gap * (columns - 1)) / columns;
    const tileHeight = (availableHeight - gap * (rows - 1)) / rows;

    visiblePeople.forEach((person, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);

      drawTile(
        ctx,
        person,
        14 + column * (tileWidth + gap),
        top + row * (tileHeight + gap),
        tileWidth,
        tileHeight,
      );
    });
  }

  ctx.fillStyle = "rgba(12,23,52,0.96)";
  roundRect(ctx, 14, 854, 692, 222, 16);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 16px Arial";
  ctx.fillText("Meeting chat", 34, 885);

  const recentMessages = messages.slice(-3);
  let cursorY = 915;

  if (!recentMessages.length) {
    ctx.fillStyle = "rgba(255,255,255,0.48)";
    ctx.font = "700 12px Arial";
    ctx.fillText("No messages yet.", 34, cursorY);
  }

  recentMessages.forEach((message) => {
    ctx.fillStyle = "#bfdbfe";
    ctx.font = "800 11px Arial";
    ctx.fillText(
      truncateText(ctx, message.userName || "Participant", 210),
      34,
      cursorY,
    );

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, 34, cursorY + 9, 650, 32, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.font = "600 11px Arial";
    ctx.fillText(
      truncateText(ctx, message.message || "", 625),
      47,
      cursorY + 30,
    );

    cursorY += 57;
  });

  ctx.fillStyle = "#071633";
  ctx.fillRect(0, bottomDock, width, height - bottomDock);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(0, bottomDock, width, 1);

  ["Mic", "Camera", "Share", "People", "More"].forEach((label, index) => {
    const x = 92 + index * 134;

    ctx.fillStyle = index === 4 ? "#2563eb" : "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(x, 1170, 31, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "800 10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, x, 1225);
  });

  ctx.textAlign = "left";
}

function drawWaitingSlate(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  layout: RecorderLayout,
) {
  const width = layout === "mobile" ? 720 : 1280;
  const height = layout === "mobile" ? 1280 : 720;

  ctx.fillStyle = "#050b1f";
  ctx.fillRect(0, 0, width, height);
  drawHeader(ctx, logo, width, 0, layout);

  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = `900 ${layout === "mobile" ? 24 : 30}px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("Preparing meeting recording", width / 2, height / 2 - 8);

  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.font = `700 ${layout === "mobile" ? 14 : 16}px Arial`;
  ctx.fillText(
    "Waiting for meeting audio and video...",
    width / 2,
    height / 2 + 28,
  );

  ctx.textAlign = "left";
}

export default function RecorderPage() {
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();

  const roomId = decodeURIComponent(params.roomId);
  const recordingId = searchParams.get("recordingId") || "";
  const secret = searchParams.get("secret") || "";
  const recordingLayout: RecorderLayout =
    searchParams.get("layout") === "mobile" ? "mobile" : "desktop";

  const logicalWidth = recordingLayout === "mobile" ? 720 : 1280;
  const logicalHeight = recordingLayout === "mobile" ? 1280 : 720;
  const renderScale = 1;
  const renderWidth = logicalWidth * renderScale;
  const renderHeight = logicalHeight * renderScale;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef =
    useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioSourcesRef = useRef<Map<string, MediaStreamAudioSourceNode>>(
    new Map(),
  );
  const silentOscillatorRef = useRef<OscillatorNode | null>(null);

  const room = useMediasoupRoom({
    enabled: Boolean(roomId && recordingId && secret),
    roomId,
    userId: `recorder-${recordingId}`,
    userName: "Telefya Recorder",
    isHost: false,
    recordingMode: true,
    recorderSecret: secret,
  });

  const videoStreams = useMemo(
    () =>
      room.remoteStreams.filter(
        (stream) => stream.kind === "video",
      ) as RecorderStream[],
    [room.remoteStreams],
  );

  const audioStreams = useMemo(
    () =>
      room.remoteStreams.filter(
        (stream) => stream.kind === "audio",
      ) as RecorderStream[],
    [room.remoteStreams],
  );

  const participants = normalizeParticipants((room as any).participants);

  const syncAudioSources = useCallback((streams: RecorderStream[]) => {
    const audioContext = audioContextRef.current;
    const destination = audioDestinationRef.current;

    if (!audioContext || !destination) return;

    for (const item of streams) {
      if (audioSourcesRef.current.has(item.id)) continue;

      if (!item.stream.getAudioTracks().some((track) => track.readyState === "live")) {
        continue;
      }

      const source = audioContext.createMediaStreamSource(item.stream);
      source.connect(destination);
      audioSourcesRef.current.set(item.id, source);
    }

    for (const [id, source] of audioSourcesRef.current) {
      if (!streams.some((stream) => stream.id === id)) {
        source.disconnect();
        audioSourcesRef.current.delete(id);
      }
    }
  }, []);

  useEffect(() => {
    const image = new Image();
    image.src = "/images/telefya-logo.png";
    image.onload = () => {
      logoRef.current = image;
    };
  }, []);

  useEffect(() => {
    syncAudioSources(audioStreams);
  }, [audioStreams, syncAudioSources]);

  useEffect(() => {
    for (const stream of videoStreams) {
      if (videosRef.current.has(stream.id)) continue;

      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream.stream;
      video.play().catch(() => undefined);

      videosRef.current.set(stream.id, video);
    }

    for (const [id, video] of videosRef.current) {
      if (!videoStreams.some((stream) => stream.id === id)) {
        video.pause();
        video.srcObject = null;
        videosRef.current.delete(id);
      }
    }
  }, [videoStreams]);

  useEffect(() => {
    let animation = 0;

    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");

      if (!canvas || !ctx) {
        animation = window.setTimeout(draw, 80) as unknown as number;
        return;
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(renderScale, renderScale);

      const participantById = new Map<string, ParticipantMeta>();

      for (const participant of participants) {
        const id = participant.userId || participant.id;
        if (id) participantById.set(String(id), participant);
      }

      const videoEntries: VideoEntry[] = videoStreams.map((stream) => {
        const participant = stream.userId
          ? participantById.get(String(stream.userId))
          : undefined;

        return {
          id: stream.id,
          userId: stream.userId,
          name: stream.isScreen
            ? `${stream.userName || participant?.userName || participant?.name || "Someone"} presenting`
            : stream.userName ||
              participant?.userName ||
              participant?.name ||
              "Participant",
          isScreen: stream.isScreen,
          micOn:
            typeof participant?.micOn === "boolean"
              ? participant.micOn
              : audioStreams.some((audio) => audio.userId === stream.userId),
          cameraOn:
            typeof participant?.cameraOn === "boolean"
              ? participant.cameraOn
              : true,
          video: videosRef.current.get(stream.id),
        };
      });

      const audioOnlyEntries = audioStreams
        .filter(
          (audio) =>
            !videoEntries.some((video) => video.userId === audio.userId),
        )
        .map((audio): VideoEntry => {
          const participant = audio.userId
            ? participantById.get(String(audio.userId))
            : undefined;

          return {
            id: audio.id,
            userId: audio.userId,
            name:
              audio.userName ||
              participant?.userName ||
              participant?.name ||
              "Participant",
            micOn:
              typeof participant?.micOn === "boolean"
                ? participant.micOn
                : true,
            cameraOn: false,
          };
        });

      const entries = [...videoEntries, ...audioOnlyEntries];

      if (!entries.length) {
        drawWaitingSlate(ctx, logoRef.current, recordingLayout);
      } else if (recordingLayout === "mobile") {
        drawMobileLayout(
          ctx,
          entries,
          room.messages || [],
          logoRef.current,
        );
      } else {
        drawDesktopLayout(
          ctx,
          entries,
          room.messages || [],
          logoRef.current,
        );
      }

      ctx.restore();
      animation = window.setTimeout(draw, 80) as unknown as number;
    };

    draw();

    return () => window.clearTimeout(animation);
  }, [
    audioStreams,
    participants,
    recordingLayout,
    renderScale,
    room.messages,
    videoStreams,
  ]);

  useEffect(() => {
    window.telefyaRecorderReady =
      Boolean(canvasRef.current) &&
      Boolean(roomId) &&
      Boolean(recordingId) &&
      Boolean(secret) &&
      typeof window.telefyaStartRecording === "function";

    return () => {
      window.telefyaRecorderReady = false;
    };
  }, [roomId, recordingId, secret, room.connected, room.remoteStreams.length]);

  useEffect(() => {
    window.telefyaStartRecording = async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Recorder canvas is not ready.");

      chunksRef.current = [];
      window.telefyaRecorderUploaded = false;

      const canvasStream = canvas.captureStream(12);
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();

      await audioContext.resume();

      const destination = audioContext.createMediaStreamDestination();
      audioContextRef.current = audioContext;
      audioDestinationRef.current = destination;

      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      const silentOscillator = audioContext.createOscillator();
      silentOscillator.connect(silentGain);
      silentGain.connect(destination);
      silentOscillator.start();

      silentOscillatorRef.current = silentOscillator;
      syncAudioSources(audioStreams);

      const mixedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported(
        "video/webm;codecs=vp8,opus",
      )
        ? "video/webm;codecs=vp8,opus"
        : "video/webm";

      const recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: recordingLayout === "mobile" ? 1_500_000 : 2_000_000,
        audioBitsPerSecond: 96_000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(1000);
      recorderRef.current = recorder;
    };

    window.telefyaStopRecording = async () => {
      const recorder = recorderRef.current;

      if (!recorder) {
        window.telefyaRecorderUploaded = true;
        return;
      }

      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.stop();
      });

      const blob = new Blob(chunksRef.current, {
        type: "video/webm",
      });

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_SOCKET_URL ||
        "http://localhost:5000";

      const response = await fetch(
        `${backendUrl}/api/v2/recording-bot/upload/${encodeURIComponent(
          recordingId,
        )}?secret=${encodeURIComponent(secret)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "video/webm",
          },
          body: blob,
        },
      );

      if (!response.ok) {
        throw new Error("Unable to upload finalized recording.");
      }

      for (const source of audioSourcesRef.current.values()) {
        source.disconnect();
      }

      audioSourcesRef.current.clear();

      try {
        silentOscillatorRef.current?.stop();
      } catch {}

      silentOscillatorRef.current = null;
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      audioDestinationRef.current = null;
      recorderRef.current = null;
      chunksRef.current = [];
      window.telefyaRecorderUploaded = true;
    };

    return () => {
      delete window.telefyaStartRecording;
      delete window.telefyaStopRecording;
    };
  }, [audioStreams, recordingId, recordingLayout, secret, syncAudioSources]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#050b1f]">
      <canvas
        ref={canvasRef}
        width={renderWidth}
        height={renderHeight}
        className="h-screen w-screen object-contain"
      />
    </main>
  );
}