import { supabase } from "../../../lib/supabase";
import { stripe } from "../../../lib/stripe";

export default function CreatorDashboardPage() {
  return (
    <section className="page-grid">
      <article className="card">
        <h1>Creator-Bereich</h1>
        <p>Supabase: {supabase ? "verbunden" : "noch nicht konfiguriert"}</p>
        <p>Stripe: {stripe ? "verbunden" : "noch nicht konfiguriert"}</p>
      </article>
      <article className="card">
        <h2>Statistiken</h2>
        <p>Apps: 0</p>
        <p>Klicks: 0</p>
        <p>Umsatz: 0,00 €</p>
      </article>
    </section>
  );
}
