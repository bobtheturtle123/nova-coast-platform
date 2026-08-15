// Shared display formatters for tenant-facing public pages (property websites,
// booking flow, pricing). Keep these pure and defensive: they receive whatever
// a studio or agent typed and must never throw or mangle already-formatted or
// non-numeric input.

/**
 * Money → "$1,100,200" (US grouping, no cents by default).
 *
 * Accepts a number or a string. If the value isn't a clean number (e.g.
 * "Contact for price", "$1.1M", "Call for pricing"), it's returned unchanged so
 * an agent's intentional wording is preserved.
 */
export function formatMoney(value, { showCents = false } = {}) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return "$" + value.toLocaleString("en-US", {
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  }
  const str = String(value).trim();
  const cleaned = str.replace(/[$,\s]/g, "");
  // Only reformat when the whole thing is a plain number — otherwise pass
  // through (handles "$1.1M", "Contact for price", ranges like "800-900").
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return str;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return str;
  const hasCents = showCents || /\.\d\d?$/.test(cleaned);
  return "$" + num.toLocaleString("en-US", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
}

// Light international grouping for numbers that carry an explicit "+" country
// code. Not a full libphonenumber — it keeps the country code separate and
// groups the rest in readable 3–4 digit runs. NANP (+1) gets the familiar
// "(XXX) XXX-XXXX" shape.
function formatInternational(digits) {
  if (digits.startsWith("1") && digits.length === 11) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  // Assume a 1–3 digit country code, then group the national number.
  const cc = digits.slice(0, digits.length > 11 ? 3 : digits.length > 10 ? 2 : 1);
  const rest = digits.slice(cc.length);
  const groups = rest.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  return `+${cc} ${groups}`.trim();
}

/**
 * Phone → dashed/grouped per the number's country system.
 *
 * - A leading "+" is treated as an explicit international code and grouped as such.
 * - Otherwise we format by `country` (the studio's country; defaults to US).
 *   US/CA use the North American "(XXX) XXX-XXXX".
 * - Anything we can't confidently format is returned as typed (never mangled).
 */
export function formatPhone(raw, country = "US") {
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (!str) return "";
  const digits = str.replace(/\D/g, "");
  if (!digits) return str;

  if (str.startsWith("+")) return formatInternational(digits);

  const c = String(country || "US").toUpperCase();

  // North American Numbering Plan
  if (c === "US" || c === "CA" || c === "USA" || c === "CAN") {
    let d = digits;
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 7)  return `${d.slice(0, 3)}-${d.slice(3)}`;
    return str;
  }
  // United Kingdom: "0XXXX XXXXXX"
  if (c === "GB" || c === "UK") {
    if (digits.length === 11 && digits[0] === "0") return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    return str;
  }
  // Australia: "XXXX XXX XXX"
  if (c === "AU" || c === "AUS") {
    if (digits.length === 10) return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    return str;
  }

  // Generic fallback: a 10-digit local number reads fine in NANP grouping;
  // otherwise leave the studio's own formatting alone.
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return str;
}
