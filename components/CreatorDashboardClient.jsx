"use client";

import { useEffect, useMemo, useState } from "react";
import { browserSupabase } from "../lib/supabase-browser";
import { buildSubmissionSlug } from "../lib/project-utils";

const dateFormatter = new Intl.DateTimeFormat("de-AT", {
  dateStyle: "medium",
  timeStyle: "short"
});

const initialStats = {
  submissions: 0,
  klicks: 0,
  aufrufe: 0,
  freigaben: 0
};

function isConfigured() {
  return Boolean(browserSupabase);
}

export default function CreatorDashboardClient() {
  const [email, setEmail] = useState("");
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [activeRowId, setActiveRowId] = useState(null);
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(initialStats);
  const [queue, setQueue] = useState([]);

  const sessionEmail = useMemo(() => session?.user?.email || "", [session]);

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
    if (!browserSupabase) {
      return;
    }

    if (!sessionEmail) {
      setIsAdmin(false);
      setQueue([]);
      setStats(initialStats);
      setIsLoading(false);
      return;
    }

    let active = true;

    async function checkAdminAccess() {
      setIsLoading(true);

      const { data, error } = await browserSupabase
        .from("admin_users")
        .select("email")
        .eq("email", sessionEmail)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error || !data) {
        setIsAdmin(false);
        setQueue([]);
        setStats(initialStats);
        setIsLoading(false);
        return;
      }

      setIsAdmin(true);
    }

    checkAdminAccess();

    return () => {
      active = false;
    };
  }, [sessionEmail]);

  useEffect(() => {
    if (!browserSupabase || !isAdmin) {
      return;
    }

    let active = true;

    async function loadDashboardData() {
      const [
        submissionCount,
        approvalCount,
        clickCount,
        viewCount,
        queueResult
      ] = await Promise.all([
        browserSupabase.from("submission_requests").select("*", { count: "exact", head: true }),
        browserSupabase
          .from("submission_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "approved"),
        browserSupabase
          .from("interaction_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "external_click"),
        browserSupabase
          .from("interaction_events")
          .select("*", { count: "exact", head: true })
          .in("event_type", ["page_view", "detail_view", "intro_open"]),
        browserSupabase
          .from("submission_requests")
          .select(
            "id, creator_name, email, project_name, website_url, description, card_image_url, created_at, status"
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      ]);

      if (!active) {
        return;
      }

      setStats({
        submissions: submissionCount.count || 0,
        freigaben: approvalCount.count || 0,
        klicks: clickCount.count || 0,
        aufrufe: viewCount.count || 0
      });

      setQueue(queueResult.data || []);
      setIsLoading(false);
    }

    loadDashboardData();

    const submissionsChannel = browserSupabase
      .channel("dashboard-submissions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submission_requests" },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    const interactionsChannel = browserSupabase
      .channel("dashboard-interactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interaction_events" },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      active = false;
      browserSupabase.removeChannel(submissionsChannel);
      browserSupabase.removeChannel(interactionsChannel);
    };
  }, [isAdmin]);

  async function sendMagicLink(event) {
    event.preventDefault();

    if (!browserSupabase || !email.trim()) {
      return;
    }

    setIsSendingLink(true);
    setStatus(null);

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
        message: "Der Magic Link wurde verschickt. Bitte \u00F6ffne die E-Mail und melde dich an."
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
          <h1>Creator-Bereich</h1>
          <p>Supabase ist noch nicht im Browser konfiguriert.</p>
        </article>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Creator-Bereich</h1>
          <p>
            Melde dich mit deiner Admin-E-Mail an. Nach dem Magic Link l\u00E4dt die Moderation
            automatisch.
          </p>

          <form className="inline-form" onSubmit={sendMagicLink}>
            <label className="field inline-field">
              <span className="field-label">Admin-E-Mail</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@beispiel.de"
              />
            </label>
            <button type="submit" className="button" disabled={isSendingLink}>
              {isSendingLink ? "Wird gesendet..." : "Magic Link senden"}
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

  if (!isAdmin) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <div className="admin-bar">
            <div>
              <h1 style={{ marginBottom: "0.35rem" }}>Creator-Bereich</h1>
              <p style={{ marginTop: 0 }}>Angemeldet als {sessionEmail}</p>
            </div>
            <button type="button" className="button button-secondary" onClick={signOut}>
              Abmelden
            </button>
          </div>

          <p>Dieses Konto ist noch nicht als Admin in Supabase hinterlegt.</p>

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
            <h1 style={{ marginBottom: "0.35rem" }}>Creator-Bereich</h1>
            <p style={{ marginTop: 0 }}>Angemeldet als {sessionEmail}</p>
          </div>
          <button type="button" className="button button-secondary" onClick={signOut}>
            Abmelden
          </button>
        </div>
      </article>

      <section className="stats-grid" aria-label="Live-Statistiken">
        <article className="card stat-card">
          <span className="stat-label">Einreichungen</span>
          <strong className="stat-value">{stats.submissions}</strong>
        </article>
        <article className="card stat-card">
          <span className="stat-label">Aufrufe</span>
          <strong className="stat-value">{stats.aufrufe}</strong>
        </article>
        <article className="card stat-card">
          <span className="stat-label">Klicks</span>
          <strong className="stat-value">{stats.klicks}</strong>
        </article>
        <article className="card stat-card">
          <span className="stat-label">Freigaben</span>
          <strong className="stat-value">{stats.freigaben}</strong>
        </article>
      </section>

      <article className="card">
        <div className="section-header">
          <div>
            <h2 style={{ marginBottom: "0.35rem" }}>Moderationswarteschlange</h2>
            <p style={{ marginTop: 0 }}>
              Hier pr\u00FCfst du neue Projekte und schaltest sie direkt f\u00FCr die Startseite frei.
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
          <p>Lade Dashboard-Daten...</p>
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
    </section>
  );
}
