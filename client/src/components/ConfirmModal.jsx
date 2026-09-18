import React, { useEffect, useRef } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";

/**
 * A beautiful, accessible bedtime-themed confirmation modal
 * replacing browser default window.confirm/alert dialogs.
 */
export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Delete",
  cancelText = "Keep Story",
  confirmVariant = "danger", // "danger" | "primary"
  icon: Icon = Trash2,
  onConfirm,
  onCancel,
}) {
  const cancelBtnRef = useRef(null);

  // Focus cancel button on mount for safe keyboard navigation & ESC to close
  useEffect(() => {
    if (!isOpen) return;

    cancelBtnRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const isDanger = confirmVariant === "danger";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-starlight/20 bg-dusk/95 p-6 shadow-2xl shadow-black/80 backdrop-blur-md">
        {/* Decorative subtle ambient glow */}
        <div
          className={`pointer-events-none absolute -top-20 -right-20 h-44 w-44 rounded-full blur-3xl ${
            isDanger ? "bg-red-500/15" : "bg-lamp/15"
          }`}
        />

        {/* Close icon button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 rounded-full p-1.5 text-starlight/60 hover:text-parchment hover:bg-starlight/10 transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border ${
              isDanger
                ? "border-red-500/30 bg-red-950/50 text-red-400 shadow-inner"
                : "border-lamp/30 bg-lamp/15 text-lamp"
            }`}
          >
            <Icon className="h-6 w-6" />
          </div>

          <div className="flex-1 pr-4">
            <h3
              id="confirm-modal-title"
              className="font-serif text-xl font-bold text-parchment"
            >
              {title}
            </h3>
            <p
              id="confirm-modal-desc"
              className="mt-1.5 font-sans text-xs sm:text-sm text-starlight/80 leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-starlight/10 pt-4">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-starlight/20 bg-panel/70 px-4 py-2 font-sans text-xs sm:text-sm font-semibold text-parchment transition-all hover:bg-panel hover:border-starlight/40 focus:outline-hidden focus:ring-2 focus:ring-starlight/30"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 font-sans text-xs sm:text-sm font-bold shadow-lg transition-all focus:outline-hidden ${
              isDanger
                ? "bg-gradient-to-r from-red-600 to-rose-700 text-white hover:from-red-500 hover:to-rose-600 hover:shadow-red-900/40 focus:ring-2 focus:ring-red-500/50"
                : "bg-lamp text-dusk hover:scale-105 shadow-lamp/20 focus:ring-2 focus:ring-lamp/50"
            }`}
          >
            {isDanger && <Trash2 className="h-3.5 w-3.5" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
