import { submissionToApp } from "./project-utils";

const legacyPublicProjectSelect =
  "id, project_name, description, intro_text, website_url, card_image_url, slug, approved_at, creator_slug, creator_display_name";
const publicProjectSelect = `${legacyPublicProjectSelect}, card_image_scale, detail_sections, external_button_label`;

// Builds the public-project fetchers around a client resolver. `getClient` is
// called per request so the build-time variant can spin up a fresh client while
// the browser variant returns its shared singleton. Used by both
// public-projects.js (browser) and public-projects-server.js (build).
export function createProjectFetchers(getClient) {
  async function fetchProjectRows(filters = {}) {
    const client = getClient();

    if (!client) {
      return [];
    }

    const runQuery = async (selectClause) => {
      let query = client.from("public_projects").select(selectClause);

      if (filters.slug) {
        query = query.eq("slug", filters.slug);
      }

      if (filters.creatorSlug) {
        query = query.eq("creator_slug", filters.creatorSlug);
      }

      return query.order("approved_at", { ascending: false });
    };

    let response = await runQuery(publicProjectSelect);

    if (
      response.error &&
      /detail_sections|external_button_label|card_image_scale/i.test(response.error.message || "")
    ) {
      response = await runQuery(legacyPublicProjectSelect);
    }

    if (response.error || !response.data) {
      return [];
    }

    return response.data;
  }

  return {
    async fetchProjects() {
      const rows = await fetchProjectRows();
      return rows.map(submissionToApp);
    },
    async fetchProjectBySlug(slug) {
      const rows = await fetchProjectRows({ slug });
      return rows.length ? submissionToApp(rows[0]) : null;
    },
    async fetchProjectsByCreatorSlug(creatorSlug) {
      const rows = await fetchProjectRows({ creatorSlug });
      return rows.map(submissionToApp);
    }
  };
}
