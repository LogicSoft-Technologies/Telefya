const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

const envOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([...defaultAllowedOrigins, ...envOrigins]),
);

function normalizeOrigin(origin) {
  return String(origin || "")
    .trim()
    .replace(/\/+$/, "");
}

function isOriginAllowed(origin) {
  /*
   * Requests without an Origin header are allowed for backend tools,
   * server-to-server calls, health checks, and mobile/native clients.
   */
  if (!origin) return true;

  const cleanOrigin = normalizeOrigin(origin);

  return allowedOrigins.some(
    (allowedOrigin) =>
      normalizeOrigin(allowedOrigin) === cleanOrigin,
  );
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`Not allowed by CORS: ${origin}`),
    );
  },

  credentials: true,
  optionsSuccessStatus: 200,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
};

module.exports = {
  corsOptions,
  allowedOrigins,
  isOriginAllowed,
};