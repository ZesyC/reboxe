export type ListingSpec = { label: string; value: string };

/** Splits an optional `[CHI TIẾT] ... [MÔ TẢ] ...` listing description into spec rows and body text. */
export function parseListingDescription(
  raw: string | undefined | null,
  fallback: string
): { extraSpecs: ListingSpec[]; body: string } {
  const trimmed = raw?.trim();
  if (!trimmed) return { extraSpecs: [], body: fallback };
  if (!trimmed.startsWith("[CHI TIẾT]")) return { extraSpecs: [], body: trimmed };

  const afterHeader = trimmed.slice("[CHI TIẾT]".length);
  const bodyIndex = afterHeader.indexOf("[MÔ TẢ]");
  const specBlock = bodyIndex === -1 ? afterHeader : afterHeader.slice(0, bodyIndex);
  const bodyBlock = bodyIndex === -1 ? "" : afterHeader.slice(bodyIndex + "[MÔ TẢ]".length).trim();

  const extraSpecs: ListingSpec[] = [];
  for (const line of specBlock.split("\n")) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const label = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (label && value) extraSpecs.push({ label, value });
  }

  return { extraSpecs, body: bodyBlock || fallback };
}
