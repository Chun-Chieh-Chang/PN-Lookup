export function parseAlternates(raw: string, selfPartNo?: string): string[] | undefined {
  const list = raw
    .split(/[,、;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return dedupeAlternates(list, selfPartNo);
}

export function dedupeAlternates(list: string[], selfPartNo?: string): string[] | undefined {
  const out: string[] = [];
  const seen = new Set<string>();
  const self = selfPartNo?.trim().toUpperCase();
  for (const a of list) {
    const key = a.trim().toUpperCase();
    if (!key || key === self) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a.trim());
  }
  return out.length > 0 ? out : undefined;
}
