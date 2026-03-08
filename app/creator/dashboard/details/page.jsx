import { Suspense } from "react";
import CreatorMetricDetailClient from "../../../../components/CreatorMetricDetailClient";

export default function CreatorDashboardDetailsPage() {
  return (
    <Suspense
      fallback={
        <section className="dashboard-stack">
          <article className="card">
            <h1>Detailansicht</h1>
            <p>Lade Details...</p>
          </article>
        </section>
      }
    >
      <CreatorMetricDetailClient />
    </Suspense>
  );
}
