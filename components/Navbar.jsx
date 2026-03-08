"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { browserSupabase } from "../lib/supabase-browser";

export default function Navbar() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!browserSupabase) {
      return;
    }

    browserSupabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
    });

    const { data: listener } = browserSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setHasSession(Boolean(nextSession));
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link href="/" className="brand" aria-label="Zur Startseite">
          <span className="brand-dot" aria-hidden />
          CuratedHub
        </Link>
        <nav className="nav-links" aria-label="Hauptnavigation">
          <Link href="/">Startseite</Link>
          <Link href="/submit">Projekt einreichen</Link>
          <Link href="/creator/dashboard">{hasSession ? "Mein Dashboard" : "Anmelden"}</Link>
        </nav>
      </div>
    </header>
  );
}
