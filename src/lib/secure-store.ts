import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("Falta definir AUTH_SECRET en .env.local");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string) {
  const [ivSegment, authTagSegment, encryptedSegment] = value.split(".");

  if (!ivSegment || !authTagSegment || !encryptedSegment) {
    throw new Error("El secreto cifrado es inválido.");
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivSegment, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagSegment, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedSegment, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
