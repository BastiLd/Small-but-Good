import { createProjectFetchers } from "./public-projects-core";
import { browserSupabase } from "./supabase-browser";

const fetchers = createProjectFetchers(() => browserSupabase);

export async function fetchPublicProjects() {
  return fetchers.fetchProjects();
}

export async function fetchPublicProjectBySlug(slug) {
  return fetchers.fetchProjectBySlug(slug);
}

export async function fetchPublicProjectsByCreatorSlug(creatorSlug) {
  return fetchers.fetchProjectsByCreatorSlug(creatorSlug);
}
