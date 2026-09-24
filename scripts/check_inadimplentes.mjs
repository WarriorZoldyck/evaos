import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env
const envPath = path.resolve(".env");
const envVars = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m) {
      let val = m[2] || "";
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[m[1]] = val;
    }
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || "https://rrrnnrjefyffllnrwhkz.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.log(JSON.stringify({
    error: "MISSING_SERVICE_ROLE_KEY",
    message: "SUPABASE_SERVICE_ROLE_KEY não encontrada no .env",
  }));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function main() {
  // 1. Buscar assinaturas past_due, canceled ou expired
  const { data: subs, error: subErr } = await supabase
    .from("subscriptions")
    .select("*, plan:subscription_plans(name, price_cents)")
    .in("status", ["past_due", "canceled", "expired"])
    .order("updated_at", { ascending: false });

  if (subErr) {
    console.error("Erro ao buscar assinaturas:", subErr);
    process.exit(1);
  }

  // 2. Buscar usuários do auth
  const { data: usersData, error: userErr } = await supabase.auth.admin.listUsers();
  const userMap = new Map();
  if (usersData?.users) {
    for (const u of usersData.users) {
      userMap.set(u.id, u.email || u.phone || u.id);
    }
  }

  const now = Date.now();
  const results = [];

  for (const s of (subs || [])) {
    const email = userMap.get(s.user_id) || "Email não encontrado";
    const hasRecentPayment = s.last_payment_at && (now - new Date(s.last_payment_at).getTime() < 35 * 24 * 60 * 60 * 1000);
    const hasFutureDueDate = s.next_due_date && (new Date(s.next_due_date).getTime() >= new Date().setHours(0, 0, 0, 0));
    const isGraceActive = s.grace_until && new Date(s.grace_until).getTime() > now;

    let categoria = "Outro";
    let detalhe = "";

    if (s.status === "past_due") {
      if (hasRecentPayment || hasFutureDueDate) {
        categoria = "Falso Positivo (Pago / Regular)";
        detalhe = hasRecentPayment
          ? `Último pagamento em ${s.last_payment_at.slice(0, 10)}`
          : `Vencimento futuro em ${s.next_due_date}`;
      } else if (isGraceActive) {
        categoria = "Inadimplente (Vendo aviso de bloqueio)";
        detalhe = `Carência até ${s.grace_until.slice(0, 10)}`;
      } else {
        categoria = "Inadimplente (Bloqueado)";
        detalhe = `Carência expirou em ${s.grace_until ? s.grace_until.slice(0, 10) : "sem data"}`;
      }
    } else if (s.status === "canceled") {
      categoria = "Cancelado";
      detalhe = `Cancelado em ${s.canceled_at ? s.canceled_at.slice(0, 10) : "-"}`;
    } else if (s.status === "expired") {
      categoria = "Expirado";
      detalhe = "Assinatura expirada";
    }

    results.push({
      email,
      plano: s.plan?.name || "Sem plano",
      status_banco: s.status,
      categoria,
      detalhe,
      asaas_id: s.asaas_subscription_id || "Sem ID Asaas",
      ultimo_pagamento: s.last_payment_at ? s.last_payment_at.slice(0, 10) : "Nenhum",
      proximo_vencimento: s.next_due_date || "-",
    });
  }

  console.log(JSON.stringify({
    total_analisados: subs?.length || 0,
    clientes: results,
  }, null, 2));
}

main();
