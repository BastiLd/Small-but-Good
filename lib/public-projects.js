import { browserSupabase } from "./supabase-browser";
import { submissionToApp } from "./project-utils";

const legacyPublicProjectSelect =
  "id, project_name, description, intro_text, website_url, card_image_url, slug, approved_at, creator_slug, creator_display_name";
const publicProjectSelect = `${legacyPublicProjectSelect}, detail_sections, external_button_label`;

async function fetchProjectRows(filters = {}) {
  if (!browserSupabase) {
    return [];
  }

  const runQuery = async (selectClause) => {
    let query = browserSupabase.from("public_projects").select(selectClause);

    if (filters.slug) {
      query = query.eq("slug", filters.slug);
    }

    if (filters.creatorSlug) {
      query = query.eq("creator_slug", filters.creatorSlug);
    }

    return query.order("approved_at", { ascending: false });
  };

  let response = await runQuery(publicProjectSelect);

  if (response.error && /detail_sections|external_button_label/i.test(response.error.message || "")) {
    response = await runQuery(legacyPublicProjectSelect);
  }

  if (response.error || !response.data) {
    return [];
  }

  return response.data;
}

export async function fetchPublicProjects() {
  const rows = await fetchProjectRows();
  return rows.map(submissionToApp);
}

export async function fetchPublicProjectBySlug(slug) {
  const rows = await fetchProjectRows({ slug });
  return rows.length ? submissionToApp(rows[0]) : null;
}

export async function fetchPublicProjectsByCreatorSlug(creatorSlug) {
  const rows = await fetchProjectRows({ creatorSlug });
  return rows.map(submissionToApp);
}
