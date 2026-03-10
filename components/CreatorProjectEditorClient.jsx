"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { withBasePath } from "../lib/basePath";
import {
  createProjectSection,
  DEFAULT_EXTERNAL_BUTTON_LABEL,
  isEditorColumnMissingError,
  normalizeProjectSections,
  resolveExternalButtonLabel,
  serializeProjectSections
} from "../lib/project-content";
import { slugify } from "../lib/project-utils";
import { browserSupabase } from "../lib/supabase-browser";
import ProjectContentSections from "./ProjectContentSections";
import styles from "./CreatorProjectEditorClient.module.css";

const PLACEHOLDER_IMAGE = "/images/project-placeholder.svg";
const submissionEditorSelect = [
  "id",
  "creator_name",
  "email",
  "project_name",
  "description",
  "approved_intro_text",
  "website_url",
  "card_image_url",
  "public_slug",
  "status",
  "approved_at",
  "deleted_at",
  "restore_until",
  "external_button_label",
  "detail_sections"
].join(", ");
const submissionFallbackEditorSelect = [
  "id",
  "creator_name",
  "email",
  "project_name",
  "description",
  "approved_intro_text",
  "website_url",
  "card_image_url",
  "public_slug",
  "status",
  "approved_at",
  "deleted_at",
  "restore_until"
].join(", ");
const appEditorSelect = [
  "id",
  "slug",
  "name",
  "short_description",
  "long_description",
  "intro_text",
  "website_url",
  "card_image_url",
  "detail_sections",
  "external_button_label",
  "platform",
  "platform_label",
  "type",
  "type_label",
  "status",
  "feed_order",
  "created_at",
  "creators!apps_creator_id_fkey(display_name, slug, email)"
].join(", ");
const appFallbackEditorSelect = [
  "id",
  "slug",
  "name",
  "short_description",
  "long_description",
  "website_url",
  "status",
  "created_at",
  "creators!apps_creator_id_fkey(display_name, slug, email)"
].join(", ");

function normalizeSource(rawValue) {
  return rawValue === "app" ? "app" : "submission";
}

function buildFormState(row, source) {
  if (source === "app") {
    return {
      projectName: row?.name || "",
      websiteUrl: row?.website_url || "",
      description: row?.short_description || row?.long_description || "",
      introText: row?.intro_text || "",
      cardImageUrl: row?.card_image_url || "",
      externalButtonLabel: row?.external_button_label || "",
      sections: normalizeProjectSections(row?.detail_sections),
      platformLabel: row?.platform_label || row?.platform || "App",
      typeLabel: row?.type_label || row?.type || "Projekt",
      platformValue: row?.platform || "",
      typeValue: row?.type || "",
      detailSlug: row?.slug || "",
      creatorName: row?.creators?.display_name || row?.creators?.email || "CuratedHub"
    };
  }

  return {
    projectName: row?.project_name || "",
    websiteUrl: row?.website_url || "",
    description: row?.description || "",
    introText: row?.approved_intro_text || "",
    cardImageUrl: row?.card_image_url || "",
    externalButtonLabel: row?.external_button_label || "",
    sections: normalizeProjectSections(row?.detail_sections),
    platformLabel: "Community",
    typeLabel: "Freigegeben",
    platformValue: "community",
    typeValue: "submitted_project",
    detailSlug: row?.public_slug || "",
    creatorName: row?.creator_name || row?.email || "Creator"
  };
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

export default function CreatorProjectEditorClient() {
  const [projectId, setProjectId] = useState("");
  const [projectSource, setProjectSource] = useState("submission");
  const [session, setSession] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [project, setProject] = useState(null);
  const [form, setForm] = useState(() => ({
    projectName: "",
    websiteUrl: "",
    description: "",
    introText: "",
    cardImageUrl: "",
    externalButtonLabel: "",
    sections: [],
    platformLabel: "Community",
    typeLabel: "Freigegeben",
    platformValue: "community",
    typeValue: "submitted_project",
    detailSlug: "",
    creatorName: ""
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [schemaWarning, setSchemaWarning] = useState(false);

  const sessionEmail = session?.user?.email || "";
  const previewSections = useMemo(() => serializeProjectSections(form.sections), [form.sections]);
  const previewImage = withBasePath(form.cardImageUrl.trim() || PLACEHOLDER_IMAGE);
  const externalButtonLabel = resolveExternalButtonLabel(form.externalButtonLabel);
  const detailHref =
    projectSource === "app"
      ? form.detailSlug
        ? `/app/${form.detailSlug}`
        : null
      : form.detailSlug
        ? `/projekte/${form.detailSlug}`
        : null;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setProjectId(params.get("id") || "");
    setProjectSource(normalizeSource(params.get("source")));
  }, []);

  useEffect(() => {
    if (!browserSupabase) {
      setIsAuthReady(true);
      return;
    }

    browserSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setIsAuthReady(true);
    });

    const { data: listener } = browserSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setIsAuthReady(true);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!browserSupabase || !sessionEmail) {
      setIsAdmin(false);
      return;
    }

    let active = true;

    async function checkAdmin() {
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

    checkAdmin();

    return () => {
      active = false;
    };
  }, [sessionEmail]);

  useEffect(() => {
    if (!browserSupabase) {
      setIsLoading(false);
      return;
    }

    if (!isAuthReady) {
      return;
    }

    if (!session?.user) {
      setIsLoading(false);
      return;
    }

    if (!projectId) {
      setIsLoading(false);
      return;
    }

    let active = true;

    async function loadProject() {
      setIsLoading(true);

      if (projectSource === "app") {
        let response = await browserSupabase
          .from("apps")
          .select(appEditorSelect)
          .eq("id", projectId)
          .maybeSingle();
        let usesFallback = false;

        if (response.error && isEditorColumnMissingError(response.error)) {
          usesFallback = true;
          response = await browserSupabase
            .from("apps")
            .select(appFallbackEditorSelect)
            .eq("id", projectId)
            .maybeSingle();
        }

        if (!active) {
          return;
        }

        if (response.error || !response.data) {
          setProject(null);
          setStatus({
            type: "error",
            message: response.error?.message || "App-Projekt nicht gefunden oder keine Berechtigung."
          });
          setSchemaWarning(usesFallback);
          setIsLoading(false);
          return;
        }

        setProject(response.data);
        setForm(buildFormState(response.data, "app"));
        setSchemaWarning(usesFallback);
        setStatus(null);
        setIsLoading(false);
        return;
      }

      let response = await browserSupabase
        .from("submission_requests")
        .select(submissionEditorSelect)
        .eq("id", projectId)
        .maybeSingle();
      let usesFallback = false;

      if (response.error && isEditorColumnMissingError(response.error)) {
        usesFallback = true;
        response = await browserSupabase
          .from("submission_requests")
          .select(submissionFallbackEditorSelect)
          .eq("id", projectId)
          .maybeSingle();
      }

      if (!active) {
        return;
      }

      if (response.error || !response.data) {
        setProject(null);
        setStatus({
          type: "error",
          message: response.error?.message || "Projekt nicht gefunden oder keine Berechtigung."
        });
        setSchemaWarning(usesFallback);
        setIsLoading(false);
        return;
      }

      setProject(response.data);
      setForm(buildFormState(response.data, "submission"));
      setSchemaWarning(usesFallback);
      setStatus(null);
      setIsLoading(false);
    }

    loadProject();

    return () => {
      active = false;
    };
  }, [isAuthReady, projectId, projectSource, session]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateSection(sectionId, patch) {
    setForm((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section
      )
    }));
  }

  function addSection() {
    setForm((current) => ({
      ...current,
      sections: [...current.sections, createProjectSection()]
    }));
  }

  function removeSection(sectionId) {
    setForm((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== sectionId)
    }));
  }

  async function handleImageSelection(file, onApply) {
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

      onApply(dataUrl);
      setStatus(null);
    } catch (error) {
      setStatus({
        type: "error",
        message: error?.message || "Das Bild konnte nicht verarbeitet werden."
      });
    }
  }

  async function saveProject() {
    if (!browserSupabase || !projectId) {
      return;
    }

    if (!form.projectName.trim() || !form.description.trim()) {
      setStatus({
        type: "error",
        message: "Projektname und Kurzbeschreibung sind Pflichtfelder."
      });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    if (projectSource === "app") {
      const payload = {
        name: form.projectName.trim(),
        short_description: form.description.trim(),
        long_description: form.description.trim(),
        intro_text: form.introText.trim() || null,
        website_url: form.websiteUrl.trim() || null,
        card_image_url: form.cardImageUrl.trim() || null,
        external_button_label: form.externalButtonLabel.trim() || null,
        detail_sections: previewSections,
        platform_label: form.platformLabel.trim() || "App",
        type_label: form.typeLabel.trim() || "Projekt",
        platform: slugify(form.platformLabel) || form.platformValue || "app",
        type: slugify(form.typeLabel) || form.typeValue || "project"
      };

      const { error } = await browserSupabase.from("apps").update(payload).eq("id", projectId);

      if (error) {
        setStatus({
          type: "error",
          message: isEditorColumnMissingError(error)
            ? "Die neuen App-Editor-Felder fehlen noch in Supabase. Bitte zuerst `supabase/schema.sql` anwenden."
            : error.message
        });
        if (isEditorColumnMissingError(error)) {
          setSchemaWarning(true);
        }
        setIsSaving(false);
        return;
      }

      setProject((current) => ({ ...(current || {}), ...payload }));
      setForm((current) => ({
        ...current,
        sections: normalizeProjectSections(previewSections),
        platformValue: payload.platform,
        typeValue: payload.type
      }));
      setStatus({
        type: "success",
        message: "Das Projekt wurde gespeichert."
      });
      setIsSaving(false);
      return;
    }

    const payload = {
      project_name: form.projectName.trim(),
      website_url: form.websiteUrl.trim() || null,
      description: form.description.trim(),
      approved_intro_text: form.introText.trim() || null,
      card_image_url: form.cardImageUrl.trim() || null,
      external_button_label: form.externalButtonLabel.trim() || null,
      detail_sections: previewSections
    };

    const { error } = await browserSupabase
      .from("submission_requests")
      .update(payload)
      .eq("id", projectId);

    if (error) {
      setStatus({
        type: "error",
        message: isEditorColumnMissingError(error)
          ? "Die neuen Editor-Felder fehlen noch in Supabase. Bitte zuerst `supabase/schema.sql` anwenden."
          : error.message
      });
      setIsSaving(false);
      return;
    }

    setProject((current) => ({ ...(current || {}), ...payload }));
    setForm((current) => ({
      ...current,
      sections: normalizeProjectSections(previewSections)
    }));
    setStatus({
      type: "success",
      message: "Das Projekt wurde gespeichert."
    });
    setIsSaving(false);
  }

  if (!browserSupabase) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Projekt bearbeiten</h1>
          <p>Supabase ist im Browser noch nicht konfiguriert.</p>
        </article>
      </section>
    );
  }

  if (!isAuthReady || isLoading) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Projekt bearbeiten</h1>
          <p>Projekt wird geladen...</p>
        </article>
      </section>
    );
  }

  if (!session?.user) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Projekt bearbeiten</h1>
          <p>Bitte melde dich zuerst im Creator-Dashboard an.</p>
          <Link href="/creator/dashboard" className="button">
            Zum Dashboard
          </Link>
        </article>
      </section>
    );
  }

  if (!projectId) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Projekt bearbeiten</h1>
          <p>Es wurde keine Projekt-ID übergeben.</p>
          <Link href="/creator/dashboard" className="button button-secondary">
            Zurück zum Dashboard
          </Link>
        </article>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="dashboard-stack">
        <article className="card">
          <h1>Projekt bearbeiten</h1>
          <p>{status?.message || "Du darfst dieses Projekt nicht bearbeiten."}</p>
          <Link href="/creator/dashboard" className="button button-secondary">
            Zurück zum Dashboard
          </Link>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.editorStack}>
      <article className="card">
        <div className="section-header">
          <div>
            <p className="dashboard-eyebrow">Projekt-Editor</p>
            <h1 style={{ marginTop: 0, marginBottom: "0.35rem" }}>{form.projectName || "Projekt"}</h1>
            <p className={styles.muted}>
              Hier bearbeitest du Titelbild, Texte, Zusatzbilder und den Namen des externen Buttons.
            </p>
          </div>
          <div className={styles.metaGrid}>
            <span className="status-pill">{project.status || "Projekt"}</span>
            {project.deleted_at ? <span className="status-pill">Ausgeblendet</span> : null}
            {projectSource === "app" ? <span className="status-pill">Startseite</span> : null}
            {isAdmin ? <span className="status-pill">Admin</span> : null}
          </div>
        </div>
      </article>

      <div className={styles.editorShell}>
        <article className={`card ${styles.editorFormCard}`}>
          <div className="button-row" style={{ marginTop: 0 }}>
            <Link href="/creator/dashboard" className="button button-secondary">
              Zurück zum Dashboard
            </Link>
            {detailHref ? (
              <Link href={detailHref} className="button button-secondary">
                Projektseite ansehen
              </Link>
            ) : null}
          </div>

          {schemaWarning ? (
            <div className={styles.warning}>
              <strong>Hinweis zur Datenbank</strong>
              <p>
                Die neuen Editor-Felder wurden in Supabase noch nicht gefunden. Bitte wende zuerst
                die SQL-Änderungen aus `supabase/schema.sql` an, damit Abschnittsbilder und der
                Button-Name gespeichert werden können.
              </p>
            </div>
          ) : null}

          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Projektname</span>
            <input
              className="input"
              name="projectName"
              value={form.projectName}
              onChange={updateField}
              placeholder="Projektname"
            />
          </label>

          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Kurzbeschreibung</span>
            <textarea
              className="textarea"
              name="description"
              value={form.description}
              onChange={updateField}
              placeholder="Kurzer Text für Karte und Detailseite"
            />
          </label>

          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Intro-Text für die Mehr-Infos-Blende</span>
            <textarea
              className="textarea"
              name="introText"
              value={form.introText}
              onChange={updateField}
              placeholder="Optionaler Text für die Blende"
            />
          </label>

          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Website oder Kanal</span>
            <input
              className="input"
              name="websiteUrl"
              value={form.websiteUrl}
              onChange={updateField}
              placeholder="https://..."
            />
          </label>

          {projectSource === "app" ? (
            <>
              <label className="field" style={{ marginTop: 0 }}>
                <span className="field-label">Plattform-Label</span>
                <input
                  className="input"
                  name="platformLabel"
                  value={form.platformLabel}
                  onChange={updateField}
                  placeholder="Discord, App, YouTube ..."
                />
              </label>

              <label className="field" style={{ marginTop: 0 }}>
                <span className="field-label">Typ-Label</span>
                <input
                  className="input"
                  name="typeLabel"
                  value={form.typeLabel}
                  onChange={updateField}
                  placeholder="Discord-Bot, Fan-App ..."
                />
              </label>
            </>
          ) : null}

          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Button-Name für den externen Link</span>
            <input
              className="input"
              name="externalButtonLabel"
              value={form.externalButtonLabel}
              onChange={updateField}
              placeholder={DEFAULT_EXTERNAL_BUTTON_LABEL}
            />
          </label>
          <p className={styles.muted}>
            Lässt du das Feld leer, bleibt standardmäßig "{DEFAULT_EXTERNAL_BUTTON_LABEL}" stehen.
          </p>

          <label className="field" style={{ marginTop: 0 }}>
            <span className="field-label">Titelbild-URL</span>
            <input
              className="input"
              name="cardImageUrl"
              value={form.cardImageUrl}
              onChange={updateField}
              placeholder="https://... oder Bild hochladen"
            />
          </label>

          <div className={styles.uploadRow}>
            <label className="button button-secondary upload-button">
              Titelbild hochladen
              <input
                className={styles.hiddenInput}
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  await handleImageSelection(file, (nextImage) =>
                    setForm((current) => ({ ...current, cardImageUrl: nextImage }))
                  );
                  event.target.value = "";
                }}
              />
            </label>
            {form.cardImageUrl ? (
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setForm((current) => ({ ...current, cardImageUrl: "" }))}
              >
                Titelbild entfernen
              </button>
            ) : null}
          </div>

          <div className="section-header">
            <div>
              <h2 style={{ marginBottom: "0.35rem" }}>Inhaltsabschnitte</h2>
              <p className={styles.muted}>
                Jeder Abschnitt kann Text und optional ein kleines Bild rechts enthalten.
              </p>
            </div>
            <button type="button" className="button" onClick={addSection}>
              Abschnitt hinzufügen
            </button>
          </div>

          {form.sections.length ? (
            <div className={styles.sectionList}>
              {form.sections.map((section, index) => (
                <div key={section.id} className={styles.sectionEditor}>
                  <div className={styles.sectionHeader}>
                    <h3>Abschnitt {index + 1}</h3>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => removeSection(section.id)}
                    >
                      Abschnitt löschen
                    </button>
                  </div>

                  <label className="field" style={{ marginTop: 0 }}>
                    <span className="field-label">Überschrift</span>
                    <input
                      className="input"
                      value={section.heading}
                      onChange={(event) =>
                        updateSection(section.id, { heading: event.target.value })
                      }
                      placeholder="Abschnittstitel"
                    />
                  </label>

                  <label className="field" style={{ marginTop: 0 }}>
                    <span className="field-label">Text</span>
                    <textarea
                      className="textarea"
                      value={section.text}
                      onChange={(event) =>
                        updateSection(section.id, { text: event.target.value })
                      }
                      placeholder="Hier kann Text hinzugefügt, ersetzt oder gelöscht werden."
                    />
                  </label>

                  <label className="field" style={{ marginTop: 0 }}>
                    <span className="field-label">Bild-URL</span>
                    <input
                      className="input"
                      value={section.imageUrl}
                      onChange={(event) =>
                        updateSection(section.id, { imageUrl: event.target.value })
                      }
                      placeholder="https://... oder Bild hochladen"
                    />
                  </label>

                  <label className="field" style={{ marginTop: 0 }}>
                    <span className="field-label">Bildbeschreibung</span>
                    <input
                      className="input"
                      value={section.imageAlt}
                      onChange={(event) =>
                        updateSection(section.id, { imageAlt: event.target.value })
                      }
                      placeholder="Kurze Bildbeschreibung"
                    />
                  </label>

                  <div className={styles.uploadRow}>
                    <label className="button button-secondary">
                      Abschnittsbild hochladen
                      <input
                        className={styles.hiddenInput}
                        type="file"
                        accept="image/*"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          await handleImageSelection(file, (nextImage) =>
                            updateSection(section.id, { imageUrl: nextImage })
                          );
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {section.imageUrl ? (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => updateSection(section.id, { imageUrl: "", imageAlt: "" })}
                      >
                        Bild entfernen
                      </button>
                    ) : null}
                  </div>

                  {section.imageUrl ? (
                    <img
                      src={withBasePath(section.imageUrl)}
                      alt={section.imageAlt || `${form.projectName || "Projekt"} Bild`}
                      className={styles.sectionPreviewImage}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptySections}>
              <strong>Noch keine Abschnitte</strong>
              <p>
                Füge Abschnitte hinzu, damit rechts neben dem Text kleine Bilder erscheinen und
                sich per Klick groß öffnen lassen.
              </p>
            </div>
          )}

          <div className="button-row">
            <button type="button" className="button button-edit" disabled={isSaving} onClick={saveProject}>
              {isSaving ? "Speichert..." : "Änderungen speichern"}
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
        </article>

        <aside className={styles.editorPreviewCard}>
          <div>
            <p className="dashboard-eyebrow">Live-Vorschau</p>
            <h2 style={{ marginTop: 0, marginBottom: "0.35rem" }}>
              {form.projectName.trim() || "Projektname"}
            </h2>
            <p className={styles.muted}>
              So wirkt die öffentliche Detailseite nach dem Speichern.
            </p>
          </div>

          <div className={styles.previewImageWrap}>
            <img
              src={previewImage}
              alt={form.projectName.trim() || "Projektvorschau"}
              className={styles.previewImage}
            />
          </div>

          <div className="detail-chip-row" style={{ marginTop: 0 }}>
            <span className="detail-chip">{form.platformLabel || "Community"}</span>
            <span className="detail-chip">{form.typeLabel || "Freigegeben"}</span>
          </div>

          <p className="detail-text">{form.description.trim() || "Kurzbeschreibung des Projekts."}</p>

          {form.websiteUrl.trim() ? (
            <span className="button detail-inline-btn">{externalButtonLabel}</span>
          ) : null}

          <ProjectContentSections
            title={form.projectName.trim() || "Projekt"}
            sections={previewSections}
          />
        </aside>
      </div>
    </section>
  );
}
