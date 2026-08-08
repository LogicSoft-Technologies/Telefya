function cleanString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function normalizeDate(value) {
  const input = cleanString(value);

  if (!input) return null;

  const date = new Date(`${input}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Use a valid report date.");
  }

  return input;
}

function getReportRange(payload = {}) {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);

  const defaultFromDate = new Date(today);
  defaultFromDate.setDate(defaultFromDate.getDate() - 29);

  const defaultFrom = defaultFromDate.toISOString().slice(0, 10);

  const from = normalizeDate(payload.from) || defaultFrom;
  const to = normalizeDate(payload.to) || defaultTo;

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);

  if (fromDate > toDate) {
    throw new Error("The report start date must be before the end date.");
  }

  const days =
    Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;

  if (days > 366) {
    throw new Error("Reports can cover a maximum of 366 days.");
  }

  return { from, to, days };
}

function rangeValues(range) {
  return [range.from, range.to];
}

function toNumber(value) {
  return Number(value || 0);
}

const get_admin_usage_report_service = async (db_query, payload = {}) => {
  const range = getReportRange(payload);

  const [
    overviewRows,
    hostRows,
    modalityRows,
    dailyRows,
    topHostRows,
  ] = await Promise.all([
    db_query(
      `
        SELECT
          COUNT(DISTINCT a.user_id) AS active_users,
          COUNT(DISTINCT ms.shedular_user_id) AS active_hosts,
          COUNT(DISTINCT a.room_id) AS total_meetings,
          COUNT(DISTINCT a.id) AS total_participant_sessions,
          COALESCE(SUM(a.duration_minutes), 0) AS total_meeting_minutes,
          COALESCE(AVG(a.duration_minutes), 0) AS average_session_minutes
        FROM meeting_attendance a
        LEFT JOIN meeting_schedules ms
          ON ms.id = a.meeting_id
        WHERE a.joined_at >= ?
          AND a.joined_at < DATE_ADD(?, INTERVAL 1 DAY)
      `,
      rangeValues(range),
    ),

    db_query(
      `
        SELECT
          COUNT(DISTINCT ms.shedular_user_id) AS active_hosts
        FROM meeting_schedules ms
        WHERE ms.started_at >= ?
          AND ms.started_at < DATE_ADD(?, INTERVAL 1 DAY)
      `,
      rangeValues(range),
    ),

    db_query(
      `
        SELECT
          COALESCE(device_type, 'unknown') AS device_type,
          COUNT(DISTINCT user_id) AS unique_users,
          COUNT(*) AS session_events
        FROM meeting_session_events
        WHERE event_type = 'joined'
          AND occurred_at >= ?
          AND occurred_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY COALESCE(device_type, 'unknown')
        ORDER BY session_events DESC
      `,
      rangeValues(range),
    ),

    db_query(
      `
        SELECT
          DATE(joined_at) AS date,
          COUNT(DISTINCT user_id) AS active_users,
          COUNT(DISTINCT room_id) AS meetings,
          COUNT(*) AS participant_sessions,
          COALESCE(SUM(duration_minutes), 0) AS meeting_minutes
        FROM meeting_attendance
        WHERE joined_at >= ?
          AND joined_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY DATE(joined_at)
        ORDER BY date ASC
      `,
      rangeValues(range),
    ),

    db_query(
      `
        SELECT
          ms.shedular_user_id AS user_id,
          CONCAT_WS(' ', host.first_name, host.last_name) AS host_name,
          host.email AS host_email,
          COUNT(DISTINCT a.room_id) AS meetings_hosted,
          COALESCE(SUM(a.duration_minutes), 0) AS meeting_minutes,
          COUNT(DISTINCT a.user_id) AS participants
        FROM meeting_schedules ms
        LEFT JOIN users host
          ON host.user_id = ms.shedular_user_id
        LEFT JOIN meeting_attendance a
          ON a.meeting_id = ms.id
          AND a.joined_at >= ?
          AND a.joined_at < DATE_ADD(?, INTERVAL 1 DAY)
        GROUP BY
          ms.shedular_user_id,
          host.first_name,
          host.last_name,
          host.email
        HAVING meetings_hosted > 0
        ORDER BY meeting_minutes DESC
        LIMIT 10
      `,
      rangeValues(range),
    ),
  ]);

  const overview = overviewRows?.[0] || {};
  const hosts = hostRows?.[0] || {};

  return {
    success: true,
    message: "Usage report retrieved successfully.",
    data: {
      range,
      overview: {
        active_users: toNumber(overview.active_users),
        active_hosts: toNumber(hosts.active_hosts || overview.active_hosts),
        total_meetings: toNumber(overview.total_meetings),
        total_participant_sessions: toNumber(
          overview.total_participant_sessions,
        ),
        total_meeting_minutes: toNumber(overview.total_meeting_minutes),
        average_session_minutes: Number(
          Number(overview.average_session_minutes || 0).toFixed(1),
        ),
      },
      device_modalities: modalityRows || [],
      daily_usage: dailyRows || [],
      top_hosts: topHostRows || [],
    },
  };
};

const get_admin_quality_report_service = async (db_query, payload = {}) => {
  const range = getReportRange(payload);
  const limit = clampNumber(payload.limit, 25, 1, 100);

  const [overviewRows, dailyRows, affectedUsers, connectionRows] =
    await Promise.all([
      db_query(
        `
          SELECT
            COUNT(*) AS samples,
            COUNT(DISTINCT user_id) AS measured_users,
            COUNT(DISTINCT room_id) AS measured_rooms,
            COALESCE(AVG(round_trip_time_ms), 0) AS average_round_trip_time_ms,
            COALESCE(AVG(jitter_ms), 0) AS average_jitter_ms,
            COALESCE(AVG(packet_loss_percent), 0) AS average_packet_loss_percent,
            COALESCE(AVG(quality_score), 0) AS average_quality_score,
            COALESCE(SUM(is_unstable = TRUE), 0) AS unstable_samples,
            COUNT(DISTINCT CASE
              WHEN is_unstable = TRUE THEN user_id
              ELSE NULL
            END) AS affected_users
          FROM meeting_quality_samples
          WHERE sampled_at >= ?
            AND sampled_at < DATE_ADD(?, INTERVAL 1 DAY)
        `,
        rangeValues(range),
      ),

      db_query(
        `
          SELECT
            DATE(sampled_at) AS date,
            COUNT(*) AS samples,
            COALESCE(AVG(round_trip_time_ms), 0) AS average_round_trip_time_ms,
            COALESCE(AVG(jitter_ms), 0) AS average_jitter_ms,
            COALESCE(AVG(packet_loss_percent), 0) AS average_packet_loss_percent,
            COALESCE(AVG(quality_score), 0) AS average_quality_score,
            COALESCE(SUM(is_unstable = TRUE), 0) AS unstable_samples
          FROM meeting_quality_samples
          WHERE sampled_at >= ?
            AND sampled_at < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY DATE(sampled_at)
          ORDER BY date ASC
        `,
        rangeValues(range),
      ),

      db_query(
        `
          SELECT
            q.user_id,
            CONCAT_WS(' ', u.first_name, u.last_name) AS user_name,
            u.email,
            COUNT(*) AS samples,
            COALESCE(AVG(q.round_trip_time_ms), 0) AS average_round_trip_time_ms,
            COALESCE(AVG(q.jitter_ms), 0) AS average_jitter_ms,
            COALESCE(AVG(q.packet_loss_percent), 0) AS average_packet_loss_percent,
            COALESCE(AVG(q.quality_score), 0) AS average_quality_score,
            COALESCE(SUM(q.is_unstable = TRUE), 0) AS unstable_samples,
            MAX(q.sampled_at) AS last_sample_at
          FROM meeting_quality_samples q
          LEFT JOIN users u
            ON u.user_id = q.user_id
          WHERE q.sampled_at >= ?
            AND q.sampled_at < DATE_ADD(?, INTERVAL 1 DAY)
            AND q.is_unstable = TRUE
          GROUP BY q.user_id, u.first_name, u.last_name, u.email
          ORDER BY unstable_samples DESC, average_packet_loss_percent DESC
          LIMIT ?
        `,
        [...rangeValues(range), limit],
      ),

      db_query(
        `
          SELECT
            COALESCE(connection_state, 'unknown') AS connection_state,
            COUNT(*) AS total
          FROM meeting_session_events
          WHERE event_type = 'connection_state_changed'
            AND occurred_at >= ?
            AND occurred_at < DATE_ADD(?, INTERVAL 1 DAY)
          GROUP BY COALESCE(connection_state, 'unknown')
          ORDER BY total DESC
        `,
        rangeValues(range),
      ),
    ]);

  const overview = overviewRows?.[0] || {};

  return {
    success: true,
    message: "Quality report retrieved successfully.",
    data: {
      range,
      telemetry_available: toNumber(overview.samples) > 0,
      overview: {
        samples: toNumber(overview.samples),
        measured_users: toNumber(overview.measured_users),
        measured_rooms: toNumber(overview.measured_rooms),
        average_round_trip_time_ms: Number(
          Number(overview.average_round_trip_time_ms || 0).toFixed(1),
        ),
        average_jitter_ms: Number(
          Number(overview.average_jitter_ms || 0).toFixed(1),
        ),
        average_packet_loss_percent: Number(
          Number(overview.average_packet_loss_percent || 0).toFixed(3),
        ),
        average_quality_score: Number(
          Number(overview.average_quality_score || 0).toFixed(1),
        ),
        unstable_samples: toNumber(overview.unstable_samples),
        affected_users: toNumber(overview.affected_users),
      },
      daily_quality: dailyRows || [],
      affected_users: affectedUsers || [],
      connection_states: connectionRows || [],
    },
  };
};

const get_admin_compliance_report_service = async (
  db_query,
  payload = {},
) => {
  const range = getReportRange(payload);
  const page = clampNumber(payload.page, 1, 1, 100000);
  const limit = clampNumber(payload.limit, 25, 1, 100);
  const offset = (page - 1) * limit;

  const [overviewRows, storageRows, countRows, attendanceRows] =
    await Promise.all([
      db_query(
        `
          SELECT
            COUNT(DISTINCT a.room_id) AS meetings_with_attendance,
            COUNT(*) AS attendance_records,
            COUNT(DISTINCT a.user_id) AS unique_attendees,
            COALESCE(SUM(a.duration_minutes), 0) AS attended_minutes,
            COALESCE(AVG(a.duration_minutes), 0) AS average_attendance_minutes
          FROM meeting_attendance a
          WHERE a.joined_at >= ?
            AND a.joined_at < DATE_ADD(?, INTERVAL 1 DAY)
        `,
        rangeValues(range),
      ),

      db_query(
        `
          SELECT
            COUNT(*) AS total_recordings,
            COALESCE(SUM(size_bytes), 0) AS storage_bytes,
            COALESCE(SUM(duration_seconds), 0) AS recording_seconds,
            COALESCE(SUM(status = 'ready'), 0) AS ready_recordings
          FROM meeting_recordings
          WHERE created_at >= ?
            AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
        `,
        rangeValues(range),
      ),

      db_query(
        `
          SELECT COUNT(*) AS total
          FROM meeting_attendance a
          WHERE a.joined_at >= ?
            AND a.joined_at < DATE_ADD(?, INTERVAL 1 DAY)
        `,
        rangeValues(range),
      ),

      db_query(
        `
          SELECT
            a.id,
            a.room_id,
            a.meeting_id,
            COALESCE(ms.des, CONCAT('Meeting ', a.room_id)) AS meeting_title,
            a.user_id,
            COALESCE(
              NULLIF(a.user_name, ''),
              CONCAT_WS(' ', u.first_name, u.last_name),
              u.email
            ) AS attendee_name,
            u.email AS attendee_email,
            a.joined_at,
            a.left_at,
            a.duration_minutes,
            host.email AS host_email
          FROM meeting_attendance a
          LEFT JOIN users u
            ON u.user_id = a.user_id
          LEFT JOIN meeting_schedules ms
            ON ms.id = a.meeting_id
          LEFT JOIN users host
            ON host.user_id = ms.shedular_user_id
          WHERE a.joined_at >= ?
            AND a.joined_at < DATE_ADD(?, INTERVAL 1 DAY)
          ORDER BY a.joined_at DESC
          LIMIT ?
          OFFSET ?
        `,
        [...rangeValues(range), limit, offset],
      ),
    ]);

  const overview = overviewRows?.[0] || {};
  const storage = storageRows?.[0] || {};

  return {
    success: true,
    message: "Compliance report retrieved successfully.",
    data: {
      range,
      overview: {
        meetings_with_attendance: toNumber(overview.meetings_with_attendance),
        attendance_records: toNumber(overview.attendance_records),
        unique_attendees: toNumber(overview.unique_attendees),
        attended_minutes: toNumber(overview.attended_minutes),
        average_attendance_minutes: Number(
          Number(overview.average_attendance_minutes || 0).toFixed(1),
        ),
        total_recordings: toNumber(storage.total_recordings),
        ready_recordings: toNumber(storage.ready_recordings),
        storage_bytes: toNumber(storage.storage_bytes),
        recording_seconds: toNumber(storage.recording_seconds),
      },
      attendance: attendanceRows || [],
      pagination: {
        page,
        limit,
        total: toNumber(countRows?.[0]?.total),
      },
    },
  };
};

const get_admin_security_report_service = async (db_query, payload = {}) => {
  const range = getReportRange(payload);
  const limit = clampNumber(payload.limit, 50, 1, 200);

  const [overviewRows, adminActions, suspendedRows] = await Promise.all([
    db_query(
      `
        SELECT
          COUNT(*) AS admin_actions,
          COUNT(DISTINCT admin_user_id) AS active_administrators,
          COALESCE(SUM(action = 'user.account_status_updated'), 0)
            AS account_status_changes,
          COALESCE(SUM(action LIKE 'mail_campaign%'), 0)
            AS campaign_actions
        FROM admin_audit_logs
        WHERE created_at >= ?
          AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
      `,
      rangeValues(range),
    ),

    db_query(
      `
        SELECT
          l.id,
          l.admin_user_id,
          CONCAT_WS(' ', u.first_name, u.last_name) AS admin_name,
          u.email AS admin_email,
          pa.admin_role,
          l.action,
          l.target_type,
          l.target_id,
          l.metadata,
          l.ip_address,
          l.created_at
        FROM admin_audit_logs l
        LEFT JOIN users u
          ON u.user_id = l.admin_user_id
        LEFT JOIN platform_admins pa
          ON pa.user_id = l.admin_user_id
        WHERE l.created_at >= ?
          AND l.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        ORDER BY l.created_at DESC
        LIMIT ?
      `,
      [...rangeValues(range), limit],
    ),

    db_query(`
      SELECT
        COUNT(*) AS suspended_accounts,
        COUNT(DISTINCT pa.user_id) AS active_platform_administrators
      FROM users u
      LEFT JOIN platform_admins pa
        ON pa.user_id = u.user_id
        AND pa.status = 'active'
      WHERE u.account_status = 'suspended'
         OR pa.user_id IS NOT NULL
    `),
  ]);

  const overview = overviewRows?.[0] || {};
  const accounts = suspendedRows?.[0] || {};

  return {
    success: true,
    message: "Security report retrieved successfully.",
    data: {
      range,
      overview: {
        admin_actions: toNumber(overview.admin_actions),
        active_administrators: toNumber(
          accounts.active_platform_administrators ||
            overview.active_administrators,
        ),
        account_status_changes: toNumber(
          overview.account_status_changes,
        ),
        campaign_actions: toNumber(overview.campaign_actions),
        suspended_accounts: toNumber(accounts.suspended_accounts),
      },
      audit_log: adminActions || [],
    },
  };
};

const get_admin_reporting_overview_service = async (
  db_query,
  payload = {},
) => {
  const range = getReportRange(payload);

  const [usage, quality, compliance, security] = await Promise.all([
    get_admin_usage_report_service(db_query, range),
    get_admin_quality_report_service(db_query, {
      ...range,
      limit: 5,
    }),
    get_admin_compliance_report_service(db_query, {
      ...range,
      page: 1,
      limit: 5,
    }),
    get_admin_security_report_service(db_query, {
      ...range,
      limit: 5,
    }),
  ]);

  return {
    success: true,
    message: "Admin reporting overview retrieved successfully.",
    data: {
      range,
      usage: usage.data,
      quality: quality.data,
      compliance: compliance.data,
      security: security.data,
    },
  };
};

module.exports = {
  get_admin_reporting_overview_service,
  get_admin_usage_report_service,
  get_admin_quality_report_service,
  get_admin_compliance_report_service,
  get_admin_security_report_service,
};