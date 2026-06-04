// Lightweight, dependency-free input checks shared by forms.

// Pragmatic email check: a non-empty local part, an "@", a domain with at
// least one dot, and no whitespace. Intentionally permissive — it rejects
// obvious typos without trying to fully implement RFC 5322.
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}
