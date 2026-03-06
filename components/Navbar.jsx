import Link from "next/link";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="Zur Startseite">
          <span className="brand-dot" aria-hidden />
          CuratedHub
        </Link>
        <nav className="nav-links" aria-label="Hauptnavigation">
          <Link href="/">Home</Link>
          <Link href="/submit">Submit</Link>
          <Link href="/creator/dashboard">Creator Dashboard</Link>
        </nav>
      </div>
    </header>
  );
}
