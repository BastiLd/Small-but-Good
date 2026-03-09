"use client";

import { useEffect, useRef } from "react";
import styles from "./TextPromptOverlay.module.css";

export default function TextPromptOverlay({
  open,
  onClose,
  title,
  confirmLabel = "Schließen",
  transparentBackdrop = false,
  warmSurface = false,
  children
}) {
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => buttonRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const overlayClassName = [
    styles.overlay,
    transparentBackdrop ? styles.overlayTransparent : ""
  ]
    .filter(Boolean)
    .join(" ");
  const dialogClassName = [styles.dialog, warmSurface ? styles.dialogWarm : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={overlayClassName} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={dialogClassName} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <div className={styles.content}>
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          <div className={styles.body}>{children}</div>
          <div className={styles.actions}>
            <button ref={buttonRef} type="button" className={styles.confirmButton} onClick={onClose}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
