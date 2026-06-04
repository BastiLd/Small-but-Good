import { createProjectFetchers } from "./public-projects-core";
import { getPublicSupabaseClient } from "./supabase-public";

const fetchers = createProjectFetchers(() => getPublicSupabaseClient());

export async function fetchServerPublicProjects() {
  return fetchers.fetchProjects();
}

export async function fetchServerPublicProjectBySlug(slug) {
  return fetchers.fetchProjectBySlug(slug);
}

export async function fetchServerProjectsByCreatorSlug(creatorSlug) {
  return fetchers.fetchProjectsByCreatorSlug(creatorSlug);
}
