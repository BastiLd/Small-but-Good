"use client";

import { useState } from "react";
import { browserSupabase } from "../lib/supabase-browser";

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

export default function SubmitProjectForm() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validateForm() {
    if (!form.creatorName.trim() || !form.email.trim() || !form.projectName.trim() || !form.description.trim()) {
      setStatus({
        type: "error",
        message: "Bitte f\u00FClle Name, E-Mail, Projektname und Beschreibung aus."
      });
      return false;
    }

    return true;
  }

  function openEmail() {
    if (!validateForm()) return;

    const subject = encodeURIComponent(`Projektvorschlag: ${form.projectName.trim()}`);
    const body = encodeURIComponent(buildMailtoBody(form));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setStatus({
      type: "success",
      message: "Dein E-Mail-Programm wurde mit den eingetragenen Daten ge\u00F6ffnet."
    });
  }

  async function saveToSupabase() {
    if (!validateForm()) return;

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
      const { error } = await browserSupabase.from("submission_requests").insert([
        {
          creator_name: form.creatorName.trim(),
          email: form.email.trim().toLowerCase(),
          project_name: form.projectName.trim(),
          website_url: form.website.trim() || null,
          card_image_url: form.imageUrl.trim() || null,
          description: form.description.trim(),
          source: "website"
        }
      ]);

      if (error) {
        throw error;
      }

      setForm(initialForm);
      setStatus({
        type: "success",
        message: "Dein Projekt wurde in Supabase gespeichert und wartet jetzt auf Freigabe."
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

  return (
    <form onSubmit={(event) => event.preventDefault()}>
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
        <button type="button" className="button button-secondary" onClick={openEmail}>
          E-Mail &ouml;ffnen
        </button>
        <button type="button" className="button" onClick={saveToSupabase} disabled={isSaving}>
          {isSaving ? "Wird gespeichert..." : "Mit Supabase senden"}
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
  );
}
