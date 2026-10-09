/** True for MongoDB's duplicate-key error (E11000), optionally on a given field. */
export function isDuplicateKey(err: unknown, field?: string): boolean {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  return e?.code === 11000 && (!field || !!e.keyPattern?.[field]);
}
