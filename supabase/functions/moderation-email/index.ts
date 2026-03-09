import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";

type SubmissionPayload = {
  creator_name?: string | null;
  email?: string | null;
  project_name?: string | null;
  website_url?: string | null;
  public_slug?: string | null;
};

type NotificationPayload = {
  nextStatus?: "approved" | "rejected";
  submission?: SubmissionPayload;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPublicProjectLink(publicSiteUrl: string | null, publicSlug: string | null) {
  if (!publicSiteUrl || !publicSlug) {
    return null;
  }

  const base = publicSiteUrl.replace(/\/+$/, "");
  return `${base}/projekte/${publicSlug}/`;
}

function buildMailCopy({
  nextStatus,
  submission,
  publicSiteUrl
}: {
  nextStatus: "approved" | "rejected";
  submission: SubmissionPayload;
  publicSiteUrl: string | null;
}) {
  const projectName = submission.project_name || "dein Projekt";
  const creatorName = submission.creator_name || "Hallo";
  const projectLink = buildPublicProjectLink(publicSiteUrl, submission.public_slug || null);

  if (nextStatus === "approved") {
    const text = [
      `Hallo ${creatorName},`,
      "",
      `dein Projekt "${projectName}" wurde freigegeben.`,
      projectLink ? `Öffentlicher Link: ${projectLink}` : "Dein Projekt ist jetzt öffentlich sichtbar.",
      submission.website_url ? `Originalseite: ${submission.website_url}` : "",
      "",
      "Viele Grüße"
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
      <p>Hallo ${escapeHtml(creatorName)},</p>
      <p>dein Projekt <strong>${escapeHtml(projectName)}</strong> wurde freigegeben.</p>
      ${
        projectLink
          ? `<p><a href="${escapeHtml(projectLink)}">Öffentlichen Projektlink öffnen</a></p>`
          : "<p>Dein Projekt ist jetzt öffentlich sichtbar.</p>"
      }
      ${
        submission.website_url
          ? `<p>Originalseite: <a href="${escapeHtml(submission.website_url)}">${escapeHtml(submission.website_url)}</a></p>`
          : ""
      }
      <p>Viele Grüße</p>
    `;

    return {
      subject: `Dein Projekt wurde freigegeben: ${projectName}`,
      text,
      html
    };
  }

  const text = [
    `Hallo ${creatorName},`,
    "",
    `dein Projekt "${projectName}" wurde aktuell nicht freigegeben.`,
    "Du kannst es später überarbeitet erneut einreichen.",
    "",
    "Viele Grüße"
  ].join("\n");

  const html = `
    <p>Hallo ${escapeHtml(creatorName)},</p>
    <p>dein Projekt <strong>${escapeHtml(projectName)}</strong> wurde aktuell nicht freigegeben.</p>
    <p>Du kannst es später überarbeitet erneut einreichen.</p>
    <p>Viele Grüße</p>
  `;

  return {
    subject: `Update zu deiner Einreichung: ${projectName}`,
    text,
    html
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ sent: false, reason: "missing_supabase_config" }, 500);
  }

  const authHeader = request.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const {
    data: { user },
    error: userError
  } = await authClient.auth.getUser();

  if (userError || !user?.email) {
    return json({ sent: false, reason: "not_authenticated" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });

  const { data: adminRow, error: adminError } = await adminClient
    .from("admin_users")
    .select("email")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (adminError || !adminRow) {
    return json({ sent: false, reason: "not_authorized" }, 403);
  }

  const body = (await request.json()) as NotificationPayload;
  const nextStatus = body.nextStatus;
  const submission = body.submission;

  if (!nextStatus || !submission?.email || !submission?.project_name) {
    return json({ sent: false, reason: "invalid_payload" }, 400);
  }

  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = Deno.env.get("SMTP_PORT");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPass = Deno.env.get("SMTP_PASS");
  const smtpFrom = Deno.env.get("SMTP_FROM");
  const publicSiteUrl = Deno.env.get("PUBLIC_SITE_URL");

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom) {
    return json({ sent: false, reason: "missing_smtp_config" });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const mailCopy = buildMailCopy({
    nextStatus,
    submission,
    publicSiteUrl: publicSiteUrl || null
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: submission.email,
    subject: mailCopy.subject,
    text: mailCopy.text,
    html: mailCopy.html
  });

  return json({ sent: true });
});
