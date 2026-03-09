import { submissionToApp } from "./project-utils";
import { getPublicSupabaseClient } from "./supabase-public";

const publicProjectSelect =
  "id, project_name, description, website_url, card_image_url, slug, approved_at, creator_slug, creator_display_name";

async function fetchProjectRows(filters = {}) {
  const client = getPublicSupabaseClient();

  if (!client) {
    return [];
  }

  let query = client.from("public_projects").select(publicProjectSelect);

  if (filters.slug) {
    query = query.eq("slug", filters.slug);
  }

  if (filters.creatorSlug) {
    query = query.eq("creator_slug", filters.creatorSlug);
  }

  const { data, error } = await query.order("approved_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}

export async function fetchServerPublicProjects() {
  const rows = await fetchProjectRows();
  return rows.map(submissionToApp);
}

export async function fetchServerPublicProjectBySlug(slug) {
  const rows = await fetchProjectRows({ slug });
  return rows.length ? submissionToApp(rows[0]) : null;
}

export async function fetchServerProjectsByCreatorSlug(creatorSlug) {
  const rows = await fetchProjectRows({ creatorSlug });
  return rows.map(submissionToApp);
}
