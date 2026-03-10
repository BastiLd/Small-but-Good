"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "../lib/basePath";
import { ensureCreatorProfile } from "../lib/creator-profile";
import { findPublicSubmissionDuplicates } from "../lib/public-submission-duplicates";
import { browserSupabase } from "../lib/supabase-browser";
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

function getMailImageValue(imageUrl) {
  if (!imageUrl) {
    return "-";
  }

  if (/^data:image\//i.test(imageUrl)) {
    return "[lokal hochgeladenes Bild - bitte mit Supabase oder Account senden]";
  }

  return imageUrl;
}

function buildMailtoBody(form) {
  return [
    `Name: ${form.creatorName}`,
    `E-Mail: ${form.email}`,
    `Projektname: ${form.projectName}`,
    `Website oder Kanal: ${form.website || "-"}`,
    `Titelbild: ${getMailImageValue(form.imageUrl)}`,
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

function loadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Das Bild konnte nicht verarbeitet werden."));
    image.src = src;
  });
}

async function optimizeImageFile(file) {
  const dataUrl = await loadFileAsDataUrl(file);

  if (file.type === "image/svg+xml" || dataUrl.length <= 1_400_000) {
    return dataUrl;
  }

  const image = await loadImageElement(dataUrl);
  const maxDimension = 1600;
  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
  );
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  const targetType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const optimized = canvas.toDataURL(targetType, targetType === "image/png" ? undefined : 0.84);

  return optimized.length < dataUrl.length ? optimized : dataUrl;
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
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const previewImage = useMemo(
    () => withBasePath(form.imageUrl.trim() || "/images/project-placeholder.svg"),
    [form.imageUrl]
  );
  const previewWebsite = useMemo(() => form.website.trim(), [form.website]);

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

    try {
      const nextDraft =
        /^data:image\//i.test(form.imageUrl) && form.imageUrl.length > 160_000
          ? { ...form, imageUrl: "" }
          : form;
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
    } catch {
      // Ignore local storage quota issues for large client-side image uploads.
    }
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

  useEffect(() => {
    if (!hasLoadedDraft || typeof window === "undefined") {
      return;
    }

    const hasCandidate = form.projectName.trim() || form.website.trim();

    if (!hasCandidate) {
      setDuplicateMatches([]);
      setIsCheckingDuplicates(false);
      return;
    }

    let active = true;
    setIsCheckingDuplicates(true);

    const timeoutId = window.setTimeout(async () => {
      const matches = await findPublicSubmissionDuplicates({
        project_name: form.projectName.trim(),
        website_url: form.website.trim()
      });

      if (!active) {
        return;
      }

      setDuplicateMatches(matches.slice(0, 4));
      setIsCheckingDuplicates(false);
    }, 260);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [form.projectName, form.website, hasLoadedDraft]);

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
    setDuplicateMatches([]);
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

  async function handleImageSelection(file) {
    if (!file) {
      return;
    }

    try {
      const dataUrl = await optimizeImageFile(file);

      if (dataUrl.length > 3_000_000) {
        throw new Error(
          "Das Bild ist nach dem Verkleinern noch zu groß. Bitte nimm eine kleinere Datei."
        );
      }

      setForm((current) => ({ ...current, imageUrl: dataUrl }));
      setStatus(null);
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.message || "Das Bild konnte nicht verarbeitet werden."
      });
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
      message: /^data:image\//i.test(form.imageUrl)
        ? "Dein E-Mail-Programm wurde geöffnet. Für hochgeladene Bilder nutze bitte am besten \"Mit Supabase senden\" oder \"Mit Account\"."
        : "Dein E-Mail-Programm wurde mit den eingetragenen Daten geöffnet."
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
        <div className="submit-layout">
          <div className="submit-form-column">
            {isLoggedIn ? (
              <p className="submit-account-note">
                Du bist angemeldet als <strong>{session.user.email}</strong>. Mit dem Button{" "}
                <strong>Mit Account</strong> wird die Einreichung direkt mit deinem Konto verknüpft.
              </p>
            ) : (
              <p className="submit-account-note">
                Du kannst weiter ohne Account einreichen oder dich zuerst anmelden und dann mit
                deinem Konto einreichen.
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
              <span className="field-label">Titelbild-URL (optional)</span>
              <input
                className="input"
                name="imageUrl"
                value={form.imageUrl}
                onChange={updateField}
                placeholder="https://.../bild.png oder Imgur-Link"
              />
            </label>
            <p className="submit-image-note">
              Du kannst hier einen direkten Link einfügen, zum Beispiel von Imgur, oder direkt ein
              Bild hochladen.
            </p>

            <div className="submit-image-tools">
              <label className="button button-secondary">
                Titelbild hochladen
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    await handleImageSelection(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {form.imageUrl ? (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setForm((current) => ({ ...current, imageUrl: "" }))}
                >
                  Titelbild entfernen
                </button>
              ) : null}
            </div>

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

            {isCheckingDuplicates ? (
              <p className="submit-duplicate-note">Prüfe gerade auf exakte Dubletten...</p>
            ) : null}

            {duplicateMatches.length ? (
              <div className="submit-duplicate-warning">
                <strong>Mögliche Dublette erkannt</strong>
                <p>
                  Projektname oder Website stimmen exakt mit einer vorhandenen Einreichung überein.
                  Du kannst trotzdem weitermachen, solltest die Daten aber kurz prüfen.
                </p>
                <div className="submit-duplicate-list">
                  {duplicateMatches.map((match) => (
                    <span key={match.id} className="submit-duplicate-chip">
                      {match.project_name} · {match.status}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="button-row">
              <button type="button" className="button button-secondary" onClick={handleEmailClick}>
                E-Mail öffnen
              </button>
              <button
                type="button"
                className="button"
                onClick={handleSupabaseClick}
                disabled={isSaving}
              >
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
          </div>

          <aside className="submit-preview-card">
            <p className="dashboard-eyebrow">Live-Vorschau</p>
            <h2 style={{ marginTop: 0 }}>So wirkt deine Einreichung</h2>
            <div className="submit-preview-media-wrap">
              <img
                src={previewImage}
                alt={form.projectName.trim() || "Projektvorschau"}
                className="submit-preview-image"
              />
            </div>
            <div className="submit-preview-content">
              <strong className="submit-preview-title">
                {form.projectName.trim() || "Projektname erscheint hier"}
              </strong>
              <p className="submit-preview-description">
                {form.description.trim() || "Deine Beschreibung erscheint hier in der Vorschau."}
              </p>
              <div className="detail-chip-row">
                <span className="detail-chip">{form.creatorName.trim() || "Dein Name"}</span>
                <span className="detail-chip">{previewWebsite || "Website oder Kanal"}</span>
              </div>
              {previewWebsite ? (
                <a
                  href={previewWebsite}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-secondary submit-preview-link"
                >
                  Website testen
                </a>
              ) : null}
            </div>
          </aside>
        </div>
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
