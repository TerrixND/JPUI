"use client";

import { useEffect } from "react";

/**
 * Sets --jp-vh-height CSS variable to the actual visible viewport height.
 * Used as a fallback for browsers that don't support 100dvh.
 */
export default function ViewportHeightSync() {
  useEffect(() => {
    const commit = () => {
      const vv = window.visualViewport;
      const height = vv ? vv.height : window.innerHeight;
      if (height > 0) {
        document.documentElement.style.setProperty(
          "--jp-vh-height",
          `${height}px`,
        );
      }
    };

    commit();

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", commit);
    }
    window.addEventListener("resize", commit, { passive: true });
    window.addEventListener("orientationchange", commit);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", commit);
      }
      window.removeEventListener("resize", commit);
      window.removeEventListener("orientationchange", commit);
    };
  }, []);

  return null;
}
