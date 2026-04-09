"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";

const SKILL_LABELS = {
  classicDaytime:         "Classic Daytime",
  luxuryDaytime:          "Luxury Daytime",
  drone:                  "Drone",
  realTwilight:           "Twilight",
  premiumCinematicVideo:  "Cinematic Video",
  luxuryCinematicVideo:   "Luxury Video",
  socialReel:             "Social Reel",
  matterport:             "Matterport",
  zillow3d:               "Zillow 3D",
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS     = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const COLORS     = ["#0b2a55","#1e6091","#2e7d32","#6a1b9a","#d84315","#00695c","#827717","#ad1457"];

function getWeekDates(anchor) {
  const d = new Date(anchor);
  d.setHours(0,0,0,0);
  const dayOfWeek = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

// ─── Member form modal ────────────────────────────────────────────────────────
function MemberForm({ member, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    name:   member?.name   || "",
    email:  member?.email  || "",
    phone:  member?.phone  || "",
    skills: member?.skills || [],
    color:  member?.color  || COLORS[0],
    active: member?.active !== false,
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  function toggleSkill(s) {
    setForm((f) => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s] }));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  async function handleDelete() {
    if (!window.confirm("Remove this team member?")) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-display text-navy text-lg">{member ? "Edit Team Member" : "Add Team Member"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label-field">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({...f, name: e.target.value}))}
                className="input-field w-full" placeholder="Alex Johnson" />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({...f, email: e.target.value}))}
                className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({...f, phone: e.target.value}))}
                className="input-field w-full" />
            </div>
          </div>

          <div>
            <label className="label-field">Calendar Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm((f) => ({...f, color: c}))}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-1 ring-gray-400 scale-110" : ""}`} />
              ))}
            </div>
          </div>

          <div>
            <label className="label-field">Skills / Services</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SKILL_LABELS).map(([id, label]) => (
                <button key={id} type="button" onClick={() => toggleSkill(id)}
                  className={`text-xs px-2.5 py-1.5 rounded-sm border font-medium transition-colors ${
                    form.skills.includes(id) ? "bg-navy text-white border-navy" : "border-gray-200 text-gray-600 hover:border-navy/40"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.active}
              onChange={(e) => setForm((f) => ({...f, active: e.target.checked}))} />
            <label htmlFor="active" className="text-sm text-charcoal cursor-pointer">Active</label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          {member
            ? <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-500 hover:text-red-700">
                {deleting ? "Removing…" : "Remove member"}
              </button>
            : <div />
          }
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary px-6 py-2 text-sm">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [members,    setMembers]    = useState([]);
  const [bookings,   setBookings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(null);   // null | member | "new"
  const [anchor,     setAnchor]     = useState(new Date());
  const [filterMember, setFilterMember] = useState("all");

  const getToken = () => auth.currentUser?.getIdToken();

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const [teamRes, listRes] = await Promise.all([
        fetch("/api/dashboard/team",     { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/listings", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [teamData, listData] = await Promise.all([teamRes.json(), listRes.json()]);
      setMembers(teamData.members  || []);
      setBookings(listData.listings || []);
      setLoading(false);
    }
    load();
  }, []);

  async function saveMember(form) {
    const token = await getToken();
    if (editing === "new") {
      const res  = await fetch("/api/dashboard/team", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setMembers((m) => [...m, data.member]);
    } else {
      await fetch(`/api/dashboard/team/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      setMembers((m) => m.map((x) => x.id === editing.id ? { ...x, ...form } : x));
    }
    setEditing(null);
  }

  async function deleteMember() {
    const token = await getToken();
    await fetch(`/api/dashboard/team/${editing.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setMembers((m) => m.filter((x) => x.id !== editing.id));
    setEditing(null);
  }

  // ─── Calendar ──────────────────────────────────────────────────────────────
  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);

  function prevWeek() {
    setAnchor((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  }
  function nextWeek() {
    setAnchor((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
  }
  function goToday() {
    setAnchor(new Date());
  }

  // Map confirmed/completed bookings that have a shootDate to calendar
  const calendarEvents = useMemo(() => {
    return bookings
      .filter((b) => b.shootDate && ["confirmed", "completed"].includes(b.status))
      .map((b) => ({ ...b, shootDateObj: new Date(b.shootDate) }));
  }, [bookings]);

  // Bookings with no photographer assigned (needs scheduling)
  const unscheduled = bookings.filter(
    (b) => b.status === "requested" || (b.status === "confirmed" && !b.shootDate)
  );

  const today = new Date();
  today.setHours(0,0,0,0);

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  const visibleMembers = filterMember === "all" ? members : members.filter((m) => m.id === filterMember);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">Team</h1>
          <p className="text-gray-400 text-sm mt-0.5">{members.length} team member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setEditing("new")} className="btn-primary text-sm px-5 py-2 flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Add Member
        </button>
      </div>

      {/* Team member cards */}
      {members.length > 0 && (
        <div className="flex gap-3 flex-wrap mb-6">
          {members.map((m) => (
            <button key={m.id} onClick={() => setEditing(m)}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-sm px-4 py-3 hover:shadow-sm transition-shadow text-left">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: m.color || "#0b2a55" }}>
                {m.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-sm font-medium text-charcoal">{m.name}</p>
                <p className="text-xs text-gray-400">{m.skills?.length || 0} skills</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Calendar section */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden mb-6">
        {/* Calendar toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={prevWeek} className="p-1.5 hover:bg-gray-100 rounded">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={goToday} className="text-xs border border-gray-200 px-2.5 py-1 rounded hover:bg-gray-50">Today</button>
            <button onClick={nextWeek} className="p-1.5 hover:bg-gray-100 rounded">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <p className="font-semibold text-charcoal text-sm">
              {MONTHS[weekDates[0].getMonth()]} {weekDates[0].getDate()} – {weekDates[6].getDate()}, {weekDates[0].getFullYear()}
            </p>
          </div>

          {/* Filter by photographer */}
          <select value={filterMember} onChange={(e) => setFilterMember(e.target.value)}
            className="input-field text-sm py-1.5 w-44">
            <option value="all">All Photographers</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {weekDates.map((d) => {
            const isToday = isSameDay(d, today);
            return (
              <div key={d.toISOString()} className={`px-2 py-2 text-center border-r last:border-r-0 border-gray-100 ${isToday ? "bg-navy/4" : ""}`}>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{DAYS_SHORT[d.getDay()]}</p>
                <p className={`text-sm font-bold mt-0.5 ${isToday ? "w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center mx-auto" : "text-charcoal"}`}>
                  {d.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Calendar rows per photographer */}
        {visibleMembers.length === 0 && members.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <p className="text-3xl mb-2">📅</p>
            <p className="font-medium text-gray-500">No team members yet</p>
            <p className="text-sm mt-1">Add photographers to see their schedule here.</p>
          </div>
        ) : visibleMembers.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No members match the filter.</div>
        ) : (
          <div>
            {visibleMembers.map((member) => {
              const memberEvents = calendarEvents.filter(
                (e) => e.photographerId === member.id
              );

              return (
                <div key={member.id} className="border-b last:border-b-0 border-gray-100">
                  {/* Member label */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50">
                    <div className="w-5 h-5 rounded-full flex-shrink-0"
                      style={{ background: member.color || "#0b2a55" }} />
                    <p className="text-xs font-semibold text-charcoal">{member.name}</p>
                    <div className="flex gap-1 flex-wrap ml-1">
                      {(member.skills || []).slice(0, 4).map((s) => (
                        <span key={s} className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-sm">
                          {SKILL_LABELS[s] || s}
                        </span>
                      ))}
                      {(member.skills || []).length > 4 && (
                        <span className="text-xs text-gray-400">+{member.skills.length - 4} more</span>
                      )}
                    </div>
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 min-h-12">
                    {weekDates.map((d) => {
                      const dayEvents = memberEvents.filter((e) => isSameDay(e.shootDateObj, d));
                      const isToday   = isSameDay(d, today);
                      return (
                        <div key={d.toISOString()}
                          className={`p-1 border-r last:border-r-0 border-gray-100 min-h-12 ${isToday ? "bg-navy/2" : ""}`}>
                          {dayEvents.map((ev) => (
                            <div key={ev.id}
                              style={{ background: member.color + "22", borderLeftColor: member.color }}
                              className="text-xs border-l-2 px-1.5 py-1 rounded-sm mb-1 truncate">
                              <p className="font-medium truncate" style={{ color: member.color }}>
                                {ev.address}
                              </p>
                              {ev.preferredTime && (
                                <p className="text-gray-400 capitalize">{ev.preferredTime}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Unassigned row */}
            {filterMember === "all" && (
              <div className="border-t border-dashed border-gray-200">
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/50">
                  <div className="w-5 h-5 rounded-full bg-amber-400 flex-shrink-0" />
                  <p className="text-xs font-semibold text-amber-700">Unassigned shoots</p>
                  <span className="text-xs text-amber-600 ml-1">({unscheduled.length})</span>
                </div>
                <div className="grid grid-cols-7 min-h-12">
                  {weekDates.map((d) => {
                    const dayUnscheduled = unscheduled.filter((b) => {
                      if (!b.preferredDate) return false;
                      return isSameDay(new Date(b.preferredDate + "T12:00:00"), d);
                    });
                    return (
                      <div key={d.toISOString()} className="p-1 border-r last:border-r-0 border-gray-100 min-h-12">
                        {dayUnscheduled.map((b) => (
                          <div key={b.id} className="text-xs bg-amber-50 border-l-2 border-amber-400 px-1.5 py-1 rounded-sm mb-1">
                            <p className="font-medium text-amber-700 truncate">{b.address}</p>
                            <p className="text-amber-500 capitalize">{b.preferredTime}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unscheduled list */}
      {unscheduled.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="font-semibold text-charcoal text-sm">Needs Scheduling ({unscheduled.length})</p>
          </div>
          {unscheduled.map((b) => (
            <div key={b.id} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0 border-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal truncate">{b.address}</p>
                <p className="text-xs text-gray-400">{b.clientName} · {b.preferredDate ? new Date(b.preferredDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date"} · {b.preferredTime}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {(b.serviceIds || []).concat(b.packageId ? [b.packageId] : []).map((s) => (
                  <span key={s} className="text-xs bg-navy/8 text-navy px-1.5 py-0.5 rounded-sm capitalize">{s}</span>
                ))}
              </div>
              <a href={`/dashboard/listings/${b.id}`} className="text-xs text-navy hover:underline flex-shrink-0">
                Assign →
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Add/edit modal */}
      {editing && (
        <MemberForm
          member={editing === "new" ? null : editing}
          onSave={saveMember}
          onDelete={deleteMember}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
