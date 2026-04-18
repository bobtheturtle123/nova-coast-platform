"use client";

import { createContext, useCallback, useContext, useReducer, useRef } from "react";

const ToastContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "ADD":    return [...state, action.toast];
    case "REMOVE": return state.filter((t) => t.id !== action.id);
    default:       return state;
  }
}

export function ToastProvider({ children }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const counter = useRef(0);

  const toast = useCallback((message, type = "success", duration = 4000) => {
    const id = ++counter.current;
    dispatch({ type: "ADD", toast: { id, message, kind: type } });
    setTimeout(() => dispatch({ type: "REMOVE", id }), duration);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: "360px" }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium transition-all duration-300 ${
              t.kind === "error"
                ? "bg-red-600 text-white"
                : t.kind === "warning"
                ? "bg-amber-500 text-white"
                : "bg-[#0F172A] text-white"
            }`}
          >
            <span className="flex-shrink-0 mt-0.5">
              {t.kind === "error" ? (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : t.kind === "warning" ? (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              ) : (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
