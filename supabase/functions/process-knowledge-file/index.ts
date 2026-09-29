import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchAiCompletions } from "../_shared/ai-gateway.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function docxToText(bytes: Uint8Array): Promise<string> {
  const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  return xml.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "Não autorizado" }, 401);

  const { id } = await req.json().catch(() => ({}));
  if (!id) return json({ error: "id obrigatório" }, 400);

  // RLS check: caller must be able to see the row
  const { data: row } = await userClient.from("eva_knowledge").select("*").eq("id", id).maybeSingle();
  if (!row) return json({ error: "Arquivo não encontrado" }, 404);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const setStatus = (patch: Record<string, unknown>) => admin.from("eva_knowledge").update(patch).eq("id", id);
  await setStatus({ status: "processing", error: null });

  try {
    const { data: blob, error: dlErr } = await admin.storage.from("eva-knowledge").download(row.file_path);
    if (dlErr || !blob) throw new Error("Não foi possível ler o arquivo.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const name = row.file_name.toLowerCase();
    let text = "";

    if (name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".md")) {
      text = new TextDecoder().decode(bytes);
    } else if (name.endsWith(".docx")) {
      text = await docxToText(bytes);
    } else if (name.endsWith(".pdf")) {
      const res = await fetchAiCompletions({
        messages: [{
          role: "user",
          content: [
            { type: "file", file: { filename: "doc.pdf", file_data: `data:application/pdf;base64,${toBase64(bytes)}` } },
            { type: "text", text: "Transcreva integralmente o texto deste documento, preservando tabelas (como linhas com separador |), valores e preços. Responda apenas com o texto." },
          ],
        }],
      });
      if (!res.ok) throw new Error("Falha ao ler o PDF com a IA.");
      const j = await res.json();
      text = j?.choices?.[0]?.message?.content || "";
    } else {
      throw new Error("Formato não suportado. Use PDF, TXT, CSV ou DOCX.");
    }

    text = text.trim();
    if (!text) throw new Error("Não foi encontrado texto no arquivo.");
    await setStatus({ status: "active", content: text.slice(0, 100000), error: null });
    return json({ ok: true, chars: text.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao processar arquivo.";
    console.error("[process-knowledge-file]", msg);
    await setStatus({ status: "error", error: msg });
    return json({ ok: false, error: msg });
  }
});
