import { APPS } from "./apps";
import { appRowToApp, seedAppToApp } from "./project-utils";
import { getPublicSupabaseClient } from "./supabase-public";

const publicAppSelect = [
  "id",
  "slug",
  "name",
  "short_description",
  "long_description",
  "intro_text",
  "website_url",
  "card_image_url",
  "card_image_scale",
  "detail_sections",
  "external_button_label",
  "platform",
  "platform_label",
  "type",
  "type_label",
  "feed_order",
  "created_at",
  "creator_slug",
  "creator_display_name"
].join(", ");
const legacyPublicAppSelect = [
  "id",
  "slug",
  "name",
  "short_description",
  "long_description",
  "intro_text",
  "website_url",
  "card_image_url",
  "detail_sections",
  "external_button_label",
  "platform",
  "platform_label",
  "type",
  "type_label",
  "feed_order",
  "created_at",
  "creator_slug",
  "creator_display_name"
].join(", ");

function getFallbackApps() {
  return APPS.map((app, index) => seedAppToApp(app, index));
}

async function fetchAppRows(filters = {}) {
  const client = getPublicSupabaseClient();

  if (!client) {
    return [];
  }

  const runQuery = async (selectClause) => {
    let query = client.from("public_apps").select(selectClause);

    if (filters.slug) {
      query = query.eq("slug", filters.slug);
    }

    return query.order("feed_order", { ascending: true });
  };

  let response = await runQuery(publicAppSelect);

  if (response.error && /card_image_scale/i.test(response.error.message || "")) {
    response = await runQuery(legacyPublicAppSelect);
  }

  if (response.error || !response.data) {
    return [];
  }

  return response.data;
}

export async function fetchServerPublicApps() {
  const rows = await fetchAppRows();
  return rows.length ? rows.map(appRowToApp) : getFallbackApps();
}

export async function fetchServerPublicAppBySlug(slug) {
  const rows = await fetchAppRows({ slug });

  if (rows.length) {
    return appRowToApp(rows[0]);
  }

  const fallbackIndex = APPS.findIndex((app) => app.id === slug || app.runtimeId === slug);

  if (fallbackIndex >= 0) {
    return seedAppToApp(APPS[fallbackIndex], fallbackIndex);
  }

  return null;
}
