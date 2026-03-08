import SubmitProjectForm from "../../components/SubmitProjectForm";

export default function SubmitPage() {
  return (
    <section className="card">
      <h1>Projekt einreichen</h1>
      <p>
        Trag dein Projekt ein und entscheide dann unten, ob du alles per E-Mail &ouml;ffnen oder
        direkt mit Supabase senden willst.
      </p>
      <SubmitProjectForm />
    </section>
  );
}
