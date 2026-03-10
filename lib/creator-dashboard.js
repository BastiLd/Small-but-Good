import { APPS } from "./apps";
import { buildSubmissionSlug } from "./project-utils";
import { annotateDuplicateSubmissions } from "./submission-duplicates";
import { browserSupabase } from "./supabase-browser";

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
    description: "Trackt Klicks auf Mehr Infos und Intro-Flächen deiner Projekte.",
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
export const interactionMetricKeys = ["aufrufe", "klicks", "originalseite", "mehrInfos"];
export const dashboardRangeOptions = [
  { key: "all", label: "Alle Zeit" },
  { key: "today", label: "Heute" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" }
];

const trackedEventTypes = ["detail_view", "intro_open", "external_click", "magic_link_request"];

function formatDateTime(value) {
  return new Intl.DateTimeFormat("de-AT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeEmail(value) {
  return (value || "").trim().toLowerCase();
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
  const normalizedEmail = normalizeEmail(sessionEmail);

  return APPS.filter(
    (app) => app?.creatorEmail && normalizeEmail(app.creatorEmail) === normalizedEmail
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

  return Array.from(grouped.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    const rightLatest = right.latest?.created_at ? new Date(right.latest.created_at).getTime() : 0;
    const leftLatest = left.latest?.created_at ? new Date(left.latest.created_at).getTime() : 0;
    return rightLatest - leftLatest;
  });
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
    const visibleActors = knownActors
      .slice(0, 3)
      .map((entry) => `${entry.label} (${entry.count})`);
    const remainingActors = knownActors.length - visibleActors.length;
    actorParts.push(
      `Angemeldet: ${visibleActors.join(", ")}${
        remainingActors > 0 ? `, +${remainingActors} weitere` : ""
      }`
    );
  }

  if (guestEntry) {
    actorParts.push(`Gäste: ${guestEntry.count}`);
  }

  return actorParts.join(" | ") || "Noch keine Nutzerzuordnung vorhanden";
}

function countByEventType(rows, eventType) {
  return rows.filter((row) => row.event_type === eventType).length;
}

function buildBreakdown(metricKey, rows) {
  if (metricKey === "aufrufe") {
    return [
      { label: "Mehr Infos", value: countByEventType(rows, "intro_open") },
      { label: "Detailseite", value: countByEventType(rows, "detail_view") }
    ];
  }

  if (metricKey === "klicks") {
    return [
      { label: "Mehr Infos", value: countByEventType(rows, "intro_open") },
      { label: "Originalseite", value: countByEventType(rows, "external_click") }
    ];
  }

  if (metricKey === "originalseite") {
    return [{ label: "Originalseite", value: countByEventType(rows, "external_click") }];
  }

  if (metricKey === "mehrInfos") {
    return [{ label: "Mehr Infos", value: countByEventType(rows, "intro_open") }];
  }

  return [];
}

function buildProjectEventItems(metricKey, rows) {
  const groupedEvents = groupRowsByLabel(
    rows,
    (event) => event.item_title || event.item_id || "Unbekanntes Projekt"
  );

  return groupedEvents.map((entry) => ({
    title: entry.label,
    summary:
      metricKey === "originalseite"
        ? `${entry.count} Klicks auf die Originalseite`
        : metricKey === "mehrInfos"
          ? `${entry.count} Öffnungen über Mehr Infos`
          : `${entry.count} Ereignisse im Zeitraum`,
    meta: `${buildActorSummary(entry.rows)} | Zuletzt: ${formatDateTime(entry.latest.created_at)}`,
    breakdown: buildBreakdown(metricKey, entry.rows)
  }));
}

function buildPublishedProjectEntries(ownApprovedSubmissions, ownedLocalApps, filteredProjectEvents) {
  const publishedEntries = [
    ...ownApprovedSubmissions.map((submission) => {
      const runtimeId = buildSubmissionSlug(submission);
      const matchingEvents = filteredProjectEvents.filter(
        (event) => event.item_id === runtimeId || event.item_title === submission.project_name
      );

      return {
        id: `submission-${submission.id}`,
        title: submission.project_name,
        href: `/projekte/${runtimeId}`,
        editorHref: `/creator/dashboard/editor?id=${submission.id}`,
        meta: submission.website_url || "Community-Projekt",
        statusLabel: "Freigegeben",
        activityCount: matchingEvents.length,
        latestActivity: matchingEvents[0]?.created_at || submission.approved_at || submission.created_at
      };
    }),
    ...ownedLocalApps.map((app) => {
      const matchingEvents = filteredProjectEvents.filter(
        (event) =>
          event.item_id === app.runtimeId ||
          event.item_id === app.id ||
          event.item_title === app.title
      );

      return {
        id: `local-${app.id}`,
        title: app.title,
        href: app.detailPath || "/",
        editorHref: null,
        meta: app.store_url || "Startseiten-Projekt",
        statusLabel: "Startseite",
        activityCount: matchingEvents.length,
        latestActivity: matchingEvents[0]?.created_at || null
      };
    })
  ];

  return publishedEntries
    .sort((left, right) => {
      if (right.activityCount !== left.activityCount) {
        return right.activityCount - left.activityCount;
      }

      const rightDate = right.latestActivity ? new Date(right.latestActivity).getTime() : 0;
      const leftDate = left.latestActivity ? new Date(left.latestActivity).getTime() : 0;
      return rightDate - leftDate;
    });
}

function getRangeStart(rangeKey) {
  const now = new Date();

  if (rangeKey === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (rangeKey === "7d") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return start;
  }

  if (rangeKey === "30d") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
    return start;
  }

  return null;
}

export function resolveDashboardRange(rawRangeKey) {
  const fallback = dashboardRangeOptions[0];
  const activeRange = dashboardRangeOptions.find((range) => range.key === rawRangeKey) || fallback;

  return {
    ...activeRange,
    startsAt: getRangeStart(activeRange.key)
  };
}

function filterRowsByRange(rows, range) {
  if (!range?.startsAt) {
    return rows;
  }

  const startTime = range.startsAt.getTime();
  return rows.filter((row) => {
    if (!row?.created_at) {
      return false;
    }

    return new Date(row.created_at).getTime() >= startTime;
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

async function fetchOwnSubmissions(sessionEmail) {
  const normalizedEmail = normalizeEmail(sessionEmail);
  const baseSelect = [
    "id",
    "project_name",
    "creator_name",
    "email",
    "status",
    "created_at",
    "approved_at",
    "public_slug",
    "website_url",
    "creator_id",
    "deleted_at",
    "restore_until",
    "approved_intro_text"
  ].join(", ");
  const extendedSelect = `${baseSelect}, account_email`;

  const byEmailResponse = await browserSupabase
    .from("submission_requests")
    .select(baseSelect)
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false });

  const byAccountResponse = await browserSupabase
    .from("submission_requests")
    .select(extendedSelect)
    .eq("account_email", normalizedEmail)
    .order("created_at", { ascending: false });

  const ownRows = byEmailResponse.data || [];

  if (byAccountResponse.error && /account_email/i.test(byAccountResponse.error.message || "")) {
    return ownRows;
  }

  const merged = new Map();

  [...ownRows, ...(byAccountResponse.data || [])].forEach((row) => {
    merged.set(row.id, row);
  });

  return Array.from(merged.values()).sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
}

async function fetchAdminQueue() {
  const queueSelect = [
    "id",
    "creator_name",
    "email",
    "project_name",
    "website_url",
    "description",
    "card_image_url",
    "created_at",
    "status"
  ].join(", ");

  const duplicateSelect = "id, project_name, website_url, status, creator_name, created_at";

  const [pendingResponse, duplicateSourceResponse] = await Promise.all([
    browserSupabase
      .from("submission_requests")
      .select(queueSelect)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    browserSupabase
      .from("submission_requests")
      .select(duplicateSelect)
      .order("created_at", { ascending: false })
      .limit(1000)
  ]);

  return annotateDuplicateSubmissions(
    pendingResponse.data || [],
    duplicateSourceResponse.data || pendingResponse.data || []
  );
}

async function fetchAdminProjectManagement() {
  const selectClause = [
    "id",
    "project_name",
    "creator_name",
    "description",
    "approved_intro_text",
    "website_url",
    "card_image_url",
    "approved_at",
    "public_slug",
    "deleted_at",
    "restore_until"
  ].join(", ");

  const { data, error } = await browserSupabase
    .from("submission_requests")
    .select(selectClause)
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error || !data) {
    return {
      activeProjects: [],
      restorableProjects: []
    };
  }

  const now = Date.now();
  const activeProjects = data.filter((row) => !row.deleted_at);
  const restorableProjects = data.filter((row) => {
    if (!row.deleted_at) {
      return false;
    }

    if (!row.restore_until) {
      return true;
    }

    return new Date(row.restore_until).getTime() > now;
  });

  return {
    activeProjects,
    restorableProjects
  };
}

export async function fetchCreatorDashboardData(sessionEmail, includeAdminQueue, rangeKey = "all") {
  if (!browserSupabase || !sessionEmail) {
    return null;
  }

  const activeRange = resolveDashboardRange(rangeKey);
  const [submissions, interactionEvents, queue, adminProjectManagement] = await Promise.all([
    fetchOwnSubmissions(sessionEmail),
    fetchInteractionEvents(),
    includeAdminQueue ? fetchAdminQueue() : Promise.resolve([]),
    includeAdminQueue
      ? fetchAdminProjectManagement()
      : Promise.resolve({ activeProjects: [], restorableProjects: [] })
  ]);

  const ownApprovedSubmissions = submissions.filter(
    (submission) => submission.status === "approved" && !submission.deleted_at
  );
  const ownedLocalApps = getOwnedLocalApps(sessionEmail);
  const submissionEvents = getTrackedProjectEvents(interactionEvents, ownApprovedSubmissions);
  const localProjectEvents = getTrackedLocalEvents(interactionEvents, ownedLocalApps);
  const ownProjectEvents = uniqueEvents([...submissionEvents, ...localProjectEvents]);
  const ownMagicLinkEvents = interactionEvents.filter(
    (event) =>
      event.event_type === "magic_link_request" &&
      event.route_path === "/creator/dashboard" &&
      (!event.actor_email || normalizeEmail(event.actor_email) === normalizeEmail(sessionEmail))
  );
  const rangedProjectEvents = filterRowsByRange(ownProjectEvents, activeRange);
  const ownIntroOpens = rangedProjectEvents.filter((event) => event.event_type === "intro_open").length;
  const ownExternalClicks = rangedProjectEvents.filter(
    (event) => event.event_type === "external_click"
  ).length;
  const ownDetailViews = rangedProjectEvents.filter((event) => event.event_type === "detail_view").length;
  const pendingSubmissions = submissions.filter((submission) => submission.status === "pending");
  const publishedProjects = buildPublishedProjectEntries(
    ownApprovedSubmissions,
    ownedLocalApps,
    rangedProjectEvents
  );

  return {
    activeRange,
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
    pendingSubmissions,
    ownApprovedSubmissions,
    ownedLocalApps,
    ownProjectEvents,
    rangedProjectEvents,
    ownMagicLinkEvents,
    queue,
    publishedProjects,
    adminProjectManagement
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
    activeRange,
    submissions,
    ownApprovedSubmissions,
    ownedLocalApps = [],
    rangedProjectEvents,
    ownMagicLinkEvents
  } = dashboardData;

  if (metricKey === "submissions") {
    return {
      title: "Einreichungen",
      description: metricDefinitions.submissions.description,
      total: submissions.length,
      rangeLabel: "Gesamt",
      items: submissions.map((submission) => ({
        title: submission.project_name,
        summary: `Status: ${submission.status}`,
        meta: `${submission.email} | ${formatDateTime(submission.created_at)}`,
        breakdown: []
      }))
    };
  }

  if (metricKey === "freigaben") {
    const liveProjects = [
      ...ownApprovedSubmissions.map((submission) => ({
        title: submission.project_name,
        summary: `Slug: ${submission.public_slug || buildSubmissionSlug(submission)}`,
        meta: submission.approved_at
          ? `Freigegeben am ${formatDateTime(submission.approved_at)}`
          : "Noch nicht freigegeben",
        breakdown: []
      })),
      ...ownedLocalApps.map((app) => ({
        title: app.title,
        summary: "Lokales Projekt auf der Startseite",
        meta: app.detailPath || "Ohne Detailseite",
        breakdown: []
      }))
    ];

    return {
      title: "Freigaben",
      description: metricDefinitions.freigaben.description,
      total: liveProjects.length,
      rangeLabel: "Gesamt",
      items: liveProjects
    };
  }

  if (metricKey === "anmeldungen") {
    return {
      title: metricDefinitions.anmeldungen.label,
      description: metricDefinitions.anmeldungen.description,
      total: ownMagicLinkEvents.length,
      rangeLabel: "Gesamt",
      items: ownMagicLinkEvents.map((event, index) => ({
        title: `Anfrage ${index + 1}`,
        summary: "Magic Link für den Creator-Bereich angefordert",
        meta: formatDateTime(event.created_at),
        breakdown: []
      }))
    };
  }

  const eventTypes = getMetricEventTypes(metricKey);
  const filteredEvents = rangedProjectEvents.filter((event) => eventTypes.includes(event.event_type));

  return {
    title: metricDefinitions[metricKey].label,
    description: metricDefinitions[metricKey].description,
    total: filteredEvents.length,
    rangeLabel: activeRange.label,
    items: buildProjectEventItems(metricKey, filteredEvents)
  };
}
