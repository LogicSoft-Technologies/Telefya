const crypto = require("crypto");

function getEncryptionKey() {
  const raw = String(
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || "",
  ).trim();

  const key = Buffer.from(raw, "base64");

  if (key.length !== 32) {
    throw new Error(
      "CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }

  return key;
}

function encryptCalendarSecret(value) {
  const plainText = String(value || "");

  if (!plainText) {
    throw new Error("Cannot encrypt an empty value.");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptCalendarSecret(value) {
  const [version, ivText, tagText, encryptedText] = String(
    value || "",
  ).split(".");

  if (
    version !== "v1" ||
    !ivText ||
    !tagText ||
    !encryptedText
  ) {
    throw new Error("Stored calendar credential is invalid.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivText, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function hashCalendarState(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function createPkcePair() {
  const verifier = crypto.randomBytes(48).toString("base64url");

  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return { verifier, challenge };
}

module.exports = {
  encryptCalendarSecret,
  decryptCalendarSecret,
  hashCalendarState,
  createPkcePair,
};