// utils/crypto.ts
import crypto from "crypto";

// These should come from process.env in production
const ALGORITHM = "aes-256-cbc";
const SECRET_KEY = process.env.API_KEY_SECRET || "my-super-secret-key-32bytes!"; // must be 32 chars
const IV_LENGTH = 16; // AES block size

const getSecretKey = (): Buffer => {
  return crypto
    .createHash("sha256")
    .update(process.env.API_KEY_SECRET || "default_secret")
    .digest();
};

export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex"); // store IV with ciphertext
};

export const decrypt = (encryptedText: string): string => {
  try {
    if (!encryptedText || !encryptedText.includes(":")) {
      throw new Error("Invalid encrypted text format");
    }

    const [ivHex, encryptedHex] = encryptedText.split(":");

    if (!ivHex || !encryptedHex) {
      throw new Error("Invalid IV or encrypted data");
    }

    const iv = Buffer.from(ivHex, "hex");
    const encryptedTextBuffer = Buffer.from(encryptedHex, "hex");
    const secretKey = getSecretKey(); // Use the same hashed key

    const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv);
    let decrypted = decipher.update(encryptedTextBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error: any) {
    console.error("Decryption error:", error.message);
    throw new Error(`Decryption failed: ${error.message}`);
  }
};
