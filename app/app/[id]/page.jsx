import Link from "next/link";
import { notFound } from "next/navigation";
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
      <div>
        <img
          src={withBasePath(app.screenshots?.[0] || "/images/Logo_Nexus_Battle.png")}
          alt={`${app.title} Logo`}
          className="detail-image"
        />

        <div className="detail-chip-row">
          <span className="detail-chip">{app.platform}</span>
          <span className="detail-chip">{app.type}</span>
        </div>

        <a
          href={app.store_url}
          target="_blank"
          rel="noreferrer"
          className="button detail-inline-btn"
        >
          Zur Originalseite
        </a>
      </div>

      <div>
        <h1 style={{ marginTop: 0 }}>{app.title}</h1>
        <p className="detail-text">{app.longDescription}</p>

        <h2>Hauptfunktionen</h2>
        <ul className="detail-list">
          {(app.features || []).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2>Wichtige Commands</h2>
        <ul className="detail-list">
          {(app.commands || []).map((cmd) => (
            <li key={cmd.signature}>
              <strong>{cmd.signature}</strong> - {cmd.desc}
            </li>
          ))}
        </ul>

        <h2>Beispielkarten</h2>
        <ul className="detail-list">
          {(app.cardsPreview || []).map((card) => (
            <li key={card}>{card}</li>
          ))}
        </ul>

        <h2>DB Tabellen (Auszug)</h2>
        <ul className="detail-list">
          {(app.dbTables || []).map((tableName) => (
            <li key={tableName}>{tableName}</li>
          ))}
        </ul>

        <Link href="/" className="button detail-inline-btn">
          Zurück zur Übersicht
        </Link>
      </div>
    </article>
  );
}