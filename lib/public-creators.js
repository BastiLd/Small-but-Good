import { getPublicSupabaseClient } from "./supabase-public";

export async function fetchServerPublicCreatorBySlug(slug) {
  const client = getPublicSupabaseClient();

  if (!client || !slug) {
    return null;
  }

  const { data, error } = await client
    .from("public_creator_profiles")
    .select("id, slug, display_name, bio, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data || null;
}

export async function fetchServerPublicCreators() {
  const client = getPublicSupabaseClient();

  if (!client) {
    return [];
  }

  const { data, error } = await client
    .from("public_creator_profiles")
    .select("id, slug, display_name, bio, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data;
}
