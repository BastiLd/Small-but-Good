import { browserSupabase } from "./supabase-browser";

export async function sendModerationNotification({ nextStatus, submission }) {
  if (!browserSupabase) {
    return {
      sent: false,
      reason: "supabase_not_configured"
    };
  }

  try {
    const { data, error } = await browserSupabase.functions.invoke("moderation-email", {
      body: {
        nextStatus,
        submission
      }
    });

    if (error) {
      return {
        sent: false,
        reason: "invoke_failed",
        message: error.message
      };
    }

    return data || { sent: false, reason: "empty_response" };
  } catch (error) {
    return {
      sent: false,
      reason: "invoke_failed",
      message: error?.message || "Die Moderationsfunktion konnte nicht aufgerufen werden."
    };
  }
}
