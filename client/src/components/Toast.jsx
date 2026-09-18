import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

/**
 * A lightweight, modern Sonner-style Toast notification
 * for graceful user feedback (e.g. after deletion or clear actions).
 */
export default function Toast({
  message,
  type = "success", // "success" | "info" | "warning"
  duration = 3200,
  onClose,
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />,
    info: <Info className="h-4 w-4 text-lamp flex-shrink-0" />,
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-starlight/20 bg-dusk/95 px-4 py-3 text-parchment shadow-2xl shadow-black/60 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300"
    >
      {icons[type] || icons.success}
      <span className="font-sans text-xs sm:text-sm font-medium pr-2">
        {message}
      </span>
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 text-starlight/60 hover:text-parchment hover:bg-starlight/10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
