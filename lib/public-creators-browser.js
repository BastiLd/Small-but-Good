import { browserSupabase } from "./supabase-browser";

// Browser-side variant of fetchServerPublicCreatorBySlug (lib/public-creators.js),
// used by the client-side 404 fallback to load creator profiles that did not
// exist at build time.
export async function fetchPublicCreatorBySlug(slug) {
  if (!browserSupabase || !slug) {
    return null;
  }

  const { data, error } = await browserSupabase
    .from("public_creator_profiles")
    .select("id, slug, display_name, bio, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data || null;
}
