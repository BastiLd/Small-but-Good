"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { browserSupabase } from "../lib/supabase-browser";
import { trackInteraction } from "../lib/interaction-tracking";
import {
  buildMetricCards,
  creatorMetricKeys,
  fetchCreatorDashboardData,
  primaryMetricKeys,
  secondaryMetricKeys
} from "../lib/creator-dashboard";
import TextPromptOverlay from "./TextPromptOverlay";

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
  const topMetricCards = visibleMetricCards.slice(0, isAdmin ? 4 : 2);
  const bottomMetricCards = visibleMetricCards.slice(isAdmin ? 4 : 2);

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
    if (!browserSupabase || !sessionEmail) {
      return;
    }

    let active = true;

    async function loadDashboard() {
      setIsLoading(true);
      const dashboardData = await fetchCreatorDashboardData(sessionEmail, isAdmin);

      if (!active || !dashboardData) {
        return;
      }

      setStats(dashboardData.stats);
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
      setSelectedQueueItem(null);
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
        <article className="card">
          <div className="admin-bar">
            <div>
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
        </article>

        <article className="card">
          <h2 style={{ marginTop: 0, marginBottom: "0.45rem" }}>
            {isAdmin ? "Dashboard-Übersicht" : "Deine Projektstatistiken"}
          </h2>
          <p style={{ marginTop: 0 }}>
            {isAdmin
              ? "Hier siehst du alle Kennzahlen inklusive Freigaben und Moderation."
              : "Hier siehst du nur die Kennzahlen, die direkt deine Projekte betreffen."}
          </p>
        </article>

        <section className="dashboard-metrics">
          <div className="metric-grid">
            {topMetricCards.map((metric) => (
              <article key={metric.key} className="card stat-card compact-stat-card">
                <span className="stat-label">{metric.label}</span>
                <strong className="stat-value">{metric.value}</strong>
                <Link
                  href={`/creator/dashboard/details?metric=${metric.key}`}
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
                    href={`/creator/dashboard/details?metric=${metric.key}`}
                    className="button button-secondary stat-button"
                  >
                    {metric.buttonLabel}
                  </Link>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        {isAdmin ? (
          <article className="card">
            <div className="section-header">
              <div>
                <h2 style={{ marginBottom: "0.35rem" }}>Moderationswarteschlange</h2>
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
                          <h3 style={{ marginBottom: "0.35rem" }}>Projektname: {row.project_name}</h3>
                          <p className="queue-meta queue-summary" style={{ marginTop: 0 }}>
                            Website oder Kanal: {row.website_url || "-"}
                          </p>
                        </div>
                        <span className="status-pill status-pill-pending">Ausstehend</span>
                      </div>
                    </div>

                    <div className="queue-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setSelectedQueueItem(row)}
                      >
                        Infos
                      </button>
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
    </>
  );
}
