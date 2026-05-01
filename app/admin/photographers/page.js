"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import clsx from "clsx";

const SERVICE_LABELS = {
  photography: "Photography",
  drone:       "Drone",
  video:       "Video",
  matterport:  "Matterport",
  floorPlans:  "Floor Plans",
};

const BLANK = {
  name:  "",
  email: "",
  phone: "",
  active: true,
  services: {
    photography: false,
    drone:       false,
    video:       false,
    matterport:  false,
    floorPlans:  false,
  },
  workingHours: {
    monday:    { start: "08:00", end: "18:00", active: true  },
    tuesday:   { start: "08:00", end: "18:00", active: true  },
    wednesday: { start: "08:00", end: "18:00", active: true  },
    thursday:  { start: "08:00", end: "18:00", active: true  },
    friday:    { start: "08:00", end: "18:00", active: true  },
    saturday:  { start: "08:00", end: "18:00", active: false },
    sunday:    { start: "08:00", end: "18:00", active: false },
  },
  googleCalendarId: "",
  icalFeedUrl:      "",
};

export default function PhotographersPage() {
  const [photographers, setPhotographers] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [editing,       setEditing]       = useState(null); // photographer id being edited
  const [form,          setForm]          = useState(BLANK);
  const [saving,        setSaving]        = useState(false);
  const [message,       setMessage]       = useState("");

  useEffect(() => {
    getDocs(collection(db, "photographers"))
      .then((snap) => setPhotographers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .finally(() => setLoading(false));
  }, []);

  function openNew() {
    setForm(BLANK);
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(p) {
    setForm({ ...BLANK, ...p });
    setEditing(p.id);
    setShowForm(true);
  }

  function handleFieldChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleService(key) {
    setForm((prev) => ({
      ...prev,
      services: { ...prev.services, [key]: !prev.services[key] },
    }));
  }

  function toggleDay(day) {
    setForm((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: { ...prev.workingHours[day], active: !prev.workingHours[day].active },
      },
    }));
  }

  function setHour(day, field, value) {
    setForm((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [day]: { ...prev.workingHours[day], [field]: value },
      },
    }));
  }

  async function handleSave() {
    if (!form.name || !form.email) { setMessage("Name and email are required."); return; }
    setSaving(true);
    setMessage("");

    try {
      const data = {
        name:             form.name,
        email:            form.email,
        phone:            form.phone || "",
        active:           form.active,
        services:         form.services,
        workingHours:     form.workingHours,
        googleCalendarId: form.googleCalendarId || "",
        icalFeedUrl:      form.icalFeedUrl || "",
      };

      if (editing) {
        await updateDoc(doc(db, "photographers", editing), data);
        setPhotographers((prev) =>
          prev.map((p) => (p.id === editing ? { id: editing, ...data } : p))
        );
        setMessage("Photographer updated ✓");
      } else {
        const ref = await addDoc(collection(db, "photographers"), data);
        setPhotographers((prev) => [...prev, { id: ref.id, ...data }]);
        setMessage("Photographer added ✓");
      }

      setShowForm(false);
    } catch (err) {
      setMessage("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p) {
    await updateDoc(doc(db, "photographers", p.id), { active: !p.active });
    setPhotographers((prev) =>
      prev.map((ph) => (ph.id === p.id ? { ...ph, active: !ph.active } : ph))
    );
  }

  const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-[#3486cf]">Photographers</h1>
        <button onClick={openNew} className="btn-primary">+ Add Photographer</button>
      </div>

      {message && !showForm && (
        <div className="bg-green-50 border border-green-200 rounded-sm p-3 mb-4">
          <p className="text-green-700 text-sm font-body">{message}</p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-gray-400 font-body">Loading...</p>
      ) : (
        <div className="space-y-3">
          {photographers.length === 0 && (
            <div className="card text-center py-10">
              <p className="text-gray-400 font-body">No photographers yet. Add one above.</p>
            </div>
          )}
          {photographers.map((p) => (
            <div key={p.id} className="card flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-[#3486cf]/10 flex items-center justify-center
                                font-display text-[#3486cf] text-lg flex-shrink-0">
                  {p.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-body font-semibold text-[#0F172A]">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.email}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {Object.entries(p.services || {})
                      .filter(([, v]) => v)
                      .map(([k]) => (
                        <span key={k} className="text-xs bg-[#3486cf]/10 text-[#3486cf] px-2 py-0.5 rounded-full">
                          {SERVICE_LABELS[k]}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => toggleActive(p)}
                  className={clsx(
                    "text-xs px-3 py-1 rounded-full font-body font-medium border transition-colors",
                    p.active
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-100 text-gray-400 border-gray-200"
                  )}
                >
                  {p.active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="text-xs text-[#3486cf] font-body underline underline-offset-2"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit drawer */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl text-[#3486cf]">
                {editing ? "Edit Photographer" : "Add Photographer"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            {message && (
              <p className="text-red-600 text-sm font-body mb-4">{message}</p>
            )}

            <div className="space-y-4">
              {/* Basic info */}
              <div>
                <label className="block text-sm font-body font-medium mb-1.5">Full Name *</label>
                <input name="name" value={form.name} onChange={handleFieldChange} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-body font-medium mb-1.5">Email *</label>
                <input name="email" type="email" value={form.email} onChange={handleFieldChange} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-body font-medium mb-1.5">Phone</label>
                <input name="phone" value={form.phone} onChange={handleFieldChange} className="input-field" />
              </div>

              {/* Services */}
              <div>
                <label className="block text-sm font-body font-medium mb-2">Services</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SERVICE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleService(key)}
                      className={clsx(
                        "text-left text-sm font-body px-3 py-2 border rounded-sm transition-colors",
                        form.services[key]
                          ? "bg-[#3486cf] text-white border-[#3486cf]"
                          : "border-gray-200 text-gray-600 hover:border-[#3486cf]/30"
                      )}
                    >
                      {form.services[key] ? "✓ " : ""}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Working hours */}
              <div>
                <label className="block text-sm font-body font-medium mb-2">Working Hours</label>
                <div className="space-y-2">
                  {DAYS.map((day) => {
                    const h = form.workingHours[day];
                    return (
                      <div key={day} className="flex items-center gap-3 text-sm font-body">
                        <button
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={clsx(
                            "w-24 text-left px-2 py-1 rounded-sm border text-xs capitalize transition-colors",
                            h.active
                              ? "bg-[#3486cf]/10 border-[#3486cf]/20 text-[#3486cf] font-medium"
                              : "border-gray-200 text-gray-400"
                          )}
                        >
                          {h.active ? "✓ " : ""}{day.slice(0, 3)}
                        </button>
                        {h.active && (
                          <>
                            <input
                              type="time"
                              value={h.start}
                              onChange={(e) => setHour(day, "start", e.target.value)}
                              className="input-field py-1 text-xs w-28"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                              type="time"
                              value={h.end}
                              onChange={(e) => setHour(day, "end", e.target.value)}
                              className="input-field py-1 text-xs w-28"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calendar integration (Phase 2) */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-body font-medium mb-1 text-gray-500">
                  Google Calendar ID
                  <span className="text-xs font-normal ml-1 text-gray-400">(Phase 2)</span>
                </label>
                <input
                  name="googleCalendarId"
                  value={form.googleCalendarId}
                  onChange={handleFieldChange}
                  placeholder="name@group.calendar.google.com"
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-body font-medium mb-1 text-gray-500">
                  iCal Feed URL
                  <span className="text-xs font-normal ml-1 text-gray-400">(Phase 2)</span>
                </label>
                <input
                  name="icalFeedUrl"
                  value={form.icalFeedUrl}
                  onChange={handleFieldChange}
                  placeholder="webcal://..."
                  className="input-field text-sm"
                />
              </div>

              {/* Save */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Saving..." : "Save Photographer"}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-outline">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
