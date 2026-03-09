"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { browserSupabase } from "../lib/supabase-browser";
import {
  buildMetricDetail,
  creatorMetricKeys,
  metricDefinitions
} from "../lib/creator-dashboard";

function isConfigured() {
  return Boolean(browserSupabase);
}

export default function CreatorMetricDetailClient() {
  const searchParams = useSearchParams();
  const metricKey = searchParams.get("metric") || "aufrufe";
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [detail, setDetail] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolvedMetricKey = useMemo(() => {
    if (!metricDefinitions[metricKey]) {
      return "aufrufe";
    }

    return metricKey;
  }, [metricKey]);

  useEffect(() => {
    if (!browserSupabase) {
      setIsLoading(false);
      return;
    }

    browserSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });
  }, []);

  useEffect(() => {
    if (!browserSupabase || !session?.user?.email) {
      setIsAdmin(false);
      return;
    }

    let active = true;

    async function loadRole() {
      const { data, error } = await browserSupabase
        .from("admin_users")
        .select("email")
        .eq("email", session.user.email)
        .maybeSingle();

      if (!active) {
        return;
      }

      setIsAdmin(Boolean(data && !error));
    }

    loadRole();

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!browserSupabase || !session?.user?.email) {
      setIsLoading(false);
      return;
    }

    let active = true;

    async function loadDetail() {
      setIsLoading(true);

      const { fetchCreatorDashboardData } = await import("../lib/creator-dashboard");
      const dashboardData = await fetchCreatorDashboardData(session.user.email, false);

      if (!active || !dashboardData) {
        setIsLoading(false);
        return;
      }

      const metricIsAllowed = isAdmin || creatorMetricKeys.includes(resolvedMetricKey);
      const safeMetricKey = metricIsAllowed ? resolvedMetricKey : "aufrufe";

      setDetail(buildMetricDetail(safeMetricKey, dashboardData));
      setIsLoading(false);
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [isAdmin, resolvedMetricKey, session]);

  if (!isConfigured()) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Detailansicht</h1>
          <p>Supabase ist noch nicht im Browser konfiguriert.</p>
        </article>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Detailansicht</h1>
          <p>Bitte melde dich zuerst an, damit wir deine Projektdaten laden können.</p>
          <Link href="/creator/dashboard" className="button">
            Zum Dashboard
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className="dashboard-stack">
      <article className="card">
        <div className="section-header">
          <div>
            <h1 style={{ marginBottom: "0.35rem" }}>
              Detailansicht: {detail?.title || metricDefinitions[resolvedMetricKey].label}
            </h1>
            <p style={{ marginTop: 0 }}>
              {detail?.description || metricDefinitions[resolvedMetricKey].description}
            </p>
          </div>
          <Link href="/creator/dashboard" className="button button-secondary">
            Zurück zum Dashboard
          </Link>
        </div>
      </article>

      <article className="card">
        <div className="section-header">
          <div>
            <h2 style={{ marginBottom: "0.35rem" }}>{detail?.total || 0} Einträge</h2>
            <p style={{ marginTop: 0 }}>
              Hier siehst du die genaue Aufschlüsselung zu dieser Kennzahl.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p>Lade Details...</p>
        ) : detail?.items?.length ? (
          <div className="metric-detail-list">
            {detail.items.map((item) => (
              <article
                key={`${resolvedMetricKey}-${item.title}-${item.meta}`}
                className="metric-detail-item"
              >
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                <small>{item.meta}</small>
              </article>
            ))}
          </div>
        ) : (
          <p>Für diese Kennzahl liegen noch keine Daten vor.</p>
        )}
      </article>
    </section>
  );
}
