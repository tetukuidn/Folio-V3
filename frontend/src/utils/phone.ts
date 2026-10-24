export function normalizeWA(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  let s = digits;
  if (s.startsWith("62")) s = s.slice(2);
  while (s.startsWith("0")) s = s.slice(1);
  return "62" + s;
}

export function displayWA(raw: string): string {
  const n = normalizeWA(raw);
  if (!n) return "";
  return "+" + n;
}
