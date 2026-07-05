export interface TransferLike {
  id: string;
  type: "receita" | "despesa";
  transfer_id?: string | null;
  is_internal_transfer?: boolean | null;
}

export function splitContextNeutralTransfers<T extends TransferLike>(rows: T[]) {
  const groups = new Map<string, T[]>();

  rows.forEach((row) => {
    if (!row.transfer_id || row.is_internal_transfer !== true) return;
    const group = groups.get(row.transfer_id) ?? [];
    group.push(row);
    groups.set(row.transfer_id, group);
  });

  const excludedIds = new Set<string>();
  groups.forEach((group) => {
    const hasRevenue = group.some((row) => row.type === "receita");
    const hasExpense = group.some((row) => row.type === "despesa");

    if (hasRevenue && hasExpense) {
      group.forEach((row) => excludedIds.add(row.id));
    }
  });

  return {
    included: rows.filter((row) => !excludedIds.has(row.id)),
    excluded: rows.filter((row) => excludedIds.has(row.id)),
  };
}