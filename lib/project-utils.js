import {
  normalizeProjectSections,
  resolveExternalButtonLabel
} from "./project-content";

const PROJECT_PLACEHOLDER_IMAGE = "/images/project-placeholder.svg";

export function slugify(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildSubmissionSlug(row) {
  const baseSlug = slugify(row?.project_name) || "projekt";
  const suffix = (row?.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();

  if (row?.public_slug) {
    return row.public_slug;
  }

  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
}

export function submissionToApp(row) {
  const projectDescription = row?.description?.trim() || "Community-Projekt";
  const introText =
    row?.intro_text?.trim() || row?.approved_intro_text?.trim() || projectDescription;
  const previewImage = row?.card_image_url?.trim() || PROJECT_PLACEHOLDER_IMAGE;
  const runtimeSlug = row?.slug || buildSubmissionSlug(row);
  const contentSections = normalizeProjectSections(row?.detail_sections);

  return {
    id: `submission-${row.id}`,
    runtimeId: runtimeSlug,
    itemSource: "submission",
    detailPath: `/projekte/${runtimeSlug}`,
    title: row.project_name,
    shortDesc: projectDescription,
    longDescription: projectDescription,
    screenshots: [previewImage],
    introImage: previewImage,
    introText,
    platform: "community",
    platformLabel: "Community",
    store_url: row.website_url || "",
    type: "submitted_project",
    typeLabel: "Freigegeben",
    private: false,
    mediaFit: row?.card_image_url ? "cover" : "contain",
    mediaBleed: Boolean(row?.card_image_url),
    creatorSlug: row?.creator_slug || null,
    creatorDisplayName: row?.creator_display_name || null,
    contentSections,
    externalButtonLabel: resolveExternalButtonLabel(row?.external_button_label),
    features: [],
    commands: [],
    cardsPreview: [],
    dbTables: []
  };
}
