import {
  DEFAULT_EXTERNAL_BUTTON_LABEL,
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
    recordId: row.id,
    source: "submission",
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
    feedOrder: 1000,
    publishedAt: row?.approved_at || row?.created_at || null,
    contentSections,
    externalButtonLabel: resolveExternalButtonLabel(row?.external_button_label),
    features: [],
    commands: [],
    cardsPreview: [],
    dbTables: []
  };
}

function buildSeedSections(app) {
  const sections = [];
  const pushedOverview = new Set();

  if (app?.longDescription) {
    sections.push({
      id: `${app.id}-overview`,
      heading: "Über das Projekt",
      text: app.longDescription
    });
    pushedOverview.add("overview");
  }

  if (app?.detailBodyImage) {
    sections.push({
      id: `${app.id}-showcase`,
      heading: "Einblicke",
      text: app.shortDesc || "",
      imageUrl: app.detailBodyImage,
      imageAlt: app.detailBodyImageAlt || `${app.title} Vorschau`
    });
  }

  if ((app?.features || []).length) {
    sections.push({
      id: `${app.id}-features`,
      heading: "Hauptfunktionen",
      text: app.features.join("\n")
    });
  }

  if ((app?.commands || []).length) {
    sections.push({
      id: `${app.id}-commands`,
      heading: "Wichtige Befehle",
      text: app.commands
        .map((command) => `${command.signature || command.name} - ${command.desc || ""}`.trim())
        .join("\n")
    });
  }

  if ((app?.cardsPreview || []).length) {
    sections.push({
      id: `${app.id}-cards`,
      heading: "Beispielkarten",
      text: app.cardsPreview.join("\n")
    });
  }

  if ((app?.dbTables || []).length) {
    sections.push({
      id: `${app.id}-db`,
      heading: "Datenbank-Tabellen",
      text: app.dbTables.join("\n")
    });
  }

  if (!sections.length && app?.shortDesc && !pushedOverview.has("overview")) {
    sections.push({
      id: `${app.id}-summary`,
      heading: "Überblick",
      text: app.shortDesc
    });
  }

  return normalizeProjectSections(sections);
}

export function seedAppToApp(app, index = 0) {
  const previewImage = app?.screenshots?.[0] || PROJECT_PLACEHOLDER_IMAGE;
  const longDescription = app?.longDescription?.trim() || app?.shortDesc?.trim() || "Projekt";

  return {
    ...app,
    id: app.id,
    recordId: null,
    source: "app",
    runtimeId: app.runtimeId || app.id,
    itemSource: app.itemSource || "local",
    detailPath: app.detailPath || `/app/${app.id}`,
    screenshots: app.screenshots?.length ? app.screenshots : [previewImage],
    introImage: app.introImage || previewImage,
    introText: app.introText || longDescription,
    longDescription,
    contentSections: buildSeedSections(app),
    externalButtonLabel: resolveExternalButtonLabel(
      app.externalButtonLabel || DEFAULT_EXTERNAL_BUTTON_LABEL
    ),
    creatorSlug: app.creatorSlug || null,
    creatorDisplayName: app.creatorDisplayName || null,
    feedOrder: typeof app.feedOrder === "number" ? app.feedOrder : (index + 1) * 10,
    publishedAt: app.publishedAt || null
  };
}

export function appRowToApp(row) {
  const creatorSlug = row?.creator_slug || row?.creators?.slug || null;
  const creatorDisplayName =
    row?.creator_display_name || row?.creators?.display_name || row?.creators?.email || null;
  const shortDescription =
    row?.short_description?.trim() ||
    row?.long_description?.trim() ||
    row?.intro_text?.trim() ||
    "Projekt";
  const longDescription = row?.long_description?.trim() || shortDescription;
  const previewImage = row?.card_image_url?.trim() || PROJECT_PLACEHOLDER_IMAGE;

  return {
    id: row?.slug || row?.id,
    recordId: row?.id || null,
    source: "app",
    runtimeId: row?.slug || row?.id,
    itemSource: "local",
    detailPath: `/app/${row?.slug || row?.id}`,
    title: row?.name || "Projekt",
    shortDesc: shortDescription,
    longDescription,
    screenshots: [previewImage],
    introImage: previewImage,
    introText:
      row?.intro_text?.trim() ||
      row?.long_description?.trim() ||
      row?.short_description?.trim() ||
      shortDescription,
    platform: row?.platform || row?.category || "app",
    platformLabel: row?.platform_label || row?.platform || row?.category || "App",
    store_url: row?.website_url || "",
    type: row?.type || "app",
    typeLabel: row?.type_label || "Projekt",
    private: false,
    mediaFit: row?.card_image_url ? "cover" : "contain",
    mediaBleed: Boolean(row?.card_image_url),
    creatorSlug,
    creatorDisplayName,
    contentSections: normalizeProjectSections(row?.detail_sections),
    externalButtonLabel: resolveExternalButtonLabel(row?.external_button_label),
    feedOrder: typeof row?.feed_order === "number" ? row.feed_order : 100,
    publishedAt: row?.created_at || null,
    features: [],
    commands: [],
    cardsPreview: [],
    dbTables: []
  };
}

export function mergeFeedProjects(localApps = [], communityApps = []) {
  const normalizedLocalApps = [...localApps].sort((left, right) => {
    const leftOrder = typeof left?.feedOrder === "number" ? left.feedOrder : 100;
    const rightOrder = typeof right?.feedOrder === "number" ? right.feedOrder : 100;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return (left?.title || "").localeCompare(right?.title || "");
  });
  const normalizedCommunityApps = [...communityApps].sort((left, right) => {
    const rightDate = right?.publishedAt ? new Date(right.publishedAt).getTime() : 0;
    const leftDate = left?.publishedAt ? new Date(left.publishedAt).getTime() : 0;

    if (rightDate !== leftDate) {
      return rightDate - leftDate;
    }

    return (left?.title || "").localeCompare(right?.title || "");
  });

  return [...normalizedLocalApps, ...normalizedCommunityApps];
}
