import { getDuplicateSubmissionMatches } from "./submission-duplicates";
import { browserSupabase } from "./supabase-browser";

const duplicateSelect = "id, project_name, website_url, status, created_at";

export async function fetchPublicSubmissionDuplicates() {
  if (!browserSupabase) {
    return [];
  }

  const { data, error } = await browserSupabase
    .from("public_submission_duplicates")
    .select(duplicateSelect)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error || !data) {
    return [];
  }

  return data;
}

export async function findPublicSubmissionDuplicates(candidate) {
  const rows = await fetchPublicSubmissionDuplicates();
  return getDuplicateSubmissionMatches(candidate, rows);
}
