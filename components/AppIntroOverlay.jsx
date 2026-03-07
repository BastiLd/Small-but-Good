"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./AppIntroOverlay.module.css";
import { withBasePath } from "../lib/basePath";

const INTRO_EVENT = "app-intro:open";
const CONTENT_REVEAL_DELAY_MS = 1650;

export function openIntroFor(appId, options = {}) {
  if (typeof window === "undefined" || !appId) return false;

  window.dispatchEvent(
    new CustomEvent(INTRO_EVENT, {
      detail: {
        appId,
        imagePublicPath: options.imagePublicPath,
        introText: options.introText
      }
    })
  );

  return true;
}

const AppIntroOverlay = forwardRef(function AppIntroOverlay(
  { appId, imagePublicPath = "", introText = "" },
  ref
) {
  const router = useRouter();
  const dialogRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const closeTimerRef = useRef(null);
  const contentTimerRef = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [fadeActive, setFadeActive] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [payload, setPayload] = useState({ appId, imagePublicPath, introText });

  const getReducedMotion = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  const close = useCallback((shouldRoute) => {
    const currentAppId = payload?.appId;

    setContentVisible(false);
    setFadeActive(false);

    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
    }

    const reduceMotion = getReducedMotion();
    closeTimerRef.current = setTimeout(() => {
      setMounted(false);

      if (shouldRoute && currentAppId) {
        const target = `/app/${currentAppId}`;

        try {
          router.push(target);
        } catch {
          window.location.href = withBasePath(target);
        }
      }
    }, reduceMotion ? 0 : 420);
  }, [payload, router]);

  const open = useCallback((nextPayload) => {
    const merged = {
      appId: nextPayload?.appId || appId,
      imagePublicPath: nextPayload?.imagePublicPath || imagePublicPath,
      introText: nextPayload?.introText || introText
    };

    if (!merged.appId) return;

    setPayload(merged);
    setMounted(true);
    setContentVisible(false);

    if (contentTimerRef.current) {
      clearTimeout(contentTimerRef.current);
    }

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        setFadeActive(true);

        if (getReducedMotion()) {
          setContentVisible(true);
          return;
        }

        contentTimerRef.current = setTimeout(() => {
          setContentVisible(true);
        }, CONTENT_REVEAL_DELAY_MS);
      });
    } else {
      setFadeActive(true);
      setContentVisible(true);
    }
  }, [appId, imagePublicPath, introText]);

  useImperativeHandle(ref, () => ({
    open,
    close: () => close(false)
  }), [open, close]);

  useEffect(() => {
    const onOpenEvent = (event) => {
      open(event?.detail || {});
    };

    if (typeof window !== "undefined") {
      window.addEventListener(INTRO_EVENT, onOpenEvent);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(INTRO_EVENT, onOpenEvent);
      }
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted || !contentVisible) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      if (confirmButtonRef.current) {
        confirmButtonRef.current.focus();
      } else if (dialogRef.current) {
        dialogRef.current.focus();
      }
    };

    const t = setTimeout(focusFirst, 0);

    const handleKeyDown = (event) => {
      if (!dialogRef.current) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        close(true);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, contentVisible, close]);

  if (!mounted) return null;

  return (
    <div
      className={`${styles.overlay} ${fadeActive ? styles.overlayActive : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="App Intro Overlay"
    >
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${contentVisible ? styles.contentVisible : ""}`}
        tabIndex={-1}
      >
        <div className={styles.dialogBody}>
          {payload?.imagePublicPath ? (
            <div className={styles.mediaFrame}>
              <img
                src={payload.imagePublicPath}
                alt={`Intro Bild für ${payload.appId}`}
                className={styles.image}
              />
            </div>
          ) : null}

          <div className={styles.copyColumn}>
            <p className={styles.introText}>{payload?.introText}</p>

            <button
              ref={confirmButtonRef}
              type="button"
              className={styles.confirmButton}
              aria-label="Verstanden und zur App wechseln"
              onClick={() => close(true)}
            >
              Verstanden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AppIntroOverlay;
