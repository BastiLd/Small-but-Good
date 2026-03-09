function normalizeBase(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function normalizeProjectName(value) {
  return normalizeBase(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProjectUrl(value) {
  const normalized = normalizeBase(value)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");

  return normalized.replace(/\s+/g, "");
}

export function getDuplicateSubmissionMatches(candidate, rows, ignoreId = null) {
  const nameKey = normalizeProjectName(candidate?.project_name);
  const urlKey = normalizeProjectUrl(candidate?.website_url);

  if (!nameKey && !urlKey) {
    return [];
  }

  return (rows || [])
    .filter((row) => row?.id && row.id !== ignoreId)
    .map((row) => {
      const matchesName = Boolean(nameKey) && normalizeProjectName(row.project_name) === nameKey;
      const matchesUrl = Boolean(urlKey) && normalizeProjectUrl(row.website_url) === urlKey;

      if (!matchesName && !matchesUrl) {
        return null;
      }

      return {
        ...row,
        matchesName,
        matchesUrl
      };
    })
    .filter(Boolean);
}

export function annotateDuplicateSubmissions(rows, allRows = rows) {
  return (rows || []).map((row) => {
    const matches = getDuplicateSubmissionMatches(row, allRows, row.id);
    const reasons = [];

    if (matches.some((match) => match.matchesName)) {
      reasons.push("gleicher Projektname");
    }

    if (matches.some((match) => match.matchesUrl)) {
      reasons.push("gleiche Website oder gleicher Kanal");
    }

    return {
      ...row,
      duplicateMatches: matches,
      duplicateCount: matches.length,
      duplicateReasons: reasons,
      duplicateSummary: reasons.length
        ? `Mögliche Dublette: ${reasons.join(" und ")}`
        : null
    };
  });
}
