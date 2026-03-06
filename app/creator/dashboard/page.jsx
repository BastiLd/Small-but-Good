import { supabase } from "../../../lib/supabase";
import { stripe } from "../../../lib/stripe";

export default function CreatorDashboardPage() {
  return (
    <section className="page-grid">
      <article className="card">
        <h1>Creator Dashboard</h1>
        <p>Supabase Auth stub: {supabase ? "ready" : "missing env keys"}</p>
        <p>Stripe stub: {stripe ? "ready" : "missing env key"}</p>
      </article>
      <article className="card">
        <h2>Stats (placeholder)</h2>
        <p>Apps: 0</p>
        <p>Clicks: 0</p>
        <p>Revenue: $0.00</p>
      </article>
    </section>
  );
}
