/** Require an exact configured secret; missing configuration must fail closed. */
export function hasSecret(provided: string | null, expected: string | undefined): boolean {
  return Boolean(expected && provided && provided === expected);
}

/** Storage object paths are rooted in the record owner's user ID. */
export function isOwnedKnowledgePath(path: unknown, ownerId: string): path is string {
  if (typeof path !== "string" || !path.startsWith(`${ownerId}/`)) return false;
  return path.split("/").every(part => part.length > 0 && part !== "." && part !== ".." && !/[\\%]/.test(part));
}

export function isCompanyOwner(company: { user_id: string } | null, userId: string): boolean {
  return company?.user_id === userId;
}