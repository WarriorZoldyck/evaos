import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTransactions from "./tools/list-transactions";
import createTransaction from "./tools/create-transaction";
import listAccounts from "./tools/list-accounts";
import listCategories from "./tools/list-categories";
import financialSummary from "./tools/financial-summary";

// Direct supabase.co issuer required (not the .lovable.cloud proxy).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "eva-os-mcp",
  title: "EVA OS",
  version: "0.1.0",
  instructions:
    "Ferramentas para gestão financeira no EVA OS. Use list_accounts e list_categories para descobrir IDs antes de criar lançamentos. " +
    "Use financial_summary para relatórios de período e list_transactions para consultas detalhadas.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTransactions, createTransaction, listAccounts, listCategories, financialSummary],
});
