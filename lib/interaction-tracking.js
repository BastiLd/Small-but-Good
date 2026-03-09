import { browserSupabase } from "./supabase-browser";

async function getActorContext() {
  if (!browserSupabase) {
    return { actorEmail: null, actorUserId: null };
  }

  try {
    const { data } = await browserSupabase.auth.getSession();
    return {
      actorEmail: data.session?.user?.email?.trim().toLowerCase() || null,
      actorUserId: data.session?.user?.id || null
    };
  } catch {
    return { actorEmail: null, actorUserId: null };
  }
}

export async function trackInteraction({
  itemId,
  itemTitle,
  itemSource = "local",
  eventType,
  routePath = null
}) {
  if (typeof window === "undefined" || !browserSupabase || !itemId || !eventType) {
    return;
  }

  const basePayload = {
    item_id: itemId,
    item_title: itemTitle || null,
    item_source: itemSource,
    event_type: eventType,
    route_path: routePath || window.location.pathname || null,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent || null
  };

  try {
    const { actorEmail, actorUserId } = await getActorContext();
    const payload = {
      ...basePayload,
      actor_email: actorEmail,
      actor_user_id: actorUserId
    };

    const { error } = await browserSupabase.from("interaction_events").insert([payload]);

    if (error && /actor_email|actor_user_id/i.test(error.message || "")) {
      await browserSupabase.from("interaction_events").insert([basePayload]);
    }
  } catch {
    // Tracking darf die Oberfläche nicht stören.
  }
}
