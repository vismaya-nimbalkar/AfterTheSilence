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

  return {
    confirm,
    dialog: options ? <ConfirmDialog {...options} onClose={close} /> : null,
  };
}

function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Continue",
  danger = true,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-dark/40 px-6 backdrop-blur-sm" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-2xl border border-dark/15 bg-light p-6 shadow-2xl dark:bg-dark"
      >
        <h2 id="confirm-dialog-title" className="text-xl font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-6 opacity-70">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => onClose(false)} className="rounded-lg border border-dark/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-dark/5">
            Cancel
          </button>
          <button type="button" onClick={() => onClose(true)} className={`rounded-lg px-4 py-2 text-sm font-medium text-light transition-opacity hover:opacity-80 ${danger ? "bg-red-600" : "bg-dark"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
