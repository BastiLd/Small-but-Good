"use client";

import { useEffect, useState } from "react";
import StorePreview from "./StorePreview";
import InteractionTracker from "./InteractionTracker";
import { browserSupabase } from "../lib/supabase-browser";
import { fetchPublicProjects } from "../lib/public-projects";

export default function ProjectGrid({ initialApps }) {
  const [communityApps, setCommunityApps] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadApprovedProjects() {
      const approvedApps = await fetchPublicProjects();
      if (active) {
        setCommunityApps(approvedApps);
      }
    }

    loadApprovedProjects();

    if (!browserSupabase) {
      return () => {
        active = false;
      };
    }

    const channel = browserSupabase
      .channel("approved-projects")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submission_requests" },
        () => {
          loadApprovedProjects();
        }
      )
      .subscribe();

    return () => {
      active = false;
      browserSupabase.removeChannel(channel);
    };
  }, [initialApps]);

  const visibleApps = [...initialApps, ...communityApps];

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
