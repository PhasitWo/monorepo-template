/** `{ field: [old, new] }` */
export type AuditDiff = Record<string, [unknown, unknown]>;

export const REDACTED = '[REDACTED]';

/** Fields that never appear in a diff: system-managed and noisy. */
const ALWAYS_EXCLUDED = ['createdAt', 'updatedAt', 'deletedAt', 'runningId', 'runningCode'];
/** Fields whose values must never be stored. */
const ALWAYS_REDACTED = ['password'];

export interface ComputeDiffOptions {
  exclude?: string[];
  redact?: string[];
}

type Snapshot = Record<string, unknown>;

function normalize(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  // JSON round-trip turns Dates (including nested ones) into ISO strings
  return JSON.parse(JSON.stringify(value));
}

/** Returns `{ field: [old, new] }` for every field whose value changed. */
export function computeDiff(before: object, after: object, options: ComputeDiffOptions = {}): AuditDiff {
  const excluded = new Set([...ALWAYS_EXCLUDED, ...(options.exclude ?? [])]);
  const redacted = new Set([...ALWAYS_REDACTED, ...(options.redact ?? [])]);
  const b = before as Snapshot;
  const a = after as Snapshot;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);

  const diff: AuditDiff = {};
  for (const key of keys) {
    if (excluded.has(key)) continue;
    const oldValue = normalize(b[key]);
    const newValue = normalize(a[key]);
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    diff[key] = redacted.has(key) ? [REDACTED, REDACTED] : [oldValue, newValue];
  }
  return diff;
}
