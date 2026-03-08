"use client";

import { useEffect, useMemo, useState } from "react";
import { browserSupabase } from "../lib/supabase-browser";
import { trackInteraction } from "../lib/interaction-tracking";
import { buildSubmissionSlug } from "../lib/project-utils";

const dateFormatter = new Intl.DateTimeFormat("de-AT", {
  dateStyle: "medium",
  timeStyle: "short"
});

const metricDefinitions = {
  submissions: {
    label: "Einreichungen",
    description: "Zählt alle Projektvorschläge, die über das Formular eingegangen sind.",
    buttonLabel: "Details ansehen"
  },
  aufrufe: {
    label: "Aufrufe",
    description: "Erfasst Startseite, Detailseiten und geöffnete Intros.",
    buttonLabel: "Aufschlüsselung öffnen"
  },
  klicks: {
    label: "Aktionen",
    description: "Summe aus Klicks auf Mehr Infos und auf Zur Originalseite.",
    buttonLabel: "Aktionen prüfen"
  },
  freigaben: {
    label: "Freigaben",
    description: "Zeigt, wie viele Projekte bereits live geschaltet wurden.",
    buttonLabel: "Freigaben prüfen"
  },
  originalseite: {
    label: "Originalseite",
    description: "Trackt Klicks auf externe Links zu Kanal, Website oder Projektseite.",
    buttonLabel: "Link-Klicks ansehen"
  },
  mehrInfos: {
    label: "Mehr Infos",
    description: "Trackt Klicks auf Intro und Detailansicht der Projekte.",
    buttonLabel: "Mehr-Infos-Klicks ansehen"
  },
  anmeldungen: {
    label: "Anmeldelinks",
    description: "Zählt, wie oft ein Magic Link für den Creator-Bereich angefordert wurde.",
    buttonLabel: "Anmeldungen ansehen"
  }
};

const initialStats = {
  submissions: 0,
  klicks: 0,
  aufrufe: 0,
  freigaben: 0,
  originalseite: 0,
  mehrInfos: 0,
  anmeldungen: 0
};

function isConfigured() {
  return Boolean(browserSupabase);
}

function buildMetricCards(stats) {
  return [
    { key: "submissions", value: stats.submissions },
    { key: "aufrufe", value: stats.aufrufe },
    { key: "klicks", value: stats.klicks },
    { key: "freigaben", value: stats.freigaben },
    { key: "originalseite", value: stats.originalseite },
    { key: "mehrInfos", value: stats.mehrInfos },
    { key: "anmeldungen", value: stats.anmeldungen }
  ];
}

function groupRowsByLabel(rows, pickLabel) {
  const grouped = new Map();

  rows.forEach((row) => {
    const label = pickLabel(row);
    const current = grouped.get(label) || { label, count: 0, latest: null, rows: [] };

    current.count += 1;
    current.rows.push(row);

    const rowDate = row.created_at ? new Date(row.created_at).getTime() : 0;
    const latestDate = current.latest?.created_at ? new Date(current.latest.created_at).getTime() : 0;

    if (!current.latest || rowDate > latestDate) {
      current.latest = row;
    }

    grouped.set(label, current);
  });

  return Array.from(grouped.values()).sort((left, right) => right.count - left.count);
}

export default function CreatorDashboardClient() {
  const [email, setEmail] = useState("");
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [activeRowId, setActiveRowId] = useState(null);
  const [activeMetricKey, setActiveMetricKey] = useState("aufrufe");
  const [metricDetail, setMetricDetail] = useState({ items: [], total: 0 });
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(initialStats);
  const [queue, setQueue] = useState([]);

  const sessionEmail = useMemo(() => session?.user?.email || "", [session]);
  const metricCards = useMemo(() => buildMetricCards(stats), [stats]);

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

      if (!active) return;

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
        originalClickCount,
        infoClickCount,
        pageViewCount,
        detailViewCount,
        magicLinkCount,
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
          .eq("event_type", "intro_open"),
        browserSupabase
          .from("interaction_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "page_view"),
        browserSupabase
          .from("interaction_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "detail_view"),
        browserSupabase
          .from("interaction_events")
          .select("*", { count: "exact", head: true })
          .eq("event_type", "magic_link_request"),
        browserSupabase
          .from("submission_requests")
          .select(
            "id, creator_name, email, project_name, website_url, description, card_image_url, created_at, status"
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      ]);

      if (!active) return;

      const originalClicks = originalClickCount.count || 0;
      const infoClicks = infoClickCount.count || 0;

      setStats({
        submissions: submissionCount.count || 0,
        freigaben: approvalCount.count || 0,
        klicks: originalClicks + infoClicks,
        aufrufe: (pageViewCount.count || 0) + (detailViewCount.count || 0) + infoClicks,
        originalseite: originalClicks,
        mehrInfos: infoClicks,
        anmeldungen: magicLinkCount.count || 0
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

  useEffect(() => {
    if (!browserSupabase || !isAdmin) {
      return;
    }

    let active = true;

    async function loadMetricDetail() {
      setIsDetailLoading(true);

      let nextDetail = { items: [], total: 0 };

      if (activeMetricKey === "submissions") {
        const { data } = await browserSupabase
          .from("submission_requests")
          .select("id, project_name, creator_name, email, status, created_at")
          .order("created_at", { ascending: false })
          .limit(30);

        const items =
          data?.map((row) => ({
            title: row.project_name,
            summary: `${row.creator_name} | ${row.email}`,
            meta: `Status: ${row.status} | ${dateFormatter.format(new Date(row.created_at))}`
          })) || [];

        nextDetail = { items, total: items.length };
      }

      if (activeMetricKey === "freigaben") {
        const { data } = await browserSupabase
          .from("submission_requests")
          .select("id, project_name, creator_name, approved_at, public_slug")
          .eq("status", "approved")
          .order("approved_at", { ascending: false })
          .limit(30);

        const items =
          data?.map((row) => ({
            title: row.project_name,
            summary: `Freigegeben von ${row.creator_name}`,
            meta: `${row.public_slug || buildSubmissionSlug(row)} | ${dateFormatter.format(new Date(row.approved_at))}`
          })) || [];

        nextDetail = { items, total: items.length };
      }

      if (["aufrufe", "klicks", "originalseite", "mehrInfos", "anmeldungen"].includes(activeMetricKey)) {
        const eventTypesByMetric = {
          aufrufe: ["page_view", "detail_view", "intro_open"],
          klicks: ["external_click", "intro_open"],
          originalseite: ["external_click"],
          mehrInfos: ["intro_open"],
          anmeldungen: ["magic_link_request"]
        };

        const { data } = await browserSupabase
          .from("interaction_events")
          .select("item_title, item_id, event_type, route_path, created_at")
          .in("event_type", eventTypesByMetric[activeMetricKey])
          .order("created_at", { ascending: false })
          .limit(200);

        const grouped = groupRowsByLabel(
          data || [],
          (row) => row.item_title || row.item_id || row.route_path || "Unbekannt"
        );

        const items = grouped.map((entry) => ({
          title: entry.label,
          summary: `${entry.count} Ereignisse`,
          meta: `${entry.latest?.event_type || "event"} | ${entry.latest?.created_at ? dateFormatter.format(new Date(entry.latest.created_at)) : "ohne Zeit"}`
        }));

        nextDetail = { items, total: (data || []).length };
      }

      if (!active) return;

      setMetricDetail(nextDetail);
      setIsDetailLoading(false);
    }

    loadMetricDetail();

    return () => {
      active = false;
    };
  }, [activeMetricKey, isAdmin]);

  async function sendMagicLink(event) {
    event.preventDefault();

    if (!browserSupabase || !email.trim()) {
      return;
    }

    setIsSendingLink(true);
    setStatus(null);

    await trackInteraction({
      itemId: "creator-dashboard",
      itemTitle: "Creator-Bereich",
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
            Melde dich mit deiner Admin-E-Mail an. Nach dem Magic Link lädt die Moderation
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
        {metricCards.map((metric) => (
          <article key={metric.key} className="card stat-card">
            <span className="stat-label">{metricDefinitions[metric.key].label}</span>
            <strong className="stat-value">{metric.value}</strong>
            <p className="stat-description">{metricDefinitions[metric.key].description}</p>
            <button
              type="button"
              className="button button-secondary stat-button"
              onClick={() => setActiveMetricKey(metric.key)}
            >
              {metricDefinitions[metric.key].buttonLabel}
            </button>
          </article>
        ))}
      </section>

      <article className="card">
        <div className="section-header">
          <div>
            <h2 style={{ marginBottom: "0.35rem" }}>
              Detailansicht: {metricDefinitions[activeMetricKey].label}
            </h2>
            <p style={{ marginTop: 0 }}>{metricDefinitions[activeMetricKey].description}</p>
          </div>
          <span className="status-pill">{metricDetail.total} Einträge</span>
        </div>

        {isDetailLoading ? (
          <p>Lade Details...</p>
        ) : metricDetail.items.length ? (
          <div className="metric-detail-list">
            {metricDetail.items.map((item) => (
              <article key={`${activeMetricKey}-${item.title}-${item.meta}`} className="metric-detail-item">
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
                <small>{item.meta}</small>
              </article>
            ))}
          </div>
        ) : (
          <p>Für diese Kennzahl sind noch keine Details vorhanden.</p>
        )}
      </article>

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
