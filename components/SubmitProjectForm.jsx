"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "../lib/supabase-browser";
import { ensureCreatorProfile } from "../lib/creator-profile";
import TextPromptOverlay from "./TextPromptOverlay";

const DRAFT_STORAGE_KEY = "submit-project-form-draft";
const GUEST_PROMPT_STORAGE_KEY = "submit-project-account-prompt-seen";

const initialForm = {
  creatorName: "",
  email: "",
  projectName: "",
  website: "",
  imageUrl: "",
  description: ""
};

function buildMailtoBody(form) {
  return [
    `Name: ${form.creatorName}`,
    `E-Mail: ${form.email}`,
    `Projektname: ${form.projectName}`,
    `Website oder Kanal: ${form.website || "-"}`,
    `Vorschaubild-URL: ${form.imageUrl || "-"}`,
    "",
    "Beschreibung:",
    form.description
  ].join("\n");
}

function getDraftFromStorage() {
  if (typeof window === "undefined") {
    return initialForm;
  }

  try {
    const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) {
      return initialForm;
    }

    return { ...initialForm, ...JSON.parse(stored) };
  } catch {
    return initialForm;
  }
}

export default function SubmitProjectForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestPromptSeen, setGuestPromptSeen] = useState(false);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);

  useEffect(() => {
    setForm(getDraftFromStorage());
    setHasLoadedDraft(true);

    if (typeof window !== "undefined") {
      setGuestPromptSeen(window.sessionStorage.getItem(GUEST_PROMPT_STORAGE_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (!browserSupabase) {
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
    if (!hasLoadedDraft || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
  }, [form, hasLoadedDraft]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    setForm((current) => ({
      ...current,
      creatorName:
        current.creatorName ||
        session.user.user_metadata?.display_name ||
        session.user.user_metadata?.full_name ||
        "",
      email: current.email || session.user.email || ""
    }));
  }, [session]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validateForm() {
    if (
      !form.creatorName.trim() ||
      !form.email.trim() ||
      !form.projectName.trim() ||
      !form.description.trim()
    ) {
      setStatus({
        type: "error",
        message: "Bitte fülle Name, E-Mail, Projektname und Beschreibung aus."
      });
      return false;
    }

    return true;
  }

  function clearDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    setForm(initialForm);
  }

  function maybeShowGuestPrompt() {
    if (session || guestPromptSeen) {
      return false;
    }

    setShowGuestPrompt(true);
    return true;
  }

  function acknowledgeGuestPrompt() {
    setGuestPromptSeen(true);
    setShowGuestPrompt(false);

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(GUEST_PROMPT_STORAGE_KEY, "1");
    }
  }

  function openEmail() {
    if (!validateForm()) {
      return;
    }

    const subject = encodeURIComponent(`Projektvorschlag: ${form.projectName.trim()}`);
    const body = encodeURIComponent(buildMailtoBody(form));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setStatus({
      type: "success",
      message: "Dein E-Mail-Programm wurde mit den eingetragenen Daten geöffnet."
    });
  }

  async function insertSubmission(payload) {
    const { error } = await browserSupabase.from("submission_requests").insert([payload]);

    if (!error) {
      return null;
    }

    if (/account_email|account_user_id|submitted_with_account|creator_id/i.test(error.message || "")) {
      const fallbackPayload = {
        creator_name: payload.creator_name,
        email: payload.email,
        project_name: payload.project_name,
        website_url: payload.website_url,
        card_image_url: payload.card_image_url,
        description: payload.description,
        source: payload.source
      };

      const fallbackResponse = await browserSupabase
        .from("submission_requests")
        .insert([fallbackPayload]);

      return fallbackResponse.error || null;
    }

    return error;
  }

  async function saveToSupabase({ withAccount }) {
    if (!validateForm()) {
      return;
    }

    if (!browserSupabase) {
      setStatus({
        type: "error",
        message: "Supabase ist im Browser noch nicht konfiguriert."
      });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      let creatorId = null;

      if (withAccount && session?.user) {
        creatorId = await ensureCreatorProfile({
          user: session.user,
          fallbackName: form.creatorName.trim()
        });
      }

      const payload = {
        creator_name: form.creatorName.trim(),
        email: form.email.trim().toLowerCase(),
        project_name: form.projectName.trim(),
        website_url: form.website.trim() || null,
        card_image_url: form.imageUrl.trim() || null,
        description: form.description.trim(),
        source: "website",
        submitted_with_account: Boolean(withAccount && session?.user),
        account_email: withAccount && session?.user?.email ? session.user.email.toLowerCase() : null,
        account_user_id: withAccount && session?.user?.id ? session.user.id : null,
        creator_id: creatorId
      };

      const error = await insertSubmission(payload);

      if (error) {
        throw error;
      }

      clearDraft();
      setStatus({
        type: "success",
        message:
          withAccount && session?.user
            ? "Dein Projekt wurde mit deinem Account gespeichert und wartet jetzt auf Freigabe."
            : "Dein Projekt wurde in Supabase gespeichert und wartet jetzt auf Freigabe."
      });
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.message || "Das Speichern in Supabase ist fehlgeschlagen."
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleEmailClick() {
    if (maybeShowGuestPrompt()) {
      return;
    }

    openEmail();
  }

  function handleSupabaseClick() {
    if (maybeShowGuestPrompt()) {
      return;
    }

    saveToSupabase({ withAccount: false });
  }

  function handleAccountClick() {
    if (maybeShowGuestPrompt()) {
      return;
    }

    if (!session?.user) {
      router.push("/creator/dashboard");
      return;
    }

    saveToSupabase({ withAccount: true });
  }

  const isLoggedIn = Boolean(session?.user);

  return (
    <>
      <form onSubmit={(event) => event.preventDefault()}>
        {isLoggedIn ? (
          <p className="submit-account-note">
            Du bist angemeldet als <strong>{session.user.email}</strong>. Mit dem Button{" "}
            <strong>Mit Account</strong> wird die Einreichung direkt mit deinem Konto verknüpft.
          </p>
        ) : (
          <p className="submit-account-note">
            Du kannst weiter ohne Account einreichen oder dich zuerst anmelden und dann mit deinem
            Konto einreichen.
          </p>
        )}

        <label className="field">
          <span className="field-label">Dein Name</span>
          <input
            className="input"
            name="creatorName"
            value={form.creatorName}
            onChange={updateField}
            placeholder="Zum Beispiel Bastian"
          />
        </label>

        <label className="field">
          <span className="field-label">E-Mail</span>
          <input
            className="input"
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            placeholder="name@beispiel.de"
          />
        </label>

        <label className="field">
          <span className="field-label">Projektname</span>
          <input
            className="input"
            name="projectName"
            value={form.projectName}
            onChange={updateField}
            placeholder="Mein Projekt"
          />
        </label>

        <label className="field">
          <span className="field-label">Website oder Kanal</span>
          <input
            className="input"
            name="website"
            value={form.website}
            onChange={updateField}
            placeholder="https://..."
          />
        </label>

        <label className="field">
          <span className="field-label">Vorschaubild-URL (optional)</span>
          <input
            className="input"
            name="imageUrl"
            value={form.imageUrl}
            onChange={updateField}
            placeholder="https://.../bild.png"
          />
        </label>

        <label className="field">
          <span className="field-label">Beschreibung</span>
          <textarea
            className="textarea"
            name="description"
            value={form.description}
            onChange={updateField}
            placeholder="Beschreibe kurz, was dein Projekt besonders macht."
          />
        </label>

        <div className="button-row">
          <button type="button" className="button button-secondary" onClick={handleEmailClick}>
            E-Mail öffnen
          </button>
          <button type="button" className="button" onClick={handleSupabaseClick} disabled={isSaving}>
            {isSaving ? "Wird gespeichert..." : "Mit Supabase senden"}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleAccountClick}
            disabled={isSaving}
          >
            {isSaving ? "Wird gespeichert..." : "Mit Account"}
          </button>
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
      </form>

      <TextPromptOverlay
        open={showGuestPrompt}
        onClose={acknowledgeGuestPrompt}
        confirmLabel="Verstanden"
      >
        Wenn du dich anmeldest und es mit deinem Account einreichst, können Leute auf dein Profil
        gehen und deine Projekte sehen. Also melde dich doch an ;-)
      </TextPromptOverlay>
    </>
  );
}
