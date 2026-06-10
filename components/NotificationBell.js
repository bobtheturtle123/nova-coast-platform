"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

function timeAgo(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ICON = { referral: "🎉", billing: "💳", info: "🔔" };

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch("/api/dashboard/notifications/feed", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.items || []);
      setUnread(d.unread || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // refresh each minute
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function openPanel() {
    setOpen((v) => !v);
    if (!open && unread > 0) {
      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch("/api/dashboard/notifications/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ all: true }),
        });
        setUnread(0);
        setItems((arr) => arr.map((i) => ({ ...i, read: true })));
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={openPanel} className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors" aria-label="Notifications">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" className="text-gray-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 text-sm font-semibold text-gray-800">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">You're all caught up.</div>
            ) : items.map((n) => (
              <button key={n.id}
                onClick={() => { setOpen(false); if (n.link) router.push(n.link); }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex gap-3">
                <span className="text-lg leading-none mt-0.5">{ICON[n.type] || ICON.info}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-800">{n.title}</span>
                  {n.body && <span className="block text-xs text-gray-500 mt-0.5">{n.body}</span>}
                  <span className="block text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#3486cf] mt-1.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
