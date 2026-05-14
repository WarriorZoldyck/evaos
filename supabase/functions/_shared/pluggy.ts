// Shared Pluggy API helpers
const PLUGGY_BASE = "https://api.pluggy.ai";

export async function getPluggyApiKey(): Promise<string> {
  const clientId = Deno.env.get("PLUGGY_CLIENT_ID");
  const clientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("Pluggy não configurado (PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET ausentes)");
  }
  const res = await fetch(`${PLUGGY_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pluggy /auth falhou: HTTP ${res.status} — ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  if (!j?.apiKey) throw new Error("Pluggy /auth sem apiKey");
  return j.apiKey as string;
}

export async function pluggyGet(path: string, apiKey: string) {
  const res = await fetch(`${PLUGGY_BASE}${path}`, {
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pluggy GET ${path} -> HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export async function pluggyPost(path: string, apiKey: string, body: unknown) {
  const res = await fetch(`${PLUGGY_BASE}${path}`, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Pluggy POST ${path} -> HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  return res.json();
}

export async function pluggyDelete(path: string, apiKey: string) {
  const res = await fetch(`${PLUGGY_BASE}${path}`, {
    method: "DELETE",
    headers: { "X-API-KEY": apiKey },
  });
  // 404 is fine: already removed
  if (!res.ok && res.status !== 404) {
    const txt = await res.text();
    throw new Error(`Pluggy DELETE ${path} -> HTTP ${res.status} ${txt.slice(0, 200)}`);
  }
  return res.status;
}

// Itaú connector ids on Pluggy (PF + PJ Open Finance)
export const ITAU_CONNECTOR_IDS = [201, 218];

export const PLUGGY_BASE_URL = PLUGGY_BASE;
