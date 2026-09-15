"use client";

import { useEffect, useState } from "react";

export default function LoadingScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 500);

    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <main
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-light text-dark dark:bg-dark dark:text-light"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 text-sm opacity-70">
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
        <span>Loading...</span>
      </div>
    </main>
  );
}