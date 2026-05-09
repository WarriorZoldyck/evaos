// AES-GCM encryption for Asaas user API keys.
// Key is derived from ASAAS_KEY_ENCRYPTION_SECRET via SHA-256.

async function getKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("ASAAS_KEY_ENCRYPTION_SECRET");
  if (!secret) throw new Error("ASAAS_KEY_ENCRYPTION_SECRET not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptApiKey(plain: string): Promise<{ encrypted: string; iv: string }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return { encrypted: toB64(ct), iv: toB64(iv) };
}

export async function decryptApiKey(encrypted: string, iv: string): Promise<string> {
  const key = await getKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) },
    key,
    fromB64(encrypted),
  );
  return new TextDecoder().decode(pt);
}
