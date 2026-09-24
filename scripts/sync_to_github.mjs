import fs from "fs";
import path from "path";
import https from "https";

const REPO_OWNER = "WarriorZoldyck";
const REPO_NAME = "evaos";

function apiRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || "GET",
      family: 4,
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => JSON.parse(body),
          text: async () => body,
        });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// List of modified files relative to repo root
const FILES_TO_SYNC = [
  "src/hooks/useDashboardData.ts",
  "src/components/dashboard/SummaryCards.tsx",
  "src/components/dashboard/EntradasSaidasDetailModal.tsx",
  "src/components/dashboard/UpcomingTransactions.tsx",
  "src/pages/Dashboard.tsx",
  "src/components/analises-eva/AdjustInterestModal.tsx",
  "src/components/ui/currency-input.tsx",
  "src/pages/AnalisesEva.tsx",
  "src/components/lancamentos/import/ReconcileStep.tsx",
  "src/components/lancamentos/ImportStatementModal.tsx",
  "src/components/lancamentos/TransactionTable.tsx",
  "src/lib/import/matching.ts",
  "src/components/ui/select.tsx",
  "src/components/lancamentos/CategorySelectWithCreate.tsx",
  "src/hooks/useSubscription.ts",
  "src/components/subscription/SubscriptionGuard.tsx",
  "src/pages/MinhaAssinatura.tsx",
  "supabase/functions/asaas-webhook/index.ts",
  "supabase/functions/asaas-sync-subscription/index.ts",
  "supabase/migrations/20260917000000_fix_paid_past_due_subscriptions.sql",
  "supabase/functions/parse-bank-statement/index.ts",
  "supabase/functions/_shared/ai-gateway.ts",
  "supabase/functions/_shared/eva-analysis.ts",
  "supabase/functions/whatsapp-webhook/index.ts",
  "supabase/functions/eva-chat/index.ts",
  "supabase/functions/goal-action-plan/index.ts",
  "supabase/functions/suggest-categories/index.ts",
];

export async function pushToGithub(token, branch = "main", commitMsg = "fix: migra whatsapp-webhook para Gemini nativo sem creditos Lovable") {
  if (!token) {
    throw new Error("GitHub Token é obrigatório para enviar as alterações.");
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "Antigravity-IDE-Sync",
  };

  console.log(`Buscando último commit da branch '${branch}' em ${REPO_OWNER}/${REPO_NAME}...`);
  const refRes = await apiRequest(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${branch}`,
    { headers }
  );

  if (!refRes.ok) {
    const err = await refRes.text();
    throw new Error(`Falha ao obter branch ${branch}: ${refRes.status} ${err}`);
  }

  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;
  console.log(`Commit base: ${latestCommitSha}`);

  // Create blobs for each file
  const treeItems = [];
  for (const relPath of FILES_TO_SYNC) {
    const fullPath = path.resolve(relPath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Arquivo não encontrado localmente: ${relPath}`);
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf-8");

    const blobRes = await apiRequest(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/blobs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          content,
          encoding: "utf-8",
        }),
      }
    );

    if (!blobRes.ok) {
      const err = await blobRes.text();
      throw new Error(`Falha ao criar blob para ${relPath}: ${err}`);
    }

    const blobData = await blobRes.json();
    treeItems.push({
      path: relPath.replace(/\\/g, "/"),
      mode: "100644",
      type: "blob",
      sha: blobData.sha,
    });
    console.log(`✓ Preparado: ${relPath}`);
  }

  console.log("Criando nova árvore Git...");
  const treeRes = await apiRequest(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        base_tree: latestCommitSha,
        tree: treeItems,
      }),
    }
  );

  if (!treeRes.ok) {
    const err = await treeRes.text();
    throw new Error(`Falha ao criar árvore Git: ${err}`);
  }

  const treeData = await treeRes.json();

  console.log("Criando commit...");
  const commitRes = await apiRequest(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: commitMsg,
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    }
  );

  if (!commitRes.ok) {
    const err = await commitRes.text();
    throw new Error(`Falha ao criar commit: ${err}`);
  }

  const commitData = await commitRes.json();
  const newCommitSha = commitData.sha;
  console.log(`Commit criado com sucesso: ${newCommitSha}`);

  console.log(`Atualizando branch '${branch}'...`);
  const updateRes = await apiRequest(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${branch}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        sha: newCommitSha,
        force: false,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.text();
    throw new Error(`Falha ao atualizar branch: ${err}`);
  }

  console.log(`\n🎉 SUCESSO! Branch '${branch}' atualizada em ${REPO_OWNER}/${REPO_NAME}.`);
  console.log(`O Lovable/deploy irá sincronizar automaticamente!`);
  return commitData;
}

const token = process.argv[2] || process.env.GITHUB_TOKEN;
const branch = process.argv[3] || "main";
const commitMsg = process.argv[4] || "fix: migra whatsapp-webhook para Gemini nativo sem creditos Lovable";
if (token) {
  pushToGithub(token, branch, commitMsg).catch((err) => {
    console.error("Erro no envio:", err.message || err);
    process.exit(1);
  });
} else {
  console.log("Uso: node scripts/sync_to_github.mjs <GITHUB_TOKEN> [BRANCH] [COMMIT_MSG]");
}


