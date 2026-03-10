export const DEFAULT_EXTERNAL_BUTTON_LABEL = "Zur Originalseite";
export const DEFAULT_CARD_IMAGE_SCALE = 1;

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

export function normalizeCardImageScale(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_CARD_IMAGE_SCALE;
  }

  return Math.min(2.4, Math.max(1, Math.round(parsed * 100) / 100));
}

export function buildCardImageStyle(scale) {
  return {
    transform: `scale(${normalizeCardImageScale(scale)})`,
    transformOrigin: "center center"
  };
}

export function isEditorColumnMissingError(error) {
  return /detail_sections|external_button_label|card_image_url|card_image_scale|intro_text|platform_label|type_label|feed_order/i.test(
    error?.message || ""
  );
}
