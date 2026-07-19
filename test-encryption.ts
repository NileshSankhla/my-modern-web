import { encrypt, decrypt } from "./src/lib/security/encryption";

try {
  console.log("Testing encryption...");
  const payload = encrypt("Hello World");
  console.log("Encrypted:", payload);
  const decrypted = decrypt(payload.encrypted);
  console.log("Decrypted:", decrypted);
} catch (e) {
  console.error("Error:", e instanceof Error ? e.message : String(e));
}
