function cleanString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase();
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(Math.floor(parsed), min), max);
}

function toBoolean(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  return null;
}

function safeJson(value, fallback = {}) {
  try {
    return JSON.stringify(value ?? fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;

  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeAccountStatus(value) {
  const status = cleanString(value).toLowerCase();

  if (status === "active" || status === "suspended") {
    return status;
  }

  return null;
}

function normalizeAdminRole(value) {
  const role = cleanString(value).toLowerCase();

  const allowedRoles = [
    "super_admin",
    "admin",
    "support",
    "analyst",
    "marketing",
  ];

  return allowedRoles.includes(role) ? role : null;
}

function normalizeAudienceFilters(payload = {}) {
  const source =
    payload && typeof payload === "object" ? payload : {};

  const verified = toBoolean(source.verified);
  const marketingOptIn = toBoolean(source.marketing_opt_in);

  const userIds = Array.isArray(source.user_ids)
    ? [
        ...new Set(
          source.user_ids
            .map((userId) => cleanString(userId))
            .filter(Boolean),
        ),
      ].slice(0, 10000)
    : [];

  return {
    search: cleanString(source.search).slice(0, 100),
    country: cleanString(source.country).slice(0, 120),
    plan_code: cleanString(source.plan_code).slice(0, 50),
    account_status: normalizeAccountStatus(source.account_status),
    verified,
    marketing_opt_in: marketingOptIn,
    created_from: cleanString(source.created_from).slice(0, 30),
    created_to: cleanString(source.created_to).slice(0, 30),
    user_ids: userIds,
  };
}

function buildAudienceWhere(filters = {}, options = {}) {
  const clauses = [];
  const values = [];

  if (options.marketingOnly) {
    clauses.push("u.marketing_opt_in = TRUE");
    clauses.push("u.account_status = 'active'");
  }

  if (filters.search) {
    clauses.push(`
      (
        u.email LIKE ?
        OR u.first_name LIKE ?
        OR u.last_name LIKE ?
        OR u.user_id LIKE ?
      )
    `);

    const term = `%${filters.search}%`;
    values.push(term, term, term, term);
  }

  if (filters.country) {
    clauses.push("u.country = ?");
    values.push(filters.country);
  }

  if (filters.plan_code) {
    clauses.push("COALESCE(us.plan_code, 'free') = ?");
    values.push(filters.plan_code);
  }

  if (filters.account_status) {
    clauses.push("u.account_status = ?");
    values.push(filters.account_status);
  }

  if (filters.verified !== null) {
    clauses.push("u.is_verified = ?");
    values.push(filters.verified);
  }

  if (filters.marketing_opt_in !== null && !options.marketingOnly) {
    clauses.push("u.marketing_opt_in = ?");
    values.push(filters.marketing_opt_in);
  }

  if (filters.created_from) {
    clauses.push("u.created_at >= ?");
    values.push(filters.created_from);
  }

  if (filters.created_to) {
    clauses.push("u.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(filters.created_to);
  }

  if (filters.user_ids.length > 0) {
    clauses.push(
      `u.user_id IN (${filters.user_ids.map(() => "?").join(", ")})`,
    );

    values.push(...filters.user_ids);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

async function writeAuditLog(
  db_query,
  adminUserId,
  action,
  {
    targetType = null,
    targetId = null,
    metadata = {},
    ipAddress = null,
  } = {},
) {
  await db_query(
    `
      INSERT INTO admin_audit_logs
      (
        admin_user_id,
        action,
        target_type,
        target_id,
        metadata,
        ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      adminUserId,
      action,
      targetType,
      targetId ? String(targetId) : null,
      safeJson(metadata),
      ipAddress,
    ],
  );
}

async function getAdminUser(db_query, userId) {
  const rows = await db_query(
    `
      SELECT
        user_id,
        admin_role,
        status
      FROM platform_admins
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows?.[0] || null;
}

const get_admin_dashboard_service = async (db_query) => {
  const [
    userCounts,
    meetingCounts,
    recordingCounts,
    subscriptionCounts,
    campaignCounts,
  ] = await Promise.all([
    db_query(`
      SELECT
        COUNT(*) AS total_users,
        SUM(is_verified = TRUE) AS verified_users,
        SUM(account_status = 'active') AS active_users,
        SUM(account_status = 'suspended') AS suspended_users,
        SUM(marketing_opt_in = TRUE) AS marketing_opted_in_users
      FROM users
    `),

    db_query(`
      SELECT
        COUNT(*) AS total_meetings,
        SUM(status = 'upcoming') AS upcoming_meetings,
        SUM(status = 'live') AS live_meetings,
        SUM(status = 'ended') AS ended_meetings
      FROM meeting_schedules
    `),

    db_query(`
      SELECT
        COUNT(*) AS total_recordings,
        SUM(status = 'ready') AS ready_recordings,
        SUM(status = 'recording') AS active_recordings
      FROM meeting_recordings
    `),

    db_query(`
      SELECT
        COUNT(*) AS total_subscriptions,
        SUM(status IN ('active', 'trialing')) AS paid_subscriptions,
        SUM(plan_code = 'free') AS free_subscriptions
      FROM user_subscriptions
    `),

    db_query(`
      SELECT
        COUNT(*) AS total_campaigns,
        SUM(status = 'draft') AS draft_campaigns,
        SUM(status = 'scheduled') AS scheduled_campaigns,
        SUM(status = 'sent') AS sent_campaigns
      FROM admin_mail_campaigns
    `),
  ]);

  return {
    success: true,
    message: "Admin dashboard retrieved successfully.",
    data: {
      users: userCounts?.[0] || {},
      meetings: meetingCounts?.[0] || {},
      recordings: recordingCounts?.[0] || {},
      subscriptions: subscriptionCounts?.[0] || {},
      campaigns: campaignCounts?.[0] || {},
    },
  };
};

const list_admin_users_service = async (
  db_query,
  payload = {},
) => {
  const filters = normalizeAudienceFilters(payload);
  const page = clampNumber(payload.page, 1, 1, 100000);
  const limit = clampNumber(payload.limit, 25, 1, 100);
  const offset = (page - 1) * limit;

  const { where, values } = buildAudienceWhere(filters);

  const countRows = await db_query(
    `
      SELECT COUNT(*) AS total
      FROM users u
      LEFT JOIN user_subscriptions us
        ON us.user_id = u.user_id
      ${where}
    `,
    values,
  );

  const users = await db_query(
    `
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        u.country,
        u.state,
        u.city,
        u.profile_image,
        u.is_verified,
        u.account_status,
        u.marketing_opt_in,
        u.marketing_opt_in_at,
        u.created_at,
        u.updated_at,
        COALESCE(us.plan_code, 'free') AS plan_code,
        COALESCE(us.status, 'free') AS subscription_status,
        pa.admin_role
      FROM users u
      LEFT JOIN user_subscriptions us
        ON us.user_id = u.user_id
      LEFT JOIN platform_admins pa
        ON pa.user_id = u.user_id
        AND pa.status = 'active'
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ?
      OFFSET ?
    `,
    [...values, limit, offset],
  );

  return {
    success: true,
    message: "Users retrieved successfully.",
    data: {
      users: users || [],
      pagination: {
        page,
        limit,
        total: Number(countRows?.[0]?.total || 0),
      },
      filters,
    },
  };
};

const get_admin_user_service = async (
  db_query,
  userId,
) => {
  const users = await db_query(
    `
      SELECT
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone_number,
        u.country,
        u.state,
        u.city,
        u.date_of_birth,
        u.profile_image,
        u.is_verified,
        u.account_status,
        u.marketing_opt_in,
        u.marketing_opt_in_at,
        u.created_at,
        u.updated_at,
        COALESCE(us.plan_code, 'free') AS plan_code,
        COALESCE(us.status, 'free') AS subscription_status,
        pa.admin_role,
        pa.status AS admin_status
      FROM users u
      LEFT JOIN user_subscriptions us
        ON us.user_id = u.user_id
      LEFT JOIN platform_admins pa
        ON pa.user_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  const user = users?.[0];

  if (!user) {
    throw new Error("User not found.");
  }

  const [meetingRows, recordingRows] = await Promise.all([
    db_query(
      `
        SELECT
          COUNT(*) AS total_meetings,
          SUM(status = 'upcoming') AS upcoming_meetings,
          SUM(status = 'live') AS live_meetings
        FROM meeting_schedules
        WHERE shedular_user_id = ?
      `,
      [userId],
    ),

    db_query(
      `
        SELECT
          COUNT(*) AS total_recordings,
          SUM(status = 'ready') AS ready_recordings
        FROM meeting_recordings
        WHERE host_user_id = ?
      `,
      [userId],
    ),
  ]);

  return {
    success: true,
    message: "User retrieved successfully.",
    data: {
      user,
      activity: {
        meetings: meetingRows?.[0] || {},
        recordings: recordingRows?.[0] || {},
      },
    },
  };
};

const update_admin_user_status_service = async (
  db_query,
  admin,
  targetUserId,
  payload = {},
  context = {},
) => {
  const targetId = cleanString(targetUserId);
  const accountStatus = normalizeAccountStatus(payload.account_status);

  if (!targetId || !accountStatus) {
    throw new Error("Choose a valid account status.");
  }

  if (String(admin.userId) === targetId) {
    throw new Error("You cannot change your own account status.");
  }

  const users = await db_query(
    `
      SELECT
        u.user_id,
        u.email,
        u.account_status,
        pa.admin_role,
        pa.status AS platform_admin_status
      FROM users u
      LEFT JOIN platform_admins pa
        ON pa.user_id = u.user_id
      WHERE u.user_id = ?
      LIMIT 1
    `,
    [targetId],
  );

  const target = users?.[0];

  if (!target) {
    throw new Error("User not found.");
  }

  if (
    target.platform_admin_status === "active" &&
    admin.role !== "super_admin"
  ) {
    throw new Error(
      "Only a super administrator can change another administrator account.",
    );
  }

  if (
    target.admin_role === "super_admin" &&
    admin.role !== "super_admin"
  ) {
    throw new Error(
      "Only a super administrator can change a super administrator account.",
    );
  }

  await db_query(
    `
      UPDATE users
      SET account_status = ?
      WHERE user_id = ?
    `,
    [accountStatus, targetId],
  );

  await writeAuditLog(
    db_query,
    admin.userId,
    "user.account_status_updated",
    {
      targetType: "user",
      targetId,
      metadata: {
        previous_status: target.account_status,
        next_status: accountStatus,
        target_email: target.email,
      },
      ipAddress: context.ipAddress,
    },
  );

  return {
    success: true,
    message:
      accountStatus === "suspended"
        ? "User account suspended."
        : "User account activated.",
    data: {
      user_id: targetId,
      account_status: accountStatus,
    },
  };
};

const list_admin_segments_service = async (db_query) => {
  const rows = await db_query(`
    SELECT
      s.id,
      s.name,
      s.description,
      s.filters,
      s.created_by_user_id,
      s.created_at,
      s.updated_at,
      CONCAT_WS(
        ' ',
        u.first_name,
        u.last_name
      ) AS created_by_name
    FROM admin_audience_segments s
    LEFT JOIN users u
      ON u.user_id = s.created_by_user_id
    ORDER BY s.updated_at DESC
  `);

  return {
    success: true,
    message: "Audience segments retrieved successfully.",
    data: (rows || []).map((segment) => ({
      ...segment,
      filters: parseJson(segment.filters),
    })),
  };
};

const create_admin_segment_service = async (
  db_query,
  admin,
  payload = {},
  context = {},
) => {
  const name = cleanString(payload.name).slice(0, 150);
  const description = cleanString(payload.description).slice(0, 500);
  const filters = normalizeAudienceFilters(payload.filters);

  if (!name) {
    throw new Error("A segment name is required.");
  }

  const result = await db_query(
    `
      INSERT INTO admin_audience_segments
      (
        name,
        description,
        filters,
        created_by_user_id
      )
      VALUES (?, ?, ?, ?)
    `,
    [
      name,
      description || null,
      safeJson(filters),
      admin.userId,
    ],
  );

  await writeAuditLog(
    db_query,
    admin.userId,
    "audience_segment.created",
    {
      targetType: "audience_segment",
      targetId: result.insertId,
      metadata: {
        name,
        filters,
      },
      ipAddress: context.ipAddress,
    },
  );

  return {
    success: true,
    message: "Audience segment created.",
    data: {
      id: result.insertId,
      name,
      description,
      filters,
    },
  };
};

const preview_admin_audience_service = async (
  db_query,
  payload = {},
) => {
  const filters = normalizeAudienceFilters(payload.filters || payload);
  const marketingOnly = toBoolean(payload.marketing_only) !== false;

  const { where, values } = buildAudienceWhere(filters, {
    marketingOnly,
  });

  const [countRows, users] = await Promise.all([
    db_query(
      `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN user_subscriptions us
          ON us.user_id = u.user_id
        ${where}
      `,
      values,
    ),

    db_query(
      `
        SELECT
          u.user_id,
          u.first_name,
          u.last_name,
          u.email,
          u.country,
          COALESCE(us.plan_code, 'free') AS plan_code
        FROM users u
        LEFT JOIN user_subscriptions us
          ON us.user_id = u.user_id
        ${where}
        ORDER BY u.created_at DESC
        LIMIT 25
      `,
      values,
    ),
  ]);

  return {
    success: true,
    message: "Audience preview retrieved successfully.",
    data: {
      total: Number(countRows?.[0]?.total || 0),
      preview: users || [],
      filters,
      marketing_only: marketingOnly,
    },
  };
};

const list_admin_campaigns_service = async (
  db_query,
  payload = {},
) => {
  const page = clampNumber(payload.page, 1, 1, 100000);
  const limit = clampNumber(payload.limit, 25, 1, 100);
  const offset = (page - 1) * limit;

  const [countRows, campaigns] = await Promise.all([
    db_query(`SELECT COUNT(*) AS total FROM admin_mail_campaigns`),

    db_query(
      `
        SELECT
          c.id,
          c.name,
          c.subject,
          c.preheader,
          c.status,
          c.scheduled_for,
          c.started_at,
          c.sent_at,
          c.total_recipients,
          c.sent_count,
          c.failed_count,
          c.created_at,
          c.updated_at,
          c.created_by_user_id,
          CONCAT_WS(
            ' ',
            u.first_name,
            u.last_name
          ) AS created_by_name
        FROM admin_mail_campaigns c
        LEFT JOIN users u
          ON u.user_id = c.created_by_user_id
        ORDER BY c.created_at DESC
        LIMIT ?
        OFFSET ?
      `,
      [limit, offset],
    ),
  ]);

  return {
    success: true,
    message: "Mail campaigns retrieved successfully.",
    data: {
      campaigns: campaigns || [],
      pagination: {
        page,
        limit,
        total: Number(countRows?.[0]?.total || 0),
      },
    },
  };
};

const create_admin_campaign_service = async (
  db_query,
  admin,
  payload = {},
  context = {},
) => {
  const name = cleanString(payload.name).slice(0, 150);
  const subject = cleanString(payload.subject).slice(0, 255);
  const preheader = cleanString(payload.preheader).slice(0, 255);
  const htmlContent = cleanString(payload.html_content);
  const textContent = cleanString(payload.text_content);
  const scheduledFor = cleanString(payload.scheduled_for) || null;
  const maxRecipients = clampNumber(
    payload.max_recipients,
    1000,
    1,
    10000,
  );

  const requestedStatus = cleanString(payload.status).toLowerCase();
  const status =
    requestedStatus === "scheduled" && scheduledFor
      ? "scheduled"
      : "draft";

  const filters = normalizeAudienceFilters(payload.filters);

  if (!name || !subject || !htmlContent) {
    throw new Error(
      "Campaign name, subject, and HTML content are required.",
    );
  }

  const { where, values } = buildAudienceWhere(filters, {
    marketingOnly: true,
  });

  const recipients = await db_query(
    `
      SELECT
        u.user_id,
        u.email
      FROM users u
      LEFT JOIN user_subscriptions us
        ON us.user_id = u.user_id
      ${where}
      ORDER BY u.created_at DESC
      LIMIT ?
    `,
    [...values, maxRecipients],
  );

  if (!recipients.length) {
    throw new Error(
      "No opted-in active users match this campaign audience.",
    );
  }

  const result = await db_query(
    `
      INSERT INTO admin_mail_campaigns
      (
        created_by_user_id,
        name,
        subject,
        preheader,
        html_content,
        text_content,
        audience_filter,
        status,
        scheduled_for,
        total_recipients
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      admin.userId,
      name,
      subject,
      preheader || null,
      htmlContent,
      textContent || null,
      safeJson(filters),
      status,
      scheduledFor,
      recipients.length,
    ],
  );

  const campaignId = result.insertId;

  for (const recipient of recipients) {
    await db_query(
      `
        INSERT INTO admin_mail_recipients
        (
          campaign_id,
          user_id,
          email,
          delivery_status
        )
        VALUES (?, ?, ?, 'queued')
      `,
      [campaignId, recipient.user_id, normalizeEmail(recipient.email)],
    );
  }

  await writeAuditLog(
    db_query,
    admin.userId,
    "mail_campaign.created",
    {
      targetType: "mail_campaign",
      targetId: campaignId,
      metadata: {
        name,
        status,
        recipient_count: recipients.length,
        filters,
      },
      ipAddress: context.ipAddress,
    },
  );

  return {
    success: true,
    message:
      status === "scheduled"
        ? "Newsletter campaign scheduled."
        : "Newsletter draft created.",
    data: {
      id: campaignId,
      name,
      status,
      total_recipients: recipients.length,
      scheduled_for: scheduledFor,
    },
  };
};

const get_admin_campaign_service = async (
  db_query,
  campaignId,
) => {
  const campaigns = await db_query(
    `
      SELECT
        id,
        created_by_user_id,
        name,
        subject,
        preheader,
        html_content,
        text_content,
        audience_filter,
        status,
        scheduled_for,
        started_at,
        sent_at,
        total_recipients,
        sent_count,
        failed_count,
        created_at,
        updated_at
      FROM admin_mail_campaigns
      WHERE id = ?
      LIMIT 1
    `,
    [campaignId],
  );

  const campaign = campaigns?.[0];

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const recipientCounts = await db_query(
    `
      SELECT
        delivery_status,
        COUNT(*) AS total
      FROM admin_mail_recipients
      WHERE campaign_id = ?
      GROUP BY delivery_status
    `,
    [campaignId],
  );

  return {
    success: true,
    message: "Campaign retrieved successfully.",
    data: {
      ...campaign,
      audience_filter: parseJson(campaign.audience_filter),
      recipient_counts: recipientCounts || [],
    },
  };
};

function normalizeMeetingStatus(value) {
  const status = cleanString(value).toLowerCase();

  return ["upcoming", "live", "ended", "cancelled"].includes(status)
    ? status
    : null;
}

const list_admin_meetings_service = async (
  db_query,
  payload = {},
) => {
  const page = clampNumber(payload.page, 1, 1, 100000);
  const limit = clampNumber(payload.limit, 25, 1, 100);
  const offset = (page - 1) * limit;

  const status = normalizeMeetingStatus(payload.status);
  const search = cleanString(payload.search).slice(0, 100);

  const clauses = [];
  const values = [];

  if (status) {
    clauses.push("ms.status = ?");
    values.push(status);
  }

  if (search) {
    const term = `%${search}%`;

    clauses.push(`
      (
        ms.meeting_url LIKE ?
        OR ms.des LIKE ?
        OR host.email LIKE ?
        OR host.first_name LIKE ?
        OR host.last_name LIKE ?
      )
    `);

    values.push(term, term, term, term, term);
  }

  const where = clauses.length
    ? `WHERE ${clauses.join(" AND ")}`
    : "";

  const [countRows, meetings] = await Promise.all([
    db_query(
      `
        SELECT COUNT(*) AS total
        FROM meeting_schedules ms
        LEFT JOIN users host
          ON host.user_id = ms.shedular_user_id
        ${where}
      `,
      values,
    ),

    db_query(
      `
        SELECT
          ms.id,
          ms.meeting_url,
          ms.des,
          ms.time_zone,
          ms.scheduled_for,
          ms.status,
          ms.started_at,
          ms.ended_at,
          ms.created_at,
          ms.updated_at,
          ms.shedular_user_id AS host_user_id,
          host.first_name AS host_first_name,
          host.last_name AS host_last_name,
          host.email AS host_email,
          COUNT(DISTINCT CASE
            WHEN members.status = 'accepted' THEN members.user_id
            ELSE NULL
          END) AS accepted_members
        FROM meeting_schedules ms
        LEFT JOIN users host
          ON host.user_id = ms.shedular_user_id
        LEFT JOIN meeting_members members
          ON members.meeting_id = ms.id
        ${where}
        GROUP BY
          ms.id,
          ms.meeting_url,
          ms.des,
          ms.time_zone,
          ms.scheduled_for,
          ms.status,
          ms.started_at,
          ms.ended_at,
          ms.created_at,
          ms.updated_at,
          ms.shedular_user_id,
          host.first_name,
          host.last_name,
          host.email
        ORDER BY
          CASE ms.status
            WHEN 'live' THEN 0
            WHEN 'upcoming' THEN 1
            WHEN 'ended' THEN 2
            ELSE 3
          END,
          ms.scheduled_for DESC,
          ms.created_at DESC
        LIMIT ?
        OFFSET ?
      `,
      [...values, limit, offset],
    ),
  ]);

  return {
    success: true,
    message: "Platform meetings retrieved successfully.",
    data: {
      meetings: meetings || [],
      pagination: {
        page,
        limit,
        total: Number(countRows?.[0]?.total || 0),
      },
    },
  };
};

const list_admin_recordings_service = async (
  db_query,
  payload = {},
) => {
  const page = clampNumber(payload.page, 1, 1, 100000);
  const limit = clampNumber(payload.limit, 25, 1, 100);
  const offset = (page - 1) * limit;

  const status = cleanString(payload.status).toLowerCase();
  const search = cleanString(payload.search).slice(0, 100);

  const clauses = [];
  const values = [];

  if (status) {
    clauses.push("mr.status = ?");
    values.push(status);
  }

  if (search) {
    const term = `%${search}%`;

    clauses.push(`
      (
        mr.recording_id LIKE ?
        OR mr.room_id LIKE ?
        OR mr.title LIKE ?
        OR host.email LIKE ?
        OR host.first_name LIKE ?
        OR host.last_name LIKE ?
      )
    `);

    values.push(term, term, term, term, term, term);
  }

  const where = clauses.length
    ? `WHERE ${clauses.join(" AND ")}`
    : "";

  const [countRows, recordings] = await Promise.all([
    db_query(
      `
        SELECT COUNT(*) AS total
        FROM meeting_recordings mr
        LEFT JOIN users host
          ON host.user_id = mr.host_user_id
        ${where}
      `,
      values,
    ),

    db_query(
      `
        SELECT
          mr.id,
          mr.recording_id,
          mr.room_id,
          mr.meeting_id,
          mr.host_user_id,
          mr.title,
          mr.status,
          mr.file_name,
          mr.mime_type,
          mr.size_bytes,
          mr.duration_seconds,
          mr.started_at,
          mr.stopped_at,
          mr.expires_at,
          mr.created_at,
          host.first_name AS host_first_name,
          host.last_name AS host_last_name,
          host.email AS host_email,
          ms.des AS meeting_description,
          ms.meeting_url
        FROM meeting_recordings mr
        LEFT JOIN users host
          ON host.user_id = mr.host_user_id
        LEFT JOIN meeting_schedules ms
          ON ms.id = mr.meeting_id
        ${where}
        ORDER BY mr.created_at DESC
        LIMIT ?
        OFFSET ?
      `,
      [...values, limit, offset],
    ),
  ]);

  return {
    success: true,
    message: "Platform recordings retrieved successfully.",
    data: {
      recordings: recordings || [],
      pagination: {
        page,
        limit,
        total: Number(countRows?.[0]?.total || 0),
      },
    },
  };
};

module.exports = {
  get_admin_dashboard_service,
  list_admin_users_service,
  get_admin_user_service,
  update_admin_user_status_service,
  list_admin_segments_service,
  create_admin_segment_service,
  preview_admin_audience_service,
  list_admin_campaigns_service,
  list_admin_meetings_service,
  list_admin_recordings_service,
  create_admin_campaign_service,
  get_admin_campaign_service,
};