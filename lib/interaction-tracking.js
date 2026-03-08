import { browserSupabase } from "./supabase-browser";

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

  try {
    await browserSupabase.from("interaction_events").insert([
      {
        item_id: itemId,
        item_title: itemTitle || null,
        item_source: itemSource,
        event_type: eventType,
        route_path: routePath || window.location.pathname || null,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent || null
      }
    ]);
  } catch {
    // Tracking darf die Oberfl\u00E4che nicht st\u00F6ren.
  }
}
