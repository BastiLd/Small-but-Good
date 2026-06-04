import { createAppFetchers } from "./public-apps-core";
import { browserSupabase } from "./supabase-browser";

const fetchers = createAppFetchers(() => browserSupabase);

export async function fetchPublicApps() {
  return fetchers.fetchApps();
}

export async function fetchPublicAppBySlug(slug) {
  return fetchers.fetchAppBySlug(slug);
}

export async function fetchPublicAppsByCreatorSlug(creatorSlug) {
  return fetchers.fetchAppsByCreatorSlug(creatorSlug);
}
