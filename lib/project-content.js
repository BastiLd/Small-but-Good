export const DEFAULT_EXTERNAL_BUTTON_LABEL = "Zur Originalseite";

function normalizeSectionText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function createProjectSection() {
  return {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `section-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    heading: "",
    text: "",
    imageUrl: "",
    imageAlt: ""
  };
}

export function normalizeProjectSections(rawSections) {
  let sections = rawSections;

  if (typeof sections === "string") {
    try {
      sections = JSON.parse(sections);
    } catch {
      sections = [];
    }
  }

  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.map((section, index) => ({
    id:
      normalizeSectionText(section?.id) ||
      `section-${index}-${Math.random().toString(16).slice(2, 10)}`,
    heading: normalizeSectionText(section?.heading),
    text: typeof section?.text === "string" ? section.text.trim() : "",
    imageUrl: normalizeSectionText(section?.imageUrl),
    imageAlt: normalizeSectionText(section?.imageAlt)
  }));
}

export function serializeProjectSections(sections) {
  return normalizeProjectSections(sections).filter(
    (section) => section.heading || section.text || section.imageUrl
  );
}

export function resolveExternalButtonLabel(label) {
  return normalizeSectionText(label) || DEFAULT_EXTERNAL_BUTTON_LABEL;
}

export function isEditorColumnMissingError(error) {
  return /detail_sections|external_button_label/i.test(error?.message || "");
}
