"use client";

import { trackInteraction } from "../lib/interaction-tracking";

export default function TrackedExternalLink({
  href,
  itemId,
  itemTitle,
  itemSource = "local",
  className,
  children
}) {
  async function onClick() {
    await trackInteraction({
      itemId,
      itemTitle,
      itemSource,
      eventType: "external_click",
      routePath: typeof window !== "undefined" ? window.location.pathname : null
    });
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} onClick={onClick}>
      {children}
    </a>
  );
}
