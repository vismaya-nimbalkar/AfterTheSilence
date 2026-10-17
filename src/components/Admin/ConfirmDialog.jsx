"use client";

import { useCallback, useRef, useState } from "react";

export function useConfirmDialog() {
  const [options, setOptions] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((nextOptions) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOptions(nextOptions);
    });
  }, []);

  const close = useCallback((accepted) => {
    resolverRef.current?.(accepted);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const alert = useCallback((message, title = "Notice") => {
    return confirm({
      title,
      message,
      mode: "alert",
      confirmLabel: "Got it",
      danger: false,
    });
  }, [confirm]);

  return {
    confirm,
    alert,
    dialog: options ? <ConfirmDialog {...options} onClose={close} /> : null,
  };
}

function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Continue",
  danger = true,
  mode = "confirm",
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/50 px-4 py-6 backdrop-blur-sm" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose(false);
        }}
        className="w-full max-w-md rounded-2xl border border-dark/10 bg-white p-6 shadow-2xl dark:border-light/10 dark:bg-zinc-900 sm:p-7"
      >
        <div className="flex items-start gap-4">
          <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold ${danger && mode !== "alert" ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-dark/5 text-dark dark:bg-light/10 dark:text-light"}`}>
            {danger && mode !== "alert" ? "!" : "i"}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold">{title}</h2>
            <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 opacity-70">{message}</p>
          </div>
        </div>
        <div className="mt-7 flex justify-end gap-3">
          {mode !== "alert" && (
            <button type="button" onClick={() => onClose(false)} className="rounded-xl border border-dark/15 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-dark/5 dark:border-light/15 dark:hover:bg-light/5">
              Cancel
            </button>
          )}
          <button type="button" autoFocus onClick={() => onClose(true)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 ${danger && mode !== "alert" ? "bg-red-600" : "bg-dark dark:bg-light dark:text-dark"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
