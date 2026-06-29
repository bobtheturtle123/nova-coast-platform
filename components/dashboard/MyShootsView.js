"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

function fmtDate(iso) {
  if (!iso) return "Date TBD";
  const d = new Date(iso);
  if (isNaN(d)) return "Date TBD";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(t) {
  if (!t) return null;
  // Accept "14:30" or label strings.
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  let h = Number(m[1]); const min = m[2]; const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

function ShootRow({ s }) {
  return (
    <div className="flex items-start gap-3 p-3.5 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-[#3486cf]/10 flex flex-col items-center justify-center flex-shrink-0 text-[#3486cf]">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#0F172A] truncate">{s.address}{s.city ? `, ${s.city}` : ""}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {fmtDate(s.shootDate)}
          {s.shootTime ? ` · ${fmtTime(s.shootTime)}` : ""}
          {s.duration ? ` · ${s.duration} min` : ""}
          {s.twilight ? <span className="text-amber-600"> · Twilight{s.twilightTime ? ` ${fmtTime(s.twilightTime)}` : ""}</span> : ""}
        </p>
        {s.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{s.notes}</p>}
      </div>
      {s.status && (
        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0 capitalize">{String(s.status).replace(/_/g, " ")}</span>
      )}
    </div>
  );
}

export default function MyShootsView({ firstName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      if (!token) return;
      try {
        const res = await fetch("/api/dashboard/my-shoots", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    });
  }, []);

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" /></div>;
  }

  const upcoming = data?.upcoming || [];
  const undated  = data?.undated  || [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">{greeting}{firstName ? `, ${firstName}` : ""}</h1>
        <p className="text-sm text-gray-500 mt-1">Your upcoming shoots</p>
      </div>

      {upcoming.length === 0 && undated.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <p className="text-3xl mb-3">📷</p>
          <p className="font-medium text-gray-500">No upcoming shoots assigned</p>
          <p className="text-sm mt-1">When you're scheduled for a shoot, it'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {upcoming.map((s) => <ShootRow key={s.id} s={s} />)}
          {undated.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-3">Date to be confirmed</p>
              {undated.map((s) => <ShootRow key={s.id} s={s} />)}
            </>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pt-2">
        Manage your availability in <a href="/dashboard/calendar" className="text-[#3486cf] hover:underline">My Schedule</a>.
      </p>
    </div>
  );
}
