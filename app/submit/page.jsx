import { supabase } from "../../lib/supabase";
import { stripe } from "../../lib/stripe";

export default function SubmitPage() {
  return (
    <section className="card">
      <h1>Submit App/Bot</h1>
      <p>
        Auth stub: {supabase ? "Supabase configured" : "Set SUPABASE_URL/SUPABASE_KEY in .env.local"}
      </p>
      <p>
        Payments stub: {stripe ? "Stripe configured" : "Set STRIPE_KEY in .env.local"}
      </p>

      <form>
        <label>
          App Name
          <input className="input" name="name" placeholder="My App" />
        </label>
        <label>
          Website
          <input className="input" name="url" placeholder="https://..." />
        </label>
        <label>
          Description
          <textarea className="textarea" name="description" placeholder="Short pitch..." />
        </label>
        <button type="submit" className="button">
          Submit (stub)
        </button>
      </form>
    </section>
  );
}
