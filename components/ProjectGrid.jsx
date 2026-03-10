"use client";

import { useEffect, useMemo, useState } from "react";
import StorePreview from "./StorePreview";
import InteractionTracker from "./InteractionTracker";
import { browserSupabase } from "../lib/supabase-browser";
import { fetchPublicApps } from "../lib/public-apps";
import { fetchPublicProjects } from "../lib/public-projects";
import { mergeFeedProjects } from "../lib/project-utils";

export default function ProjectGrid({ initialApps }) {
  const [visibleApps, setVisibleApps] = useState(initialApps);
  const fallbackLocalApps = useMemo(
    () => initialApps.filter((app) => app?.source === "app"),
    [initialApps]
  );

  useEffect(() => {
    let active = true;

    async function loadFeedProjects() {
      const [localApps, communityApps] = await Promise.all([
        fetchPublicApps(),
        fetchPublicProjects()
      ]);
      const nextLocalApps = localApps.length ? localApps : fallbackLocalApps;
      const nextVisibleApps = mergeFeedProjects(nextLocalApps, communityApps);

      if (active) {
        setVisibleApps(nextVisibleApps);
      }
    }

    loadFeedProjects();

    if (!browserSupabase) {
      return () => {
        active = false;
      };
    }

    const submissionChannel = browserSupabase
      .channel("approved-projects")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submission_requests" },
        () => {
          loadFeedProjects();
        }
      )
      .subscribe();

    const appsChannel = browserSupabase
      .channel("published-apps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "apps" },
        () => {
          loadFeedProjects();
        }
      )
      .subscribe();

    return () => {
      active = false;
      browserSupabase.removeChannel(submissionChannel);
      browserSupabase.removeChannel(appsChannel);
    };
  }, [fallbackLocalApps]);

  return (
    <>
      <InteractionTracker
        itemId="startseite"
        itemTitle="Startseite"
        itemSource="system"
        eventType="page_view"
        routePath="/"
      />

      <section className="project-grid" aria-label="Projektübersicht">
        {visibleApps.map((app) => (
          <StorePreview key={app.id} app={app} />
        ))}
      </section>
    </>
  );
}
