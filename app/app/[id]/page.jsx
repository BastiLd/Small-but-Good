import Link from "next/link";
import { notFound } from "next/navigation";
import InteractionTracker from "../../../components/InteractionTracker";
import TrackedExternalLink from "../../../components/TrackedExternalLink";
import { APPS, getAppById } from "../../../lib/apps";
import { withBasePath } from "../../../lib/basePath";

export function generateStaticParams() {
  return APPS.map((app) => ({ id: app.id }));
}

export default function AppDetailPage({ params }) {
  const app = getAppById(params?.id);
  if (!app) notFound();

  return (
    <article className="card detail-wrap" aria-label={`${app.title} Details`}>
      <InteractionTracker
        itemId={app.runtimeId || app.id}
        itemTitle={app.title}
        itemSource={app.itemSource || "local"}
        eventType="detail_view"
        routePath={`/app/${app.id}`}
      />

      <div>
        <img
          src={withBasePath(app.screenshots?.[0] || "/images/project-placeholder.svg")}
          alt={`${app.title} Logo`}
          className="detail-image"
        />

        <div className="detail-chip-row">
          <span className="detail-chip">{app.platformLabel || app.platform}</span>
          <span className="detail-chip">{app.typeLabel || app.type}</span>
        </div>

        {app.store_url ? (
          <TrackedExternalLink
            href={app.store_url}
            itemId={app.runtimeId || app.id}
            itemTitle={app.title}
            itemSource={app.itemSource || "local"}
            className="button detail-inline-btn"
          >
            Zur Originalseite
          </TrackedExternalLink>
        ) : null}
      </div>

      <div>
        <h1 style={{ marginTop: 0 }}>{app.title}</h1>

        {app.detailBodyImage ? (
          <img
            src={withBasePath(app.detailBodyImage)}
            alt={app.detailBodyImageAlt || `${app.title} Vorschau`}
            className="detail-body-image"
          />
        ) : null}

        {app.longDescription ? <p className="detail-text">{app.longDescription}</p> : null}

        {(app.features || []).length ? (
          <>
            <h2>Hauptfunktionen</h2>
            <ul className="detail-list">
              {(app.features || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}

        {(app.commands || []).length ? (
          <>
            <h2>Wichtige Befehle</h2>
            <ul className="detail-list">
              {(app.commands || []).map((cmd) => (
                <li key={cmd.signature}>
                  <strong>{cmd.signature}</strong> - {cmd.desc}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {(app.cardsPreview || []).length ? (
          <>
            <h2>Beispielkarten</h2>
            <ul className="detail-list">
              {(app.cardsPreview || []).map((card) => (
                <li key={card}>{card}</li>
              ))}
            </ul>
          </>
        ) : null}

        {(app.dbTables || []).length ? (
          <>
            <h2>Datenbank-Tabellen</h2>
            <ul className="detail-list">
              {(app.dbTables || []).map((tableName) => (
                <li key={tableName}>{tableName}</li>
              ))}
            </ul>
          </>
        ) : null}

        <Link href="/" className="button detail-inline-btn">
          Zurück zur Übersicht
        </Link>
      </div>
    </article>
  );
}
