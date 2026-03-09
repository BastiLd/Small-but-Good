import { browserSupabase } from "./supabase-browser";
import { submissionToApp } from "./project-utils";

const publicProjectSelect =
  "id, project_name, description, website_url, card_image_url, slug, approved_at, creator_slug, creator_display_name";

export async function fetchPublicProjects() {
  if (!browserSupabase) {
    return [];
  }

  const { data, error } = await browserSupabase
    .from("public_projects")
    .select(publicProjectSelect)
    .order("approved_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(submissionToApp);
}
