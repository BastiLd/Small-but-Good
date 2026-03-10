"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "../lib/basePath";
import styles from "./ProjectContentSections.module.css";

export default function ProjectContentSections({ title, sections = [] }) {
  const visibleSections = sections.filter(
    (section) => section?.heading || section?.text || section?.imageUrl
  );
  const [expandedImage, setExpandedImage] = useState(null);

  useEffect(() => {
    if (!expandedImage) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setExpandedImage(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedImage]);

  if (!visibleSections.length) {
    return null;
  }

  return (
    <>
      <div className={styles.sectionList}>
        {visibleSections.map((section, index) => {
          const imageSrc = section.imageUrl ? withBasePath(section.imageUrl) : "";
          const imageAlt = section.imageAlt || `${title} Bild ${index + 1}`;

          return (
            <section key={section.id || `section-${index}`} className={styles.sectionCard}>
              <div className={styles.copy}>
                {section.heading ? <h2 className={styles.heading}>{section.heading}</h2> : null}
                {section.text ? <p className={styles.text}>{section.text}</p> : null}
              </div>

              {imageSrc ? (
                <div className={styles.mediaColumn}>
                  <button
                    type="button"
                    className={styles.mediaButton}
                    onClick={() => setExpandedImage({ src: imageSrc, alt: imageAlt })}
                  >
                    <img src={imageSrc} alt={imageAlt} className={styles.image} />
                  </button>
                  <span className={styles.caption}>Antippen oder klicken zum Vergrößern</span>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {expandedImage ? (
        <div className={styles.lightbox} onClick={() => setExpandedImage(null)}>
          <div className={styles.lightboxCard} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={() => setExpandedImage(null)}
              aria-label="Bild schließen"
            >
              ×
            </button>
            <img
              src={expandedImage.src}
              alt={expandedImage.alt}
              className={styles.lightboxImage}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
