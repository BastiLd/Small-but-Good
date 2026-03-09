import { browserSupabase } from "./supabase-browser";
import { slugify } from "./project-utils";

function getDisplayName(user, fallbackName) {
  return (
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    fallbackName ||
    user?.email?.split("@")[0] ||
    "Creator"
  ).trim();
}

function buildCreatorSlug(user, fallbackName) {
  const baseSlug = slugify(getDisplayName(user, fallbackName)) || "creator";
  const suffix = (user?.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();

  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
}

async function fetchCreatorByField(field, value) {
  if (!value) {
    return null;
  }

  const { data, error } = await browserSupabase
    .from("creators")
    .select("id, email, auth_user_id, display_name, slug")
    .eq(field, value)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

export async function ensureCreatorProfile({ user, fallbackName }) {
  if (!browserSupabase || !user?.id || !user?.email) {
    return null;
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const payload = {
    email: normalizedEmail,
    auth_user_id: user.id,
    display_name: getDisplayName(user, fallbackName),
    slug: buildCreatorSlug(user, fallbackName)
  };

  try {
    const existingByAuth = await fetchCreatorByField("auth_user_id", user.id);
    const existingByEmail = existingByAuth || (await fetchCreatorByField("email", normalizedEmail));

    if (existingByEmail) {
      const { data, error } = await browserSupabase
        .from("creators")
        .update(payload)
        .eq("id", existingByEmail.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data?.id || existingByEmail.id;
    }

    const { data, error } = await browserSupabase
      .from("creators")
      .insert([payload])
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.id || null;
  } catch (error) {
    if (/auth_user_id|slug|creators|row-level|policy/i.test(error?.message || "")) {
      return null;
    }

    throw error;
  }
}
