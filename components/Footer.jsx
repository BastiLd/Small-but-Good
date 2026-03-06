export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <small>© {new Date().getFullYear()} CuratedHub. All rights reserved.</small>
        <small>Curated app & bot discovery.</small>
      </div>
    </footer>
  );
}
