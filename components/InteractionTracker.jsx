"use client";

import { useEffect } from "react";
import { trackInteraction } from "../lib/interaction-tracking";

export default function InteractionTracker({
  itemId,
  itemTitle,
  itemSource = "local",
  eventType,
  routePath
}) {
  useEffect(() => {
    trackInteraction({ itemId, itemTitle, itemSource, eventType, routePath });
  }, [eventType, itemId, itemSource, itemTitle, routePath]);

  return null;
}
