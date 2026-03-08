"use client";

import { useEffect, useState } from "react";
import StorePreview from "./StorePreview";
import InteractionTracker from "./InteractionTracker";
import { browserSupabase } from "../lib/supabase-browser";
import { submissionToApp } from "../lib/project-utils";

async function fetchApprovedProjects() {
  if (!browserSupabase) {
    return [];
  }

  const { data, error } = await browserSupabase
    .from("submission_requests")
    .select("id, project_name, description, website_url, card_image_url, public_slug, approved_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(submissionToApp);
}

export default function ProjectGrid({ initialApps }) {
  const [communityApps, setCommunityApps] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadApprovedProjects() {
      const approvedApps = await fetchApprovedProjects();
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
