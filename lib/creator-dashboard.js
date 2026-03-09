import { browserSupabase } from "./supabase-browser";
import { APPS } from "./apps";
import { buildSubmissionSlug } from "./project-utils";

export const metricDefinitions = {
  submissions: {
    label: "Einreichungen",
    description: "Zählt deine eingereichten Projekte.",
    buttonLabel: "Detailansicht"
  },
  aufrufe: {
    label: "Aufrufe",
    description: "Zeigt, wie oft deine Projekte geöffnet oder genauer angesehen wurden.",
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
export const creatorMetricKeys = ["aufrufe", "klicks", "originalseite", "mehrInfos"];

const trackedEventTypes = ["detail_view", "intro_open", "external_click", "magic_link_request"];

function formatDateTime(value) {
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

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

function getOwnedLocalApps(sessionEmail) {
  return APPS.filter(
    (app) => app?.creatorEmail && app.creatorEmail.toLowerCase() === sessionEmail.toLowerCase()
  );
}

function getTrackedLocalEvents(allEvents, localApps) {
  const identifiers = new Set(
    localApps.flatMap((app) => [app.runtimeId, app.id].filter(Boolean))
  );
  const titles = new Set(localApps.map((app) => app.title).filter(Boolean));

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
    const label = pickLabel(row) || "Unbekannt";
    const current = grouped.get(label) || { label, count: 0, latest: null, rows: [] };
    const rowDate = row.created_at ? new Date(row.created_at).getTime() : 0;
    const latestDate = current.latest?.created_at ? new Date(current.latest.created_at).getTime() : 0;

    current.count += 1;
    current.rows.push(row);

    if (!current.latest || rowDate > latestDate) {
      current.latest = row;
    }

    grouped.set(label, current);
  });

  return Array.from(grouped.values()).sort((left, right) => right.count - left.count);
}

function uniqueEvents(rows) {
  return rows.filter(
    (event, index, items) =>
      index ===
      items.findIndex(
        (candidate) =>
          candidate.created_at === event.created_at &&
          candidate.event_type === event.event_type &&
          candidate.item_id === event.item_id &&
          candidate.item_title === event.item_title
      )
  );
}

function buildActorSummary(rows) {
  const groupedActors = groupRowsByLabel(rows, (row) => row.actor_email || "Gast");
  const guestEntry = groupedActors.find((entry) => entry.label === "Gast");
  const knownActors = groupedActors.filter((entry) => entry.label !== "Gast");

  const actorParts = [];

  if (knownActors.length) {
    const visibleActors = knownActors.slice(0, 3).map(
      (entry) => `${entry.label} (${entry.count})`
    );
    const remainingActors = knownActors.length - visibleActors.length;
    actorParts.push(`Angemeldet: ${visibleActors.join(", ")}${remainingActors > 0 ? `, +${remainingActors} weitere` : ""}`);
  }

  if (guestEntry) {
    actorParts.push(`Gäste: ${guestEntry.count}`);
  }

  return actorParts.join(" | ") || "Noch keine Nutzerzuordnung vorhanden";
}

function countByEventType(rows, eventType) {
  return rows.filter((row) => row.event_type === eventType).length;
}

function buildProjectEventItems(metricKey, rows) {
  const groupedEvents = groupRowsByLabel(
    rows,
    (event) => event.item_title || event.item_id || "Unbekanntes Projekt"
  );

  return groupedEvents.map((entry) => {
    const actorSummary = buildActorSummary(entry.rows);
    const lastEntry = `Zuletzt: ${formatDateTime(entry.latest.created_at)}`;

    if (metricKey === "aufrufe") {
      const introCount = countByEventType(entry.rows, "intro_open");
      const detailCount = countByEventType(entry.rows, "detail_view");

      return {
        title: entry.label,
        summary: `${entry.count} Aufrufe insgesamt`,
        meta: `Mehr Infos: ${introCount} | Detailseite: ${detailCount} | ${actorSummary} | ${lastEntry}`
      };
    }

    if (metricKey === "klicks") {
      const infoClicks = countByEventType(entry.rows, "intro_open");
      const externalClicks = countByEventType(entry.rows, "external_click");

      return {
        title: entry.label,
        summary: `${entry.count} Klicks insgesamt`,
        meta: `Mehr Infos: ${infoClicks} | Originalseite: ${externalClicks} | ${actorSummary} | ${lastEntry}`
      };
    }

    if (metricKey === "originalseite") {
      return {
        title: entry.label,
        summary: `${entry.count} Klicks auf die Originalseite`,
        meta: `${actorSummary} | ${lastEntry}`
      };
    }

    return {
      title: entry.label,
      summary: `${entry.count} Klicks auf Mehr Infos`,
      meta: `${actorSummary} | ${lastEntry}`
    };
  });
}

async function fetchInteractionEvents() {
  const runQuery = async (selectClause) => {
    const { data, error } = await browserSupabase
      .from("interaction_events")
      .select(selectClause)
      .in("event_type", trackedEventTypes)
      .order("created_at", { ascending: false })
      .limit(1000);

    return { data: data || [], error };
  };

  let response = await runQuery(
    "item_title, item_id, event_type, route_path, created_at, actor_email"
  );

  if (response.error && /actor_email/i.test(response.error.message || "")) {
    response = await runQuery("item_title, item_id, event_type, route_path, created_at");
  }

  return (response.data || []).map((row) => ({
    ...row,
    actor_email: row.actor_email || null
  }));
}

export async function fetchCreatorDashboardData(sessionEmail, includeAdminQueue) {
  if (!browserSupabase || !sessionEmail) {
    return null;
  }

  const [{ data: submissions = [] }, interactionEvents] = await Promise.all([
    browserSupabase
      .from("submission_requests")
      .select(
        "id, project_name, creator_name, email, status, created_at, approved_at, public_slug, website_url"
      )
      .eq("email", sessionEmail)
      .order("created_at", { ascending: false }),
    fetchInteractionEvents()
  ]);

  const ownApprovedSubmissions = submissions.filter((submission) => submission.status === "approved");
  const ownedLocalApps = getOwnedLocalApps(sessionEmail);
  const submissionEvents = getTrackedProjectEvents(interactionEvents, ownApprovedSubmissions);
  const localProjectEvents = getTrackedLocalEvents(interactionEvents, ownedLocalApps);
  const ownProjectEvents = uniqueEvents([...submissionEvents, ...localProjectEvents]);
  const ownMagicLinkEvents = interactionEvents.filter(
    (event) =>
      event.event_type === "magic_link_request" &&
      event.route_path === "/creator/dashboard" &&
      (!event.actor_email || event.actor_email === sessionEmail.toLowerCase())
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
      freigaben: ownApprovedSubmissions.length + ownedLocalApps.length,
      klicks: ownIntroOpens + ownExternalClicks,
      aufrufe: ownIntroOpens + ownDetailViews,
      originalseite: ownExternalClicks,
      mehrInfos: ownIntroOpens,
      anmeldungen: ownMagicLinkEvents.length
    },
    submissions,
    ownApprovedSubmissions,
    ownedLocalApps,
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
  const {
    submissions,
    ownApprovedSubmissions,
    ownedLocalApps = [],
    ownProjectEvents,
    ownMagicLinkEvents
  } = dashboardData;

  if (metricKey === "submissions") {
    return {
      title: "Einreichungen",
      description: metricDefinitions.submissions.description,
      total: submissions.length,
      items: submissions.map((submission) => ({
        title: submission.project_name,
        summary: `Status: ${submission.status}`,
        meta: `${submission.email} | ${formatDateTime(submission.created_at)}`
      }))
    };
  }

  if (metricKey === "freigaben") {
    const liveProjects = [
      ...ownApprovedSubmissions.map((submission) => ({
        title: submission.project_name,
        summary: `Slug: ${submission.public_slug || buildSubmissionSlug(submission)}`,
        meta: submission.approved_at
          ? formatDateTime(submission.approved_at)
          : "Noch nicht freigegeben"
      })),
      ...ownedLocalApps.map((app) => ({
        title: app.title,
        summary: "Lokales Projekt auf der Startseite",
        meta: app.detailPath || "Ohne Detailseite"
      }))
    ];

    return {
      title: "Freigaben",
      description: metricDefinitions.freigaben.description,
      total: liveProjects.length,
      items: liveProjects
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
        meta: formatDateTime(event.created_at)
      }))
    };
  }

  const eventTypes = getMetricEventTypes(metricKey);
  const filteredEvents = ownProjectEvents.filter((event) => eventTypes.includes(event.event_type));

  return {
    title: metricDefinitions[metricKey].label,
    description: metricDefinitions[metricKey].description,
    total: filteredEvents.length,
    items: buildProjectEventItems(metricKey, filteredEvents)
  };
}
