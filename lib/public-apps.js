import { APPS } from "./apps";
import { appRowToApp, seedAppToApp } from "./project-utils";
import { browserSupabase } from "./supabase-browser";

const publicAppSelect = [
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
  if (!browserSupabase) {
    return [];
  }

  let query = browserSupabase.from("public_apps").select(publicAppSelect);

  if (filters.slug) {
    query = query.eq("slug", filters.slug);
  }

  const { data, error } = await query.order("feed_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function fetchPublicApps() {
  const rows = await fetchAppRows();
  return rows.length ? rows.map(appRowToApp) : getFallbackApps();
}

export async function fetchPublicAppBySlug(slug) {
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
