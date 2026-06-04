import { createAppFetchers } from "./public-apps-core";
import { getPublicSupabaseClient } from "./supabase-public";

const fetchers = createAppFetchers(() => getPublicSupabaseClient());

export async function fetchServerPublicApps() {
  return fetchers.fetchApps();
}

export async function fetchServerPublicAppBySlug(slug) {
  return fetchers.fetchAppBySlug(slug);
}

export async function fetchServerPublicAppsByCreatorSlug(creatorSlug) {
  return fetchers.fetchAppsByCreatorSlug(creatorSlug);
}
