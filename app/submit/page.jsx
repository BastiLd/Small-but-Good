import SubmitProjectForm from "../../components/SubmitProjectForm";

export default function SubmitPage() {
  return (
    <section className="card submit-page-card">
      <p className="dashboard-eyebrow">Community-Einreichung</p>
      <h1>Projekt einreichen</h1>
      <p className="submit-page-intro">
        Trag dein Projekt ein und entscheide dann unten, ob du alles per E-Mail öffnen, direkt mit
        Supabase senden oder mit deinem Account einreichen willst.
      </p>
      <SubmitProjectForm />
    </section>
  );
}
