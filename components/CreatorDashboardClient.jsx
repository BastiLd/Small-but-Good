"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { withBasePath } from "../lib/basePath";
import { browserSupabase } from "../lib/supabase-browser";
import { trackInteraction } from "../lib/interaction-tracking";
import { sendModerationNotification } from "../lib/moderation-notifications";
import {
  buildMetricCards,
  creatorMetricKeys,
  dashboardRangeOptions,
  fetchCreatorDashboardData,
  primaryMetricKeys,
  secondaryMetricKeys
} from "../lib/creator-dashboard";
import TextPromptOverlay from "./TextPromptOverlay";

const PROJECT_PLACEHOLDER_IMAGE = withBasePath("/images/project-placeholder.svg");

function isConfigured() {
  return Boolean(browserSupabase);
}

function getFriendlyAuthMessage(error) {
  if (!error?.message) {
    return "Die Anmeldung hat nicht funktioniert. Bitte versuche es erneut.";
  }

  if (error.message === "email rate limit exceeded") {
    return "Zu viele Login-Mails in kurzer Zeit. Warte kurz und versuche es dann erneut.";
  }

  if (error.message === "Invalid login credentials") {
    return "Diese Kombination aus E-Mail und Passwort wurde nicht gefunden.";
  }

  if (error.message === "User already registered") {
    return "Zu dieser E-Mail gibt es bereits ein Konto. Melde dich mit Passwort oder per E-Mail-Link an.";
  }

  if (error.message === "Signups not allowed for otp") {
    return "Neue Konten per E-Mail-Link sind in Supabase noch deaktiviert. Aktiviere dafür Email OTP Signups in den Auth-Einstellungen.";
  }

  return error.message;
}

function formatShortDate(value) {
  if (!value) {
    return "Noch keine Aktivität";
  }

  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatLongDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function buildDetailsHref(metricKey, rangeKey) {
  return `/creator/dashboard/details?metric=${metricKey}&range=${rangeKey}`;
}

function getPreviewImage(project) {
  return project?.card_image_url?.trim() || PROJECT_PLACEHOLDER_IMAGE;
}

function getProjectManagementCopy(mode) {
  if (mode === "restore") {
    return {
      eyebrow: "Wiederherstellen",
      title: "Gelöschte Projekte wiederherstellen",
      description:
        "Suche nach gelöschten Projekten, prüfe rechts die Vorschau und stelle sie innerhalb von zwei Monaten wieder her.",
      searchPlaceholder: "Nach gelöschtem Projekt, URL oder Slug suchen",
      emptyTitle: "Keine wiederherstellbaren Projekte gefunden.",
      emptyCopy:
        "Sobald du ein freigegebenes Projekt löschst, erscheint es hier für zwei Monate und kann wiederhergestellt werden.",
      actionLabel: "Wiederherstellen",
      confirmLabel: "Wirklich wiederherstellen",
      confirmQuestion: "Wirklich wiederherstellen?",
      previewStatus: "Zur Wiederherstellung bereit"
    };
  }

  return {
    eyebrow: "Löschen",
    title: "Freigegebene Projekte verwalten",
    description:
      "Suche nach freigegebenen Projekten, wähle links ein Projekt aus und prüfe rechts die Vorschau, bevor du es ausblendest.",
    searchPlaceholder: "Nach Projekt, URL oder Slug suchen",
    emptyTitle: "Keine freigegebenen Projekte gefunden.",
    emptyCopy: "Sobald Projekte freigegeben sind, kannst du sie hier gezielt suchen und löschen.",
    actionLabel: "Löschen",
    confirmLabel: "Wirklich löschen",
    confirmQuestion: "Wirklich löschen?",
    previewStatus: "Live"
  };
}

export default function CreatorDashboardClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeRowId, setActiveRowId] = useState(null);
  const [selectedQueueItem, setSelectedQueueItem] = useState(null);
  const [approvalDialog, setApprovalDialog] = useState(null);
  const [approvalIntroText, setApprovalIntroText] = useState("");
  const [projectManagementMode, setProjectManagementMode] = useState("delete");
  const [projectManagementSearch, setProjectManagementSearch] = useState("");
  const [selectedManagedProjectId, setSelectedManagedProjectId] = useState(null);
  const [projectActionDialog, setProjectActionDialog] = useState(null);
  const [status, setStatus] = useState(null);
  const [activeRangeKey, setActiveRangeKey] = useState("all");
  const [dashboardData, setDashboardData] = useState(null);
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

  const sessionEmail = useMemo(() => session?.user?.email || "", [session]);
  const metricCards = useMemo(() => buildMetricCards(stats), [stats]);
  const visibleMetricKeys = useMemo(
    () =>
      isAdmin
        ? [...primaryMetricKeys, ...secondaryMetricKeys]
        : creatorMetricKeys,
    [isAdmin]
  );
  const visibleMetricCards = useMemo(
    () =>
      visibleMetricKeys
        .map((key) => metricCards.find((metric) => metric.key === key))
        .filter(Boolean),
    [metricCards, visibleMetricKeys]
  );
  const topMetricCards = visibleMetricCards.slice(0, isAdmin ? 4 : visibleMetricCards.length);
  const bottomMetricCards = isAdmin ? visibleMetricCards.slice(4) : [];
  const activeRangeLabel = useMemo(
    () =>
      dashboardData?.activeRange?.label ||
      dashboardRangeOptions.find((range) => range.key === activeRangeKey)?.label ||
      "Alle Zeit",
    [activeRangeKey, dashboardData]
  );
  const publishedProjects = dashboardData?.publishedProjects || [];
  const pendingSubmissions = dashboardData?.pendingSubmissions || [];
  const releasedProjectCount =
    (dashboardData?.ownApprovedSubmissions?.length || 0) + (dashboardData?.ownedLocalApps?.length || 0);
  const adminProjectManagement = dashboardData?.adminProjectManagement || {
    activeProjects: [],
    restorableProjects: []
  };
  const managementCopy = useMemo(
    () => getProjectManagementCopy(projectManagementMode),
    [projectManagementMode]
  );
  const manageableProjects = useMemo(
    () =>
      projectManagementMode === "restore"
        ? adminProjectManagement.restorableProjects
        : adminProjectManagement.activeProjects,
    [adminProjectManagement, projectManagementMode]
  );
  const filteredManageableProjects = useMemo(() => {
    const searchTerm = projectManagementSearch.trim().toLowerCase();

    if (!searchTerm) {
      return manageableProjects;
    }

    return manageableProjects.filter((project) =>
      [project.project_name, project.creator_name, project.website_url, project.public_slug]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(searchTerm))
    );
  }, [manageableProjects, projectManagementSearch]);
  const selectedManagedProject = useMemo(
    () =>
      filteredManageableProjects.find((project) => project.id === selectedManagedProjectId) ||
      filteredManageableProjects[0] ||
      null,
    [filteredManageableProjects, selectedManagedProjectId]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const rangeFromUrl = params.get("range");

    if (dashboardRangeOptions.some((range) => range.key === rangeFromUrl)) {
      setActiveRangeKey(rangeFromUrl);
    }
  }, []);

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

      if (!active) {
        return;
      }

      setIsAdmin(Boolean(data && !error));
    }

    checkAdminAccess();

    return () => {
      active = false;
    };
  }, [sessionEmail]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);

    if (activeRangeKey === "all") {
      nextUrl.searchParams.delete("range");
    } else {
      nextUrl.searchParams.set("range", activeRangeKey);
    }

    window.history.replaceState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }, [activeRangeKey]);

  useEffect(() => {
    if (!browserSupabase || !sessionEmail) {
      return;
    }

    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      const nextDashboardData = await fetchCreatorDashboardData(sessionEmail, isAdmin, activeRangeKey);

      if (!active) {
        return;
      }

      if (!nextDashboardData) {
        setIsLoading(false);
        return;
      }

      setDashboardData(nextDashboardData);
      setStats(nextDashboardData.stats);
      setQueue(nextDashboardData.queue);
      setIsLoading(false);
    }

    loadDashboard();

    const submissionsChannel = browserSupabase
      .channel(`creator-dashboard-submissions-${activeRangeKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "submission_requests" },
        () => {
          loadDashboard();
        }
      )
      .subscribe();

    const interactionsChannel = browserSupabase
      .channel(`creator-dashboard-interactions-${activeRangeKey}`)
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
  }, [activeRangeKey, isAdmin, sessionEmail]);

  useEffect(() => {
    if (!filteredManageableProjects.length) {
      if (selectedManagedProjectId !== null) {
        setSelectedManagedProjectId(null);
      }
      return;
    }

    if (!filteredManageableProjects.some((project) => project.id === selectedManagedProjectId)) {
      setSelectedManagedProjectId(filteredManageableProjects[0].id);
    }
  }, [filteredManageableProjects, selectedManagedProjectId]);

  async function refreshDashboard() {
    if (!browserSupabase || !sessionEmail) {
      return;
    }

    const nextDashboardData = await fetchCreatorDashboardData(sessionEmail, isAdmin, activeRangeKey);

    if (!nextDashboardData) {
      return;
    }

    setDashboardData(nextDashboardData);
    setStats(nextDashboardData.stats);
    setQueue(nextDashboardData.queue);
  }

  async function sendMagicLink(event) {
    event.preventDefault();

    if (!browserSupabase) {
      return;
    }

    if (!email.trim()) {
      setStatus({
        type: "error",
        message: "Bitte gib zuerst deine E-Mail ein."
      });
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
        shouldCreateUser: true,
        emailRedirectTo: typeof window !== "undefined" ? window.location.href : undefined
      }
    });

    if (error) {
      setStatus({
        type: "error",
        message: getFriendlyAuthMessage(error)
      });
    } else {
      setStatus({
        type: "success",
        message:
          "Der E-Mail-Link wurde verschickt. Öffne die Mail auf diesem Gerät und tippe auf den Link, um dich anzumelden oder ein Konto anzulegen."
      });
    }

    setIsSendingLink(false);
  }

  async function continueWithPassword(event) {
    event.preventDefault();

    if (!browserSupabase || !email.trim() || !password) {
      setStatus({
        type: "error",
        message: "Bitte gib E-Mail und Passwort ein."
      });
      return;
    }

    setIsSigningIn(true);
    setStatus(null);

    const normalizedEmail = email.trim().toLowerCase();

    const { error: signInError } = await browserSupabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (!signInError) {
      setPassword("");
      setStatus({ type: "success", message: "Du bist jetzt mit Passwort angemeldet." });
      setIsSigningIn(false);
      return;
    }

    const shouldTrySignUp =
      signInError.message === "Invalid login credentials" ||
      signInError.message === "Email not confirmed";

    if (!shouldTrySignUp) {
      setStatus({ type: "error", message: getFriendlyAuthMessage(signInError) });
      setIsSigningIn(false);
      return;
    }

    const { data, error: signUpError } = await browserSupabase.auth.signUp({
      email: normalizedEmail,
      password
    });

    if (signUpError) {
      setStatus({ type: "error", message: getFriendlyAuthMessage(signUpError) });
    } else {
      setPassword("");
      setStatus({
        type: "success",
        message: data.session
          ? "Konto erstellt und direkt angemeldet."
          : "Konto erstellt. Bitte bestätige jetzt die E-Mail in deinem Postfach und melde dich danach an."
      });
    }

    setIsSigningIn(false);
  }

  async function signOut() {
    if (!browserSupabase) {
      return;
    }

    await browserSupabase.auth.signOut();
    setStatus({ type: "success", message: "Du wurdest abgemeldet." });
  }

  async function moderateSubmission(row, nextStatus, options = {}) {
    if (!browserSupabase) {
      return;
    }

    setActiveRowId(row.id);
    setStatus(null);

    const { buildSubmissionSlug } = await import("../lib/project-utils");
    const normalizedIntroText = (options.approvedIntroText || "").trim();

    const now = new Date().toISOString();
    const payload = {
      status: nextStatus,
      reviewed_at: now,
      approved_at: nextStatus === "approved" ? now : null,
      public_slug: nextStatus === "approved" ? buildSubmissionSlug(row) : null,
      approved_intro_text: nextStatus === "approved" ? normalizedIntroText || null : null
    };

    const { error } = await browserSupabase
      .from("submission_requests")
      .update(payload)
      .eq("id", row.id);

    if (error) {
      setStatus({ type: "error", message: error.message });
      setActiveRowId(null);
      return;
    }

    const notificationResult = await sendModerationNotification({
      nextStatus,
      submission: {
        ...row,
        public_slug: payload.public_slug
      }
    });
    const notificationHint =
      notificationResult?.sent
        ? ""
        : ` Die Statusänderung wurde gespeichert, aber es wurde keine E-Mail gesendet${
            notificationResult?.reason ? ` (${notificationResult.reason}).` : "."
          }`;

    await refreshDashboard();
    setStatus({
      type: "success",
      message:
        nextStatus === "approved"
          ? `Das Projekt wurde freigegeben und erscheint live auf der Startseite.${notificationHint}`
          : `Das Projekt wurde abgelehnt.${notificationHint}`
    });
    setApprovalDialog(null);
    setApprovalIntroText("");
    setSelectedQueueItem(null);
    setActiveRowId(null);
  }

  function handleRangeChange(nextRangeKey) {
    setActiveRangeKey(nextRangeKey);
  }

  function handleManagementModeChange(nextMode) {
    setProjectManagementMode(nextMode);
    setProjectManagementSearch("");
    setProjectActionDialog(null);
  }

  function openProjectActionDialog(mode) {
    if (!selectedManagedProject) {
      return;
    }

    setProjectActionDialog({
      mode,
      project: selectedManagedProject
    });
  }

  function openApprovalDialog(row) {
    setApprovalDialog(row);
    setApprovalIntroText("");
  }

  function closeApprovalDialog() {
    if (activeRowId === approvalDialog?.id) {
      return;
    }

    setApprovalDialog(null);
    setApprovalIntroText("");
  }

  async function confirmApproval() {
    if (!approvalDialog) {
      return;
    }

    await moderateSubmission(approvalDialog, "approved", {
      approvedIntroText: approvalIntroText
    });
  }

  async function confirmProjectAction() {
    if (!browserSupabase || !projectActionDialog?.project?.id) {
      return;
    }

    const { mode, project } = projectActionDialog;
    setActiveRowId(project.id);
    setStatus(null);

    let payload;

    if (mode === "restore") {
      payload = {
        deleted_at: null,
        restore_until: null
      };
    } else {
      const deletedAt = new Date();
      const restoreUntil = new Date(deletedAt);
      restoreUntil.setMonth(restoreUntil.getMonth() + 2);
      payload = {
        deleted_at: deletedAt.toISOString(),
        restore_until: restoreUntil.toISOString()
      };
    }

    const { error } = await browserSupabase
      .from("submission_requests")
      .update(payload)
      .eq("id", project.id)
      .eq("status", "approved");

    if (error) {
      setStatus({ type: "error", message: error.message });
      setActiveRowId(null);
      return;
    }

    await refreshDashboard();
    setProjectActionDialog(null);
    setStatus({
      type: "success",
      message:
        mode === "restore"
          ? "Das Projekt wurde wiederhergestellt und ist wieder sichtbar."
          : "Das Projekt wurde ausgeblendet und kann zwei Monate lang wiederhergestellt werden."
    });
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
          <p className="auth-intro">
            Melde dich an oder erstelle direkt ein Konto. Du hast zwei Wege:
          </p>

          <div className="auth-options">
            <div className="auth-option-card">
              <strong>Mit E-Mail-Link</strong>
              <p>
                Gib nur deine E-Mail ein und drücke dann auf den Link-Button. Die Mail dient zum
                Anmelden oder Registrieren.
              </p>
            </div>

            <div className="auth-option-card">
              <strong>Mit Passwort</strong>
              <p>
                Gib E-Mail und Passwort ein. Der Button meldet dich an oder erstellt automatisch
                ein neues Konto.
              </p>
            </div>
          </div>

          <form className="dashboard-login-form" onSubmit={continueWithPassword}>
            <label className="field">
              <span className="field-label">E-Mail</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@beispiel.de"
              />
            </label>

            <label className="field">
              <span className="field-label">Passwort</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Passwort"
              />
            </label>

            <div className="button-row">
              <button type="submit" className="button" disabled={isSigningIn}>
                {isSigningIn ? "Prüft Konto..." : "Anmelden / Registrieren"}
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={isSendingLink}
                onClick={sendMagicLink}
              >
                {isSendingLink ? "Sendet Link..." : "Login-Link per E-Mail senden"}
              </button>
            </div>
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
    <>
      <section className="dashboard-stack">
        <article className={`card ${isAdmin ? "" : "creator-dashboard-hero"}`.trim()}>
          <div className="admin-bar">
            <div>
              <p className="dashboard-eyebrow">
                {isAdmin ? "Moderation und Übersicht" : "Dein Creator-Bereich"}
              </p>
              <h1 style={{ marginBottom: "0.35rem" }}>Creator-Dashboard</h1>
              <p style={{ marginTop: 0 }}>Angemeldet als {sessionEmail}</p>
            </div>
            <div className="button-row dashboard-header-actions">
              <Link href="/creator/dashboard/security" className="button button-secondary">
                Passwort setzen
              </Link>
              <button type="button" className="button button-secondary" onClick={signOut}>
                Abmelden
              </button>
            </div>
          </div>

          {!isAdmin ? (
            <div className="creator-dashboard-highlight-grid">
              <div className="creator-highlight-box">
                <span className="creator-highlight-label">Freigegebene Projekte</span>
                <strong className="creator-highlight-value">{releasedProjectCount}</strong>
              </div>
              <div className="creator-highlight-box">
                <span className="creator-highlight-label">Offene Einreichungen</span>
                <strong className="creator-highlight-value">{pendingSubmissions.length}</strong>
              </div>
              <div className="creator-highlight-box">
                <span className="creator-highlight-label">Aktiver Zeitraum</span>
                <strong className="creator-highlight-value creator-highlight-value-small">
                  {activeRangeLabel}
                </strong>
              </div>
            </div>
          ) : null}
        </article>

        <article className={`card ${isAdmin ? "" : "creator-dashboard-summary-card"}`.trim()}>
          <div className="section-header">
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "0.45rem" }}>
                {isAdmin ? "Dashboard-Übersicht" : "Deine Projektstatistiken"}
              </h2>
              <p style={{ marginTop: 0 }}>
                {isAdmin
                  ? "Hier siehst du alle Kennzahlen inklusive Freigaben und Moderation."
                  : "Hier siehst du nur die Kennzahlen, die direkt deine Projekte betreffen."}
              </p>
            </div>

            <div className="dashboard-range-picker" role="tablist" aria-label="Zeitraum wählen">
              {dashboardRangeOptions.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  className={`dashboard-range-chip ${
                    activeRangeKey === range.key ? "dashboard-range-chip-active" : ""
                  }`.trim()}
                  onClick={() => handleRangeChange(range.key)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {!isAdmin ? (
            <p className="dashboard-range-note">
              Der Zeitraum wirkt auf Aufrufe, Klicks, Mehr Infos und Originalseite. Einreichungen
              und Freigaben bleiben Gesamtwerte.
            </p>
          ) : null}
        </article>

        {status ? (
          <p
            className={`form-status ${
              status.type === "success" ? "form-status-success" : "form-status-error"
            }`}
          >
            {status.message}
          </p>
        ) : null}

        {isAdmin ? (
          <section className="dashboard-metrics">
            <div className="metric-grid metric-grid-admin">
              {topMetricCards.map((metric) => (
                <article key={metric.key} className="card stat-card compact-stat-card">
                  <span className="stat-label">{metric.label}</span>
                  <strong className="stat-value">{metric.value}</strong>
                  <Link
                    href={buildDetailsHref(metric.key, activeRangeKey)}
                    className="button button-secondary stat-button"
                  >
                    {metric.buttonLabel}
                  </Link>
                </article>
              ))}
            </div>

            {bottomMetricCards.length ? (
              <div className="metric-grid metric-grid-secondary">
                {bottomMetricCards.map((metric) => (
                  <article key={metric.key} className="card stat-card compact-stat-card">
                    <span className="stat-label">{metric.label}</span>
                    <strong className="stat-value">{metric.value}</strong>
                    <Link
                      href={buildDetailsHref(metric.key, activeRangeKey)}
                      className="button button-secondary stat-button"
                    >
                      {metric.buttonLabel}
                    </Link>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="creator-dashboard-shell">
            <div className="dashboard-metrics">
              <div className="metric-grid metric-grid-creator">
                {visibleMetricCards.map((metric) => (
                  <article key={metric.key} className="card stat-card creator-stat-card">
                    <span className="stat-label">{metric.label}</span>
                    <strong className="stat-value">{metric.value}</strong>
                    <p className="creator-stat-copy">{metric.description}</p>
                    <Link
                      href={buildDetailsHref(metric.key, activeRangeKey)}
                      className="button button-secondary stat-button"
                    >
                      {metric.buttonLabel}
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            <article className="card creator-project-panel">
              <div className="section-header">
                <div>
                  <h2 style={{ marginBottom: "0.35rem" }}>Deine Projekte</h2>
                  <p style={{ marginTop: 0 }}>
                    Im Zeitraum <strong>{activeRangeLabel}</strong> siehst du hier, welche Projekte
                    gerade am meisten Interaktionen haben.
                  </p>
                </div>
                <span className="status-pill">{publishedProjects.length} sichtbar</span>
              </div>

              {isLoading ? (
                <p>Lade deine Projekte...</p>
              ) : publishedProjects.length ? (
                <div className="creator-project-list">
                  {publishedProjects.map((project) => (
                    <article key={project.id} className="creator-project-item">
                      <div>
                        <div className="creator-project-meta-row">
                          <span className="status-pill creator-project-status">
                            {project.statusLabel}
                          </span>
                          <span className="creator-project-activity">
                            {project.activityCount} Interaktionen
                          </span>
                        </div>
                        <h3>{project.title}</h3>
                        <p>{project.meta}</p>
                        <small>Letzte Aktivität: {formatShortDate(project.latestActivity)}</small>
                      </div>
                      <Link href={project.href} className="button button-secondary">
                        Projekt ansehen
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p>
                  Sobald eines deiner Projekte freigegeben ist oder Interaktionen gesammelt werden,
                  erscheint es hier.
                </p>
              )}
            </article>
          </section>
        )}

        {isAdmin ? (
          <>
            <article className="card">
              <div className="section-header">
                <div>
                  <h2 style={{ marginBottom: "0.35rem" }}>Moderationswarteschlange</h2>
                  <p style={{ marginTop: 0 }}>
                    Standardmäßig bleiben die Karten kompakt. Über Infos siehst du alle Details zur
                    Einreichung.
                  </p>
                </div>
                <span className="status-pill">{queue.length} offen</span>
              </div>

              {isLoading ? (
                <p>Lade Moderation...</p>
              ) : queue.length ? (
                <div className="queue-list">
                  {queue.map((row) => (
                    <article key={row.id} className="queue-item">
                      <div className="queue-copy">
                        <div className="section-header">
                          <div>
                            <h3 style={{ marginBottom: "0.35rem" }}>Projektname: {row.project_name}</h3>
                            <p className="queue-meta queue-summary" style={{ marginTop: 0 }}>
                              Website oder Kanal: {row.website_url || "-"}
                            </p>
                          </div>
                          <span className="status-pill status-pill-pending">Ausstehend</span>
                        </div>

                        {row.duplicateSummary ? (
                          <div className="queue-duplicate-box">
                            <strong>{row.duplicateSummary}</strong>
                            <div className="queue-duplicate-list">
                              {row.duplicateMatches.slice(0, 3).map((match) => (
                                <span key={`${row.id}-${match.id}`} className="queue-duplicate-chip">
                                  {match.project_name} · {match.status}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="queue-actions">
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => setSelectedQueueItem(row)}
                        >
                          Infos
                        </button>
                        {row.website_url ? (
                          <a
                            href={row.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-secondary"
                          >
                            Website öffnen
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="button"
                          disabled={activeRowId === row.id}
                          onClick={() => openApprovalDialog(row)}
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

            <article className="card">
              <div className="section-header">
                <div>
                  <p className="dashboard-eyebrow">{managementCopy.eyebrow}</p>
                  <h2 style={{ marginTop: 0, marginBottom: "0.35rem" }}>{managementCopy.title}</h2>
                  <p style={{ marginTop: 0 }}>{managementCopy.description}</p>
                </div>
                <div className="management-mode-switch" role="tablist" aria-label="Projektverwaltung">
                  <button
                    type="button"
                    className={`dashboard-range-chip ${
                      projectManagementMode === "delete" ? "dashboard-range-chip-active" : ""
                    }`.trim()}
                    onClick={() => handleManagementModeChange("delete")}
                  >
                    Löschen
                  </button>
                  <button
                    type="button"
                    className={`dashboard-range-chip ${
                      projectManagementMode === "restore" ? "dashboard-range-chip-active" : ""
                    }`.trim()}
                    onClick={() => handleManagementModeChange("restore")}
                  >
                    Wiederherstellen
                  </button>
                </div>
              </div>

              <div className="management-layout">
                <div className="management-list-pane">
                  <label className="field" style={{ marginTop: 0 }}>
                    <span className="field-label">Suche</span>
                    <input
                      className="input management-search-field"
                      type="search"
                      value={projectManagementSearch}
                      onChange={(event) => setProjectManagementSearch(event.target.value)}
                      placeholder={managementCopy.searchPlaceholder}
                    />
                  </label>

                  {filteredManageableProjects.length ? (
                    <div className="management-project-list">
                      {filteredManageableProjects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          className={`management-project-button ${
                            selectedManagedProject?.id === project.id
                              ? "management-project-button-active"
                              : ""
                          }`.trim()}
                          onClick={() => setSelectedManagedProjectId(project.id)}
                        >
                          <strong>{project.project_name}</strong>
                          <span>{project.creator_name || "Ohne Namen"}</span>
                          <small>{project.website_url || project.public_slug || "Ohne Link"}</small>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="management-empty-state">
                      <strong>{managementCopy.emptyTitle}</strong>
                      <p>{managementCopy.emptyCopy}</p>
                    </div>
                  )}
                </div>

                <div className="management-preview-card">
                  {selectedManagedProject ? (
                    <>
                      <div className="management-preview-media">
                        <img
                          src={getPreviewImage(selectedManagedProject)}
                          alt={`Vorschau von ${selectedManagedProject.project_name}`}
                          className="management-preview-image"
                        />
                      </div>

                      <div className="management-preview-copy">
                        <div className="creator-project-meta-row">
                          <span className="status-pill">
                            {projectManagementMode === "restore"
                              ? managementCopy.previewStatus
                              : selectedManagedProject.deleted_at
                                ? "Gelöscht"
                                : managementCopy.previewStatus}
                          </span>
                          {selectedManagedProject.public_slug ? (
                            <span className="status-pill">{selectedManagedProject.public_slug}</span>
                          ) : null}
                        </div>

                        <h3>{selectedManagedProject.project_name}</h3>
                        <p className="queue-info-line">
                          <strong>Creator:</strong> {selectedManagedProject.creator_name || "-"}
                        </p>
                        <p className="queue-info-line">
                          <strong>Website oder Kanal:</strong>{" "}
                          {selectedManagedProject.website_url || "-"}
                        </p>
                        <p className="queue-info-line">
                          <strong>Freigegeben am:</strong>{" "}
                          {formatLongDate(selectedManagedProject.approved_at)}
                        </p>
                        {selectedManagedProject.restore_until ? (
                          <p className="queue-info-line">
                            <strong>Wiederherstellbar bis:</strong>{" "}
                            {formatLongDate(selectedManagedProject.restore_until)}
                          </p>
                        ) : null}
                        <p className="queue-info-line queue-info-description">
                          <strong>Text:</strong>{" "}
                          {selectedManagedProject.approved_intro_text ||
                            selectedManagedProject.description ||
                            "-"}
                        </p>
                      </div>

                      <div className="button-row">
                        {selectedManagedProject.website_url ? (
                          <a
                            href={selectedManagedProject.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="button button-secondary"
                          >
                            Website öffnen
                          </a>
                        ) : null}
                        {selectedManagedProject.public_slug ? (
                          <Link
                            href={`/projekte/${selectedManagedProject.public_slug}`}
                            className="button button-secondary"
                          >
                            Projektseite öffnen
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className={`button ${
                            projectManagementMode === "delete" ? "button-danger" : ""
                          }`.trim()}
                          disabled={activeRowId === selectedManagedProject.id}
                          onClick={() => openProjectActionDialog(projectManagementMode)}
                        >
                          {managementCopy.actionLabel}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="management-empty-state">
                      <strong>Keine Vorschau verfügbar.</strong>
                      <p>Wähle links ein Projekt aus, damit du rechts sofort die Vorschau siehst.</p>
                    </div>
                  )}
                </div>
              </div>
            </article>
          </>
        ) : null}
      </section>

      <TextPromptOverlay
        open={Boolean(selectedQueueItem)}
        onClose={() => setSelectedQueueItem(null)}
        confirmLabel="Schließen"
        transparentBackdrop
        warmSurface
        title="Einreichungsdetails"
      >
        {selectedQueueItem ? (
          <div className="queue-info-grid">
            {selectedQueueItem.duplicateSummary ? (
              <div className="queue-duplicate-box">
                <strong>{selectedQueueItem.duplicateSummary}</strong>
                <div className="queue-duplicate-list">
                  {selectedQueueItem.duplicateMatches.map((match) => (
                    <span
                      key={`${selectedQueueItem.id}-${match.id}`}
                      className="queue-duplicate-chip"
                    >
                      {match.project_name} · {match.status}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <p className="queue-info-line">
              <strong>Name:</strong> {selectedQueueItem.creator_name}
            </p>
            <p className="queue-info-line">
              <strong>E-Mail:</strong> {selectedQueueItem.email}
            </p>
            <p className="queue-info-line">
              <strong>Projektname:</strong> {selectedQueueItem.project_name}
            </p>
            <p className="queue-info-line">
              <strong>Website oder Kanal:</strong> {selectedQueueItem.website_url || "-"}
            </p>
            <p className="queue-info-line">
              <strong>Vorschaubild-URL:</strong> {selectedQueueItem.card_image_url || "-"}
            </p>
            <p className="queue-info-line queue-info-description">
              <strong>Beschreibung:</strong> {selectedQueueItem.description || "-"}
            </p>
          </div>
        ) : null}
      </TextPromptOverlay>

      <TextPromptOverlay
        open={Boolean(approvalDialog)}
        onClose={closeApprovalDialog}
        onConfirm={confirmApproval}
        secondaryLabel="Abbrechen"
        onSecondaryAction={closeApprovalDialog}
        confirmLabel="Freigeben"
        transparentBackdrop
        title="Freigabe mit eigenem Text"
      >
        {approvalDialog ? (
          <div className="queue-info-grid">
            <p className="queue-info-line">
              <strong>Projekt:</strong> {approvalDialog.project_name}
            </p>
            <p className="queue-info-line queue-info-description">
              <strong>Beschreibung-Fallback:</strong> {approvalDialog.description || "-"}
            </p>
            <p className="queue-info-line">
              Dieser Text erscheint später in der Blende. Lässt du das Feld leer, wird automatisch
              die Beschreibung der Einreichung verwendet.
            </p>
            <label className="field" style={{ marginTop: 0 }}>
              <span className="field-label">Blenden-Text</span>
              <textarea
                className="textarea"
                value={approvalIntroText}
                onChange={(event) => setApprovalIntroText(event.target.value)}
                placeholder="Text für die Blende eingeben"
              />
            </label>
          </div>
        ) : null}
      </TextPromptOverlay>

      <TextPromptOverlay
        open={Boolean(projectActionDialog)}
        onClose={() => setProjectActionDialog(null)}
        onConfirm={confirmProjectAction}
        secondaryLabel="Abbrechen"
        onSecondaryAction={() => setProjectActionDialog(null)}
        confirmLabel={
          projectActionDialog
            ? getProjectManagementCopy(projectActionDialog.mode).confirmLabel
            : "Bestätigen"
        }
        transparentBackdrop
        dangerSurface
        dangerConfirm={projectActionDialog?.mode === "delete"}
        title={
          projectActionDialog
            ? getProjectManagementCopy(projectActionDialog.mode).confirmQuestion
            : ""
        }
      >
        {projectActionDialog?.project ? (
          <div className="queue-info-grid">
            <p className="management-warning-copy">
              <strong>Projekt:</strong> {projectActionDialog.project.project_name}
            </p>
            <p className="management-warning-copy">
              <strong>Creator:</strong> {projectActionDialog.project.creator_name || "-"}
            </p>
            {projectActionDialog.mode === "delete" ? (
              <p className="management-warning-copy">
                Das Projekt verschwindet sofort aus der öffentlichen Ansicht und kann danach noch
                zwei Monate lang wiederhergestellt werden.
              </p>
            ) : (
              <p className="management-warning-copy">
                Das Projekt wird wieder öffentlich sichtbar und mit seinen bisherigen Daten
                zurückgebracht.
              </p>
            )}
          </div>
        ) : null}
      </TextPromptOverlay>
    </>
  );
}
