/**
 * Maps raw Supabase/database errors to safe, user-friendly messages.
 * Prevents leaking schema details (table names, constraints, etc.) to clients.
 */
export function mapDatabaseError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Ocorreu um erro inesperado.";

  const code = error.code;

  if (code === "23505") return "Este registro já existe.";
  if (code === "23503") return "Operação não permitida: existem dados relacionados.";
  if (code === "23502") return "Dados obrigatórios não foram preenchidos.";
  if (code === "23514") return "Os dados fornecidos são inválidos.";
  if (code === "42501") return "Você não tem permissão para esta operação.";
  if (code === "PGRST116") return "Registro não encontrado.";
  if (code === "PGRST301") return "Sessão expirada. Faça login novamente.";

  return "Ocorreu um erro. Tente novamente.";
}
