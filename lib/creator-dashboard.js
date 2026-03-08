import { browserSupabase } from "./supabase-browser";
import { buildSubmissionSlug } from "./project-utils";

export const metricDefinitions = {
  submissions: {
    label: "Einreichungen",
    description: "Zählt deine eingereichten Projekte.",
    buttonLabel: "Detailansicht"
  },
  aufrufe: {
    label: "Aufrufe",
    description: "Zeigt, wie oft deine Projektkarten oder Details geöffnet wurden.",
    buttonLabel: "Detailansicht"
  },
  klicks: {
    label: "Klicks",
    description: "Addiert Klicks auf Mehr Infos und auf externe Projektlinks.",
    buttonLabel: "Detailansicht"
  },
  freigaben: {
    label: "Freigaben",
    description: "Zeigt, welche deiner Projekte bereits freigeschaltet sind.",
    buttonLabel: "Detailansicht"
  },
  originalseite: {
    label: "Originalseite",
    description: "Trackt Klicks auf Website, Kanal oder Originalseite.",
    buttonLabel: "Detailansicht"
  },
  mehrInfos: {
    label: "Mehr Infos",
    description: "Trackt Klicks auf Intro und Detailansicht deiner Projekte.",
    buttonLabel: "Detailansicht"
  },
  anmeldungen: {
    label: "Anmeldungen",
    description: "Zählt, wie oft der Dashboard-Zugang per Magic Link angefragt wurde.",
    buttonLabel: "Detailansicht"
  }
};

export const primaryMetricKeys = ["submissions", "aufrufe", "klicks", "freigaben"];
export const secondaryMetricKeys = ["originalseite", "mehrInfos", "anmeldungen"];

const trackedEventTypes = ["detail_view", "intro_open", "external_click", "magic_link_request"];

function getProjectIdentifierSet(submissions) {
  return new Set(submissions.map((submission) => buildSubmissionSlug(submission)));
}

function getProjectTitleSet(submissions) {
  return new Set(submissions.map((submission) => submission.project_name));
}

function getTrackedProjectEvents(allEvents, submissions) {
  const identifiers = getProjectIdentifierSet(submissions);
  const titles = getProjectTitleSet(submissions);

  return allEvents.filter(
    (event) => identifiers.has(event.item_id) || titles.has(event.item_title)
  );
}

function getMetricEventTypes(metricKey) {
  const mapping = {
    aufrufe: ["detail_view", "intro_open"],
    klicks: ["intro_open", "external_click"],
    originalseite: ["external_click"],
    mehrInfos: ["intro_open"],
    anmeldungen: ["magic_link_request"]
  };

  return mapping[metricKey] || [];
}

function groupRowsByLabel(rows, pickLabel) {
  const grouped = new Map();

  rows.forEach((row) => {
    const label = pickLabel(row);
    const current = grouped.get(label) || { label, count: 0, latest: null };

    current.count += 1;

    const rowDate = row.created_at ? new Date(row.created_at).getTime() : 0;
    const latestDate = current.latest?.created_at ? new Date(current.latest.created_at).getTime() : 0;

    if (!current.latest || rowDate > latestDate) {
      current.latest = row;
    }

    grouped.set(label, current);
  });

  return Array.from(grouped.values()).sort((left, right) => right.count - left.count);
}

export async function fetchCreatorDashboardData(sessionEmail, includeAdminQueue) {
  if (!browserSupabase || !sessionEmail) {
    return null;
  }

  const [{ data: submissions = [] }, { data: interactionEvents = [] }] = await Promise.all([
    browserSupabase
      .from("submission_requests")
      .select(
        "id, project_name, creator_name, email, status, created_at, approved_at, public_slug, website_url"
      )
      .eq("email", sessionEmail)
      .order("created_at", { ascending: false }),
    browserSupabase
      .from("interaction_events")
      .select("item_title, item_id, event_type, route_path, created_at")
      .in("event_type", trackedEventTypes)
      .order("created_at", { ascending: false })
      .limit(1000)
  ]);

  const ownApprovedSubmissions = submissions.filter((submission) => submission.status === "approved");
  const ownProjectEvents = getTrackedProjectEvents(interactionEvents, ownApprovedSubmissions);
  const ownMagicLinkEvents = interactionEvents.filter(
    (event) => event.event_type === "magic_link_request" && event.route_path === "/creator/dashboard"
  );

  const ownIntroOpens = ownProjectEvents.filter((event) => event.event_type === "intro_open").length;
  const ownExternalClicks = ownProjectEvents.filter(
    (event) => event.event_type === "external_click"
  ).length;
  const ownDetailViews = ownProjectEvents.filter((event) => event.event_type === "detail_view").length;

  const queue = includeAdminQueue
    ? (
        await browserSupabase
          .from("submission_requests")
          .select(
            "id, creator_name, email, project_name, website_url, description, card_image_url, created_at, status"
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      ).data || []
    : [];

  return {
    stats: {
      submissions: submissions.length,
      freigaben: ownApprovedSubmissions.length,
      klicks: ownIntroOpens + ownExternalClicks,
      aufrufe: ownIntroOpens + ownDetailViews,
      originalseite: ownExternalClicks,
      mehrInfos: ownIntroOpens,
      anmeldungen: ownMagicLinkEvents.length
    },
    submissions,
    ownApprovedSubmissions,
    ownProjectEvents,
    ownMagicLinkEvents,
    queue
  };
}

export function buildMetricCards(stats) {
  return [...primaryMetricKeys, ...secondaryMetricKeys].map((key) => ({
    key,
    value: stats[key] || 0,
    ...metricDefinitions[key]
  }));
}

export function buildMetricDetail(metricKey, dashboardData) {
  const { submissions, ownApprovedSubmissions, ownProjectEvents, ownMagicLinkEvents } = dashboardData;

  if (metricKey === "submissions") {
    return {
      title: "Einreichungen",
      description: metricDefinitions.submissions.description,
      total: submissions.length,
      items: submissions.map((submission) => ({
        title: submission.project_name,
        summary: `Status: ${submission.status}`,
        meta: `${submission.email} | ${new Intl.DateTimeFormat("de-AT", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(submission.created_at))}`
      }))
    };
  }

  if (metricKey === "freigaben") {
    return {
      title: "Freigaben",
      description: metricDefinitions.freigaben.description,
      total: ownApprovedSubmissions.length,
      items: ownApprovedSubmissions.map((submission) => ({
        title: submission.project_name,
        summary: `Slug: ${submission.public_slug || buildSubmissionSlug(submission)}`,
        meta: submission.approved_at
          ? new Intl.DateTimeFormat("de-AT", {
              dateStyle: "medium",
              timeStyle: "short"
            }).format(new Date(submission.approved_at))
          : "Noch nicht freigegeben"
      }))
    };
  }

  if (metricKey === "anmeldungen") {
    return {
      title: metricDefinitions.anmeldungen.label,
      description: metricDefinitions.anmeldungen.description,
      total: ownMagicLinkEvents.length,
      items: ownMagicLinkEvents.map((event, index) => ({
        title: `Anfrage ${index + 1}`,
        summary: "Magic Link für den Creator-Bereich angefordert",
        meta: new Intl.DateTimeFormat("de-AT", {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(new Date(event.created_at))
      }))
    };
  }

  const eventTypes = getMetricEventTypes(metricKey);
  const filteredEvents = ownProjectEvents.filter((event) => eventTypes.includes(event.event_type));
  const groupedEvents = groupRowsByLabel(
    filteredEvents,
    (event) => event.item_title || event.item_id || "Unbekannt"
  );

  return {
    title: metricDefinitions[metricKey].label,
    description: metricDefinitions[metricKey].description,
    total: filteredEvents.length,
    items: groupedEvents.map((entry) => ({
      title: entry.label,
      summary: `${entry.count} Ereignisse`,
      meta: `${entry.latest.event_type} | ${new Intl.DateTimeFormat("de-AT", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(entry.latest.created_at))}`
    }))
  };
}
