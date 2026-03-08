export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <small>© {new Date().getFullYear()} CuratedHub. Alle Rechte vorbehalten.</small>
        <small>Ausgewählte Apps, Bots und Creator an einem Ort.</small>
      </div>
    </footer>
  );
}
