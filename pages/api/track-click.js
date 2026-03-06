import { supabase } from "../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const appId = body.app_id;
  if (!appId) return res.status(400).json({ error: "app_id is required" });

  if (!supabase) {
    console.log("[mock-click]", { app_id: appId, referrer: body.referrer || null });
    return res.status(200).json({ ok: true, mocked: true });
  }

  const { error } = await supabase.from("clicks").insert([
    {
      app_id: appId,
      referrer: body.referrer || null,
      user_agent: req.headers["user-agent"] || null
    }
  ]);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
