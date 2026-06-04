import Link from "next/link";
import { useEffect, useState } from "react";
import DetailView from "../components/DetailView";
import CreatorProfileView from "../components/CreatorProfileView";
import { stripBasePath } from "../lib/basePath";
import { fetchPublicProjectBySlug, fetchPublicProjectsByCreatorSlug } from "../lib/public-projects";
import { fetchPublicAppBySlug, fetchPublicAppsByCreatorSlug } from "../lib/public-apps";
import { fetchPublicCreatorBySlug } from "../lib/public-creators-browser";
import { mergeFeedProjects } from "../lib/project-utils";

// On GitHub Pages every unknown path is served this 404.html. Because the site
// is a static export, detail pages only exist for items present at build time.
// Newly approved projects/apps/creators therefore land here — so we detect the
// requested route client-side and load the item live from Supabase. Known slugs
// keep serving their pre-rendered static page and never reach this component.
export default function NotFoundPage() {
  // "loading" until the client-side effect has resolved the requested route.
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function resolveRoute() {
      const path = stripBasePath(window.location.pathname);
      const projectMatch = path.match(/^\/projekte\/([^/]+)$/);
      const appMatch = path.match(/^\/app\/([^/]+)$/);
      const creatorMatch = path.match(/^\/creator\/([^/]+)$/);

      try {
        if (projectMatch) {
          const item = await fetchPublicProjectBySlug(decodeURIComponent(projectMatch[1]));
          if (active) {
            setState(item ? { status: "project", item } : { status: "missing" });
          }
          return;
        }

        if (appMatch) {
          const item = await fetchPublicAppBySlug(decodeURIComponent(appMatch[1]));
          if (active) {
            setState(item ? { status: "app", item } : { status: "missing" });
          }
          return;
        }

        if (creatorMatch) {
          const slug = decodeURIComponent(creatorMatch[1]);
          const [creator, appProjects, communityProjects] = await Promise.all([
            fetchPublicCreatorBySlug(slug),
            fetchPublicAppsByCreatorSlug(slug),
            fetchPublicProjectsByCreatorSlug(slug)
          ]);
          if (active) {
            setState(
              creator
                ? {
                    status: "creator",
                    creator,
                    projects: mergeFeedProjects(appProjects, communityProjects)
                  }
                : { status: "missing" }
            );
          }
          return;
        }
      } catch {
        // Fall through to the generic not-found state below.
      }

      if (active) {
        setState({ status: "missing" });
      }
    }

    resolveRoute();

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <article className="card">
        <p>Lädt …</p>
      </article>
    );
  }

  if (state.status === "project") {
    return (
      <DetailView
        item={state.item}
        footerNote="Dieses Community-Projekt wurde über CuratedHub eingereicht und freigegeben."
      />
    );
  }

  if (state.status === "app") {
    return <DetailView item={state.item} altSuffix="Logo" defaultItemSource="local" />;
  }

  if (state.status === "creator") {
    return <CreatorProfileView creator={state.creator} projects={state.projects} />;
  }

  return (
    <article className="card">
      <h1 style={{ marginTop: 0 }}>Seite nicht gefunden</h1>
      <p className="detail-text">
        Diese Seite existiert nicht oder wurde verschoben.
      </p>
      <Link href="/" className="button detail-inline-btn">
        Zurück zur Übersicht
      </Link>
    </article>
  );
}
