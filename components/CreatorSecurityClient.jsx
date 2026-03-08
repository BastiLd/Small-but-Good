"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { browserSupabase } from "../lib/supabase-browser";

export default function CreatorSecurityClient() {
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!browserSupabase) {
      return;
    }

    browserSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });
  }, []);

  async function savePassword(event) {
    event.preventDefault();

    if (!browserSupabase) {
      return;
    }

    if (!password || password.length < 8) {
      setStatus({ type: "error", message: "Das Passwort muss mindestens 8 Zeichen haben." });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Die beiden Passwörter stimmen nicht überein." });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    const { error } = await browserSupabase.auth.updateUser({ password });

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      setPassword("");
      setConfirmPassword("");
      setStatus({
        type: "success",
        message: "Passwort gespeichert. Danach kannst du dich direkt ohne E-Mail anmelden."
      });
    }

    setIsSaving(false);
  }

  if (!session) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Passwort setzen</h1>
          <p>Bitte melde dich zuerst im Creator-Dashboard an.</p>
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
            <h1 style={{ marginBottom: "0.35rem" }}>Passwort setzen</h1>
            <p style={{ marginTop: 0 }}>
              Setze einmal ein Passwort. Danach kannst du dich ohne neue Login-Mail anmelden.
            </p>
          </div>
          <Link href="/creator/dashboard" className="button button-secondary">
            Zurück zum Dashboard
          </Link>
        </div>

        <form className="dashboard-login-form" onSubmit={savePassword}>
          <label className="field">
            <span className="field-label">Neues Passwort</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mindestens 8 Zeichen"
            />
          </label>

          <label className="field">
            <span className="field-label">Passwort wiederholen</span>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Passwort wiederholen"
            />
          </label>

          <button type="submit" className="button" disabled={isSaving}>
            {isSaving ? "Speichert..." : "Passwort speichern"}
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
