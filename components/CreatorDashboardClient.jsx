"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { browserSupabase } from "../lib/supabase-browser";
import { trackInteraction } from "../lib/interaction-tracking";
import {
  buildMetricCards,
  fetchCreatorDashboardData,
  primaryMetricKeys,
  secondaryMetricKeys
} from "../lib/creator-dashboard";

const dateFormatter = new Intl.DateTimeFormat("de-AT", {
  dateStyle: "medium",
  timeStyle: "short"
});

function isConfigured() {
  return Boolean(browserSupabase);
}

function renderStatusLabel(status) {
  if (status === "approved") return "Angenommen";
  if (status === "rejected") return "Abgelehnt";
  return "In Prüfung";
}

export default function CreatorDashboardClient() {
  const [email, setEmail] = useState("");
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [activeRowId, setActiveRowId] = useState(null);
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState({
    submissions: 0,
    klicks: 0,
    aufrufe: 0,
    freigaben: 0,
    originalseite: 0,
    mehrInfos: 0,
    anmeldungen: 0
  });
  const [queue, setQueue] = useState([]);
  const [projectRows, setProjectRows] = useState([]);

  const sessionEmail = useMemo(() => session?.user?.email || "", [session]);
  const metricCards = useMemo(() => buildMetricCards(stats), [stats]);
  const primaryCards = metricCards.filter((metric) => primaryMetricKeys.includes(metric.key));
  const secondaryCards = metricCards.filter((metric) => secondaryMetricKeys.includes(metric.key));

  useEffect(() => {
    if (!browserSupabase) {
      setIsLoading(false);
      return;
    }

    browserSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data: listener } = browserSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!browserSupabase || !sessionEmail) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    let active = true;

    async function checkAdminAccess() {
      const { data, error } = await browserSupabase
        .from("admin_users")
        .select("email")
        .eq("email", sessionEmail)
        .maybeSingle();

      if (!active) return;
      setIsAdmin(Boolean(data && !error));
    }

    checkAdminAccess();

    return () => {
      active = false;
    };
  }, [sessionEmail]);

  useEffect(() => {
    if (!browserSupabase || !sessionEmail) {
      return;
    }

    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      const dashboardData = await fetchCreatorDashboardData(sessionEmail, isAdmin);

      if (!active || !dashboardData) return;

      setStats(dashboardData.stats);
      setProjectRows(dashboardData.ownProjectRows);
      setQueue(dashboardData.queue);
      setIsLoading(false);
    }

    loadDashboard();

    const submissionsChannel = browserSupabase
      .channel("creator-dashboard-submissions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submission_requests" },
        () => {
          loadDashboard();
        }
      )
      .subscribe();

    const interactionsChannel = browserSupabase
      .channel("creator-dashboard-interactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interaction_events" },
        () => {
          loadDashboard();
        }
      )
      .subscribe();

    return () => {
      active = false;
      browserSupabase.removeChannel(submissionsChannel);
      browserSupabase.removeChannel(interactionsChannel);
    };
  }, [isAdmin, sessionEmail]);

  async function sendMagicLink(event) {
    event.preventDefault();

    if (!browserSupabase || !email.trim()) {
      return;
    }

    setIsSendingLink(true);
    setStatus(null);

    await trackInteraction({
      itemId: "creator-dashboard",
      itemTitle: "Creator-Dashboard",
      itemSource: "system",
      eventType: "magic_link_request",
      routePath: "/creator/dashboard"
    });

    const { error } = await browserSupabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined
      }
    });

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      setStatus({
        type: "success",
        message: "Der Magic Link wurde verschickt. Bitte öffne die E-Mail und melde dich an."
      });
    }

    setIsSendingLink(false);
  }

  async function signOut() {
    if (!browserSupabase) {
      return;
    }

    await browserSupabase.auth.signOut();
    setStatus({ type: "success", message: "Du wurdest abgemeldet." });
  }

  async function moderateSubmission(row, nextStatus) {
    if (!browserSupabase) {
      return;
    }

    setActiveRowId(row.id);
    setStatus(null);

    const { buildSubmissionSlug } = await import("../lib/project-utils");

    const now = new Date().toISOString();
    const payload = {
      status: nextStatus,
      reviewed_at: now,
      approved_at: nextStatus === "approved" ? now : null,
      public_slug: nextStatus === "approved" ? buildSubmissionSlug(row) : null
    };

    const { error } = await browserSupabase
      .from("submission_requests")
      .update(payload)
      .eq("id", row.id);

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      setStatus({
        type: "success",
        message:
          nextStatus === "approved"
            ? "Das Projekt wurde freigegeben und erscheint live auf der Startseite."
            : "Das Projekt wurde abgelehnt."
      });
    }

    setActiveRowId(null);
  }

  if (!isConfigured()) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Creator-Dashboard</h1>
          <p>Supabase ist noch nicht im Browser konfiguriert.</p>
        </article>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Creator-Dashboard</h1>
          <p>Melde dich an, damit du den Status und die Zahlen deiner Projekte sehen kannst.</p>

          <form className="inline-form" onSubmit={sendMagicLink}>
            <label className="field inline-field">
              <span className="field-label">E-Mail</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@beispiel.de"
              />
            </label>
            <button type="submit" className="button" disabled={isSendingLink}>
              {isSendingLink ? "Wird gesendet..." : "Anmelden"}
            </button>
          </form>

          {status ? (
            <p
              className={`form-status ${
                status.type === "success" ? "form-status-success" : "form-status-error"
              }`}
            >
              {status.message}
            </p>
          ) : null}
        </article>
      </section>
    );
  }

  return (
    <section className="dashboard-stack">
      <article className="card">
        <div className="admin-bar">
          <div>
            <h1 style={{ marginBottom: "0.35rem" }}>Creator-Dashboard</h1>
            <p style={{ marginTop: 0 }}>Angemeldet als {sessionEmail}</p>
          </div>
          <button type="button" className="button button-secondary" onClick={signOut}>
            Abmelden
          </button>
        </div>
      </article>

      <section className="dashboard-metrics">
        <div className="metric-row">
          {primaryCards.map((metric) => (
            <article key={metric.key} className="card stat-card compact-stat-card">
              <span className="stat-label">{metric.label}</span>
              <strong className="stat-value">{metric.value}</strong>
              <p className="stat-description stat-description-clamp">{metric.description}</p>
              <Link
                href={`/creator/dashboard/details?metric=${metric.key}`}
                className="button button-secondary stat-button"
              >
                {metric.buttonLabel}
              </Link>
            </article>
          ))}
        </div>

        <div className="metric-row metric-row-centered">
          {secondaryCards.map((metric) => (
            <article key={metric.key} className="card stat-card compact-stat-card">
              <span className="stat-label">{metric.label}</span>
              <strong className="stat-value">{metric.value}</strong>
              <p className="stat-description stat-description-clamp">{metric.description}</p>
              <Link
                href={`/creator/dashboard/details?metric=${metric.key}`}
                className="button button-secondary stat-button"
              >
                {metric.buttonLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <article className="card">
        <div className="section-header">
          <div>
            <h2 style={{ marginBottom: "0.35rem" }}>Meine Projekte</h2>
            <p style={{ marginTop: 0 }}>
              Hier siehst du, ob deine Projekte angenommen wurden und wie oft darauf geklickt wurde.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p>Lade deine Projekte...</p>
        ) : projectRows.length ? (
          <div className="queue-list">
            {projectRows.map((row) => (
              <article key={row.id} className="queue-item">
                <div className="queue-copy">
                  <div className="section-header">
                    <div>
                      <h3 style={{ marginBottom: "0.35rem" }}>{row.title}</h3>
                      <p className="queue-meta" style={{ marginTop: 0 }}>
                        Eingereicht am {dateFormatter.format(new Date(row.createdAt))}
                      </p>
                    </div>
                    <span className="status-pill">{renderStatusLabel(row.status)}</span>
                  </div>

                  <div className="project-stats-inline">
                    <span>Mehr Infos: {row.introOpens}</span>
                    <span>Detailaufrufe: {row.detailViews}</span>
                    <span>Externe Klicks: {row.externalClicks}</span>
                  </div>

                  {row.approvedAt ? (
                    <p className="queue-meta">
                      Freigegeben am {dateFormatter.format(new Date(row.approvedAt))}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p>Du hast bisher noch keine Projekte eingereicht.</p>
        )}
      </article>

      {isAdmin ? (
        <article className="card">
          <div className="section-header">
            <div>
              <h2 style={{ marginBottom: "0.35rem" }}>Moderationswarteschlange</h2>
              <p style={{ marginTop: 0 }}>
                Hier prüfst du neue Projekte und schaltest sie direkt für die Startseite frei.
              </p>
            </div>
            <span className="status-pill">{queue.length} offen</span>
          </div>

          {status ? (
            <p
              className={`form-status ${
                status.type === "success" ? "form-status-success" : "form-status-error"
              }`}
            >
              {status.message}
            </p>
          ) : null}

          {isLoading ? (
            <p>Lade Moderation...</p>
          ) : queue.length ? (
            <div className="queue-list">
              {queue.map((row) => (
                <article key={row.id} className="queue-item">
                  <div className="queue-copy">
                    <div className="section-header">
                      <div>
                        <h3 style={{ marginBottom: "0.35rem" }}>{row.project_name}</h3>
                        <p className="queue-meta" style={{ marginTop: 0 }}>
                          Von {row.creator_name} | {row.email}
                        </p>
                      </div>
                      <span className="status-pill status-pill-pending">Ausstehend</span>
                    </div>

                    <p className="queue-description">{row.description}</p>

                    {row.website_url ? (
                      <p className="queue-meta">
                        Link:{" "}
                        <a href={row.website_url} target="_blank" rel="noreferrer">
                          {row.website_url}
                        </a>
                      </p>
                    ) : null}

                    {row.card_image_url ? (
                      <p className="queue-meta">
                        Bild:{" "}
                        <a href={row.card_image_url} target="_blank" rel="noreferrer">
                          {row.card_image_url}
                        </a>
                      </p>
                    ) : null}

                    <p className="queue-meta">
                      Eingereicht am {dateFormatter.format(new Date(row.created_at))}
                    </p>
                  </div>

                  <div className="queue-actions">
                    <button
                      type="button"
                      className="button"
                      disabled={activeRowId === row.id}
                      onClick={() => moderateSubmission(row, "approved")}
                    >
                      Freigeben
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={activeRowId === row.id}
                      onClick={() => moderateSubmission(row, "rejected")}
                    >
                      Ablehnen
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Aktuell warten keine Projekte auf Freigabe.</p>
          )}
        </article>
      ) : null}
    </section>
  );
}
