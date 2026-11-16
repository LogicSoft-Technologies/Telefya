const crypto = require("crypto");

const {
  createPkcePair,
  decryptCalendarSecret,
  encryptCalendarSecret,
  hashCalendarState,
} = require("./32-calendar-crypto_service");

const GOOGLE_AUTHORIZATION_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

const GOOGLE_TOKEN_URL =
  "https://oauth2.googleapis.com/token";

const GOOGLE_USER_INFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";

const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events";

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getGoogleConfig() {
  const clientId = cleanText(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
  );

  const clientSecret = cleanText(
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
  );

  const redirectUri = cleanText(
    process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  );

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Calendar OAuth is not configured on the server.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

function getFrontEndUrl() {
  const value = cleanText(process.env.FRONTEND_URL)
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

  return value || "https://telefya.com";
}

function toMysqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function buildCallbackUrl(status, message = "") {
  const url = new URL(`${getFrontEndUrl()}/calendar`);

  url.searchParams.set("calendarSync", status);

  if (message) {
    url.searchParams.set("calendarSyncMessage", message.slice(0, 180));
  }

  return url.toString();
}

function getGoogleScopes() {
  return ["openid", "email", GOOGLE_CALENDAR_SCOPE];
}

async function parseProviderResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      body?.error_description ||
      body?.error?.message ||
      body?.error ||
      "Google request failed.";

    throw new Error(String(message).slice(0, 500));
  }

  return body;
}

async function createGoogleAuthorizationService(dbQuery, userId) {
  const { clientId, redirectUri } = getGoogleConfig();
  const state = crypto.randomBytes(32).toString("base64url");
  const { verifier, challenge } = createPkcePair();

  await dbQuery(
    `
      DELETE FROM calendar_oauth_states
      WHERE user_id = ?
        AND provider = 'google'
    `,
    [userId],
  );

  await dbQuery(
    `
      INSERT INTO calendar_oauth_states
      (
        user_id,
        provider,
        state_hash,
        encrypted_code_verifier,
        expires_at
      )
      VALUES (?, 'google', ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
    `,
    [
      userId,
      hashCalendarState(state),
      encryptCalendarSecret(verifier),
    ],
  );

  const url = new URL(GOOGLE_AUTHORIZATION_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getGoogleScopes().join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return {
    success: true,
    data: {
      authorizationUrl: url.toString(),
    },
  };
}

async function consumeGoogleState(dbQuery, rawState) {
  const state = cleanText(rawState);

  if (!state) {
    throw new Error("Google authorization state is missing.");
  }

  const rows = await dbQuery(
    `
      SELECT *
      FROM calendar_oauth_states
      WHERE provider = 'google'
        AND state_hash = ?
        AND consumed_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `,
    [hashCalendarState(state)],
  );

  const stateRow = rows?.[0];

  if (!stateRow) {
    throw new Error(
      "Google authorization has expired or was already used.",
    );
  }

  const update = await dbQuery(
    `
      UPDATE calendar_oauth_states
      SET consumed_at = NOW()
      WHERE id = ?
        AND consumed_at IS NULL
    `,
    [stateRow.id],
  );

  if (!update.affectedRows) {
    throw new Error(
      "Google authorization has expired or was already used.",
    );
  }

  return {
    userId: stateRow.user_id,
    codeVerifier: decryptCalendarSecret(
      stateRow.encrypted_code_verifier,
    ),
  };
}

async function exchangeGoogleCode(code, codeVerifier) {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return parseProviderResponse(response);
}

async function getGoogleAccountEmail(accessToken) {
  const response = await fetch(GOOGLE_USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const profile = await parseProviderResponse(response);

  return cleanText(profile?.email) || null;
}

async function saveGoogleConnection(
  dbQuery,
  {
    userId,
    tokens,
    accountEmail,
  },
) {
  const existingRows = await dbQuery(
    `
      SELECT encrypted_refresh_token
      FROM calendar_provider_connections
      WHERE user_id = ?
        AND provider = 'google'
      LIMIT 1
    `,
    [userId],
  );

  const existing = existingRows?.[0];
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + Number(tokens.expires_in) * 1000)
    : null;

  const refreshToken = tokens.refresh_token
    ? encryptCalendarSecret(tokens.refresh_token)
    : existing?.encrypted_refresh_token || null;

  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token. Disconnect Telefya in Google Account permissions, then connect again.",
    );
  }

  await dbQuery(
    `
      INSERT INTO calendar_provider_connections
      (
        user_id,
        provider,
        provider_account_email,
        calendar_id,
        encrypted_access_token,
        encrypted_refresh_token,
        token_expires_at,
        granted_scopes,
        status,
        last_error,
        last_synced_at
      )
      VALUES
      (
        ?, 'google', ?, 'primary', ?, ?, ?, ?, 'active', NULL, NOW()
      )
      ON DUPLICATE KEY UPDATE
        provider_account_email = VALUES(provider_account_email),
        calendar_id = 'primary',
        encrypted_access_token = VALUES(encrypted_access_token),
        encrypted_refresh_token = VALUES(encrypted_refresh_token),
        token_expires_at = VALUES(token_expires_at),
        granted_scopes = VALUES(granted_scopes),
        status = 'active',
        last_error = NULL,
        last_synced_at = NOW()
    `,
    [
      userId,
      accountEmail,
      encryptCalendarSecret(tokens.access_token),
      refreshToken,
      expiresAt ? toMysqlDateTime(expiresAt) : null,
      JSON.stringify(
        String(tokens.scope || GOOGLE_CALENDAR_SCOPE).split(" "),
      ),
    ],
  );
}

async function processGoogleCallbackService(dbQuery, query) {
  const providerError = cleanText(query?.error);

  const consumed = await consumeGoogleState(
    dbQuery,
    query?.state,
  );

  if (providerError) {
    return {
      redirectUrl: buildCallbackUrl(
        "google_denied",
        cleanText(query?.error_description, providerError),
      ),
    };
  }

  const code = cleanText(query?.code);

  if (!code) {
    throw new Error("Google did not return an authorization code.");
  }

  const tokens = await exchangeGoogleCode(
    code,
    consumed.codeVerifier,
  );

  if (!tokens?.access_token) {
    throw new Error("Google did not return an access token.");
  }

  const accountEmail = await getGoogleAccountEmail(
    tokens.access_token,
  );

  await saveGoogleConnection(dbQuery, {
    userId: consumed.userId,
    tokens,
    accountEmail,
  });

  return {
    redirectUrl: buildCallbackUrl("google_connected"),
    userId: consumed.userId,
  };
}

async function getGoogleAccessTokenService(dbQuery, userId) {
  const rows = await dbQuery(
    `
      SELECT *
      FROM calendar_provider_connections
      WHERE user_id = ?
        AND provider = 'google'
        AND status = 'active'
      LIMIT 1
    `,
    [userId],
  );

  const connection = rows?.[0];

  if (!connection) {
    return null;
  }

  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;

  const needsRefresh =
    !expiresAt || expiresAt <= Date.now() + 60_000;

  if (!needsRefresh) {
    return {
      connection,
      accessToken: decryptCalendarSecret(
        connection.encrypted_access_token,
      ),
    };
  }

  const { clientId, clientSecret } = getGoogleConfig();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: decryptCalendarSecret(
      connection.encrypted_refresh_token,
    ),
  });

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const tokens = await parseProviderResponse(response);

    const expiresAt = new Date(
      Date.now() + Number(tokens.expires_in || 3600) * 1000,
    );

    await dbQuery(
      `
        UPDATE calendar_provider_connections
        SET
          encrypted_access_token = ?,
          encrypted_refresh_token = COALESCE(?, encrypted_refresh_token),
          token_expires_at = ?,
          status = 'active',
          last_error = NULL
        WHERE id = ?
      `,
      [
        encryptCalendarSecret(tokens.access_token),
        tokens.refresh_token
          ? encryptCalendarSecret(tokens.refresh_token)
          : null,
        toMysqlDateTime(expiresAt),
        connection.id,
      ],
    );

    return {
      connection: {
        ...connection,
        token_expires_at: toMysqlDateTime(expiresAt),
      },
      accessToken: tokens.access_token,
    };
  } catch (error) {
    await dbQuery(
      `
        UPDATE calendar_provider_connections
        SET
          status = 'error',
          last_error = ?
        WHERE id = ?
      `,
      [
        String(error?.message || "Google token refresh failed.").slice(
          0,
          500,
        ),
        connection.id,
      ],
    );

    throw new Error(
      "Google Calendar connection needs to be reconnected.",
    );
  }
}

async function listCalendarConnectionsService(dbQuery, userId) {
  const rows = await dbQuery(
    `
      SELECT
        id,
        provider,
        provider_account_email,
        calendar_id,
        status,
        last_error,
        last_synced_at,
        created_at,
        updated_at
      FROM calendar_provider_connections
      WHERE user_id = ?
      ORDER BY provider ASC
    `,
    [userId],
  );

  return {
    success: true,
    data: (rows || []).map((row) => ({
      id: Number(row.id),
      provider: row.provider,
      accountEmail: row.provider_account_email,
      calendarId: row.calendar_id,
      status: row.status,
      lastError: row.last_error,
      lastSyncedAt: row.last_synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

async function disconnectGoogleCalendarService(dbQuery, userId) {
  const result = await dbQuery(
    `
      DELETE FROM calendar_provider_connections
      WHERE user_id = ?
        AND provider = 'google'
    `,
    [userId],
  );

  return {
    success: true,
    message: result.affectedRows
      ? "Google Calendar disconnected."
      : "Google Calendar was not connected.",
  };
}

module.exports = {
  buildCallbackUrl,
  createGoogleAuthorizationService,
  processGoogleCallbackService,
  getGoogleAccessTokenService,
  listCalendarConnectionsService,
  disconnectGoogleCalendarService,
};