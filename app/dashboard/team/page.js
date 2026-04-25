"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/Toast";

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

function fmt12(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":");
  const hr = Number(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}

function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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
function MemberForm({ member, products, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    name:          member?.name          || "",
    email:         member?.email         || "",
    phone:         member?.phone         || "",
    skills:        member?.skills        || [],
    color:         member?.color         || COLORS[0],
    active:        member?.active        !== false,
    payRate:       member?.payRate       ?? "",
    serviceRates:  member?.serviceRates  || {},
    bufferMinutes: member?.bufferMinutes ?? "",
  });
  const [showServiceRates, setShowServiceRates] = useState(
    Object.keys(member?.serviceRates || {}).length > 0
  );
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  function toggleSkill(s) {
    setForm((f) => ({ ...f, skills: f.skills.includes(s) ? f.skills.filter((x) => x !== s) : [...f.skills, s] }));
  }

  // All products flattened for skills selection
  const allProducts = [
    ...(products.services || []),
    ...(products.packages || []),
    ...(products.addons   || []),
  ].filter((p) => p.active !== false);

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
            <label className="label-field">Services They Can Perform</label>
            {allProducts.length === 0 ? (
              <p className="text-xs text-gray-400">Add products first to assign services to photographers.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allProducts.map((p) => (
                  <button key={p.id} type="button" onClick={() => toggleSkill(p.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                      form.skills.includes(p.id) ? "bg-charcoal text-white border-charcoal" : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label-field">Default Pay Rate (per shoot, $)</label>
            <input type="number" min="0" step="0.01" value={form.payRate}
              onChange={(e) => setForm((f) => ({...f, payRate: e.target.value === "" ? "" : parseFloat(e.target.value)}))}
              className="input-field w-full" placeholder="e.g. 150" />
            <p className="text-xs text-gray-500 mt-0.5">Used when no per-service rate is set. Visible in their photographer portal.</p>

            {form.skills.length > 0 && (
              <div className="mt-3">
                <button type="button" onClick={() => setShowServiceRates((v) => !v)}
                  className="text-xs text-navy underline hover:no-underline">
                  {showServiceRates ? "Hide per-service rates" : "Set per-service rates (optional)"}
                </button>
                {showServiceRates && (
                  <div className="mt-2 border border-gray-200 rounded-sm divide-y divide-gray-100">
                    {form.skills.map((skillId) => {
                      const product = allProducts.find((p) => p.id === skillId);
                      if (!product) return null;
                      const hasTiers = product.priceTiers && Object.values(product.priceTiers).some((v) => v > 0);
                      return (
                        <div key={skillId} className="px-3 py-2">
                          <p className="text-xs font-semibold text-charcoal mb-1.5">{product.name}</p>
                          {hasTiers ? (
                            <div className="grid grid-cols-3 gap-2">
                              {Object.keys(product.priceTiers).map((tier) => (
                                <div key={tier}>
                                  <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">{tier}</label>
                                  <input type="number" min="0" step="1" placeholder={String(form.payRate || "")}
                                    value={form.serviceRates?.[skillId]?.[tier] ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value === "" ? undefined : Number(e.target.value);
                                      setForm((f) => ({
                                        ...f,
                                        serviceRates: {
                                          ...f.serviceRates,
                                          [skillId]: { ...(f.serviceRates?.[skillId] || {}), [tier]: val },
                                        },
                                      }));
                                    }}
                                    className="input-field w-full text-xs py-1.5 px-2" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <input type="number" min="0" step="1" placeholder={String(form.payRate || "Default")}
                              value={typeof form.serviceRates?.[skillId] === "number" ? form.serviceRates[skillId] : ""}
                              onChange={(e) => setForm((f) => ({
                                ...f,
                                serviceRates: {
                                  ...f.serviceRates,
                                  [skillId]: e.target.value === "" ? undefined : Number(e.target.value),
                                },
                              }))}
                              className="input-field w-full text-xs py-1.5 px-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="label-field">
              Booking Buffer
              <span className="font-normal text-gray-400 ml-1">(extra time after each shoot)</span>
            </label>
            <select value={form.bufferMinutes}
              onChange={(e) => setForm((f) => ({ ...f, bufferMinutes: e.target.value === "" ? "" : Number(e.target.value) }))}
              className="input-field w-full">
              <option value="">Default (no extra buffer)</option>
              <option value={15}>+15 min</option>
              <option value={30}>+30 min</option>
              <option value={45}>+45 min</option>
              <option value={60}>+60 min</option>
              <option value={90}>+90 min</option>
            </select>
            <p className="text-xs text-gray-400 mt-0.5">For photographers who need more time between jobs.</p>
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

// ─── Calendar sync modal ─────────────────────────────────────────────────────
function CalendarSyncModal({ member, onClose, onRegenerate }) {
  const APP_URL    = typeof window !== "undefined" ? window.location.origin : "";
  const isGCalConnected = !!member.googleCalendar?.refreshToken;

  const [gcalError, setGcalError] = useState("");

  async function connectGoogleCalendar() {
    setGcalError("");
    try {
      const { auth: firebaseAuth } = await import("@/lib/firebase");
      const token = await firebaseAuth.currentUser.getIdToken();
      // Quick preflight check
      const check = await fetch(`/api/calendar/oauth/start?token=${token}&memberId=${member.id}&preflight=1`);
      if (!check.ok) {
        const d = await check.json().catch(() => ({}));
        setGcalError(d.error || "Configuration error");
        return;
      }
      window.location.href = `/api/calendar/oauth/start?token=${token}&memberId=${member.id}`;
    } catch (e) {
      setGcalError(e.message);
    }
  }
  const feedUrl = member.calendarToken
    ? `${APP_URL}/api/calendar/${member.calendarToken}`
    : null;

  const webcalUrl  = feedUrl ? feedUrl.replace(/^https?:\/\//, "webcal://") : null;
  const gcalUrl    = feedUrl
    ? `https://calendar.google.com/calendar/r/settings/addbyurl?url=${encodeURIComponent(feedUrl)}`
    : null;

  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-display text-navy text-lg">Calendar Sync — {member.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Google Calendar OAuth */}
          <div className={`border rounded-lg p-4 ${isGCalConnected ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="2" fill="#4285F4"/>
                  <path d="M18 12c0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6 6-2.69 6-6z" fill="white"/>
                  <path d="M14.5 12c0-1.38-1.12-2.5-2.5-2.5S9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5z" fill="#4285F4"/>
                </svg>
                <div>
                  <p className="text-sm font-medium text-charcoal">Google Calendar Sync</p>
                  <p className="text-xs text-gray-500">
                    {isGCalConnected
                      ? `Connected · last synced ${member.googleCalendar?.connectedAt ? new Date(member.googleCalendar.connectedAt).toLocaleDateString() : "recently"}`
                      : "Connect to block unavailable times automatically"}
                  </p>
                </div>
              </div>
              {isGCalConnected
                ? <span className="tag-green">Connected</span>
                : <button onClick={connectGoogleCalendar} className="btn-primary text-xs px-3 py-1.5">Connect</button>
              }
              {gcalError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <p className="font-semibold mb-1">Setup required</p>
                  <p>{gcalError === "GOOGLE_CLIENT_ID not configured"
                    ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your Vercel environment variables. Create OAuth credentials at console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client IDs."
                    : gcalError}</p>
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Subscribe to this calendar feed to see {member.name}&apos;s shoots in any calendar app.
            The feed updates automatically as new bookings are confirmed.
          </p>

          {feedUrl ? (
            <>
              {/* Feed URL */}
              <div>
                <label className="label-field">Subscribe URL</label>
                <div className="flex gap-2 items-center">
                  <code className="text-xs bg-gray-50 border border-gray-200 rounded px-3 py-2 flex-1 truncate text-gray-700">
                    {feedUrl}
                  </code>
                  <button onClick={copyLink}
                    className="text-xs text-navy border border-navy/20 px-3 py-2 rounded hover:bg-navy/5 flex-shrink-0">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Quick subscribe buttons */}
              <div className="space-y-2">
                <label className="label-field">Quick Subscribe</label>
                <a href={gcalUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 w-full border border-gray-200 rounded px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="2" fill="#4285F4"/>
                    <path d="M18 12c0-3.31-2.69-6-6-6s-6 2.69-6 6 2.69 6 6 6 6-2.69 6-6z" fill="white"/>
                    <path d="M14.5 12c0-1.38-1.12-2.5-2.5-2.5S9.5 10.62 9.5 12s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5z" fill="#4285F4"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-charcoal">Google Calendar</p>
                    <p className="text-xs text-gray-400">Opens Google Calendar to add the feed</p>
                  </div>
                </a>

                <a href={webcalUrl}
                  className="flex items-center gap-3 w-full border border-gray-200 rounded px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="24" height="24" rx="2" fill="#1c1c1e"/>
                    <rect x="4" y="5" width="16" height="15" rx="1.5" fill="white"/>
                    <rect x="4" y="5" width="16" height="4" rx="1.5" fill="#F44336"/>
                    <path d="M8 13h2v2H8v-2zm3 0h2v2h-2v-2zm3 0h2v2h-2v-2zM8 16h2v2H8v-2zm3 0h2v2h-2v-2z" fill="#1c1c1e"/>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-charcoal">Apple Calendar</p>
                    <p className="text-xs text-gray-400">Opens Calendar app via webcal:// link</p>
                  </div>
                </a>

                <div className="text-xs text-gray-400 bg-gray-50 rounded px-3 py-2">
                  <strong>Other apps (Outlook, Fantastical, etc.):</strong> Copy the URL above and paste it into &ldquo;Subscribe to calendar&rdquo; in your app.
                </div>
              </div>

              {/* Regenerate */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">
                  Regenerating the link will break any existing subscriptions.
                </p>
                <button onClick={onRegenerate}
                  className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-3 py-1.5 rounded">
                  Regenerate link
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded px-4 py-3">
              No calendar token found. Edit and save this team member to generate one.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="btn-outline px-5 py-2 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Block Time Modal ─────────────────────────────────────────────────────────
const BLOCK_REASONS = ["Vacation", "Day Off", "Personal", "Holiday", "Sick Day", "Other"];

function BlockTimeModal({ members, onSave, onClose, timeBlocks, onDeleteBlock }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    memberId:   "",
    startDate:  today,
    endDate:    today,
    startTime:  "",
    endTime:    "",
    reason:     "Vacation",
    note:       "",
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("new"); // "new" | "existing"

  async function handleSave() {
    if (!form.startDate || !form.endDate) return;
    setSaving(true);
    const member = members.find((m) => m.id === form.memberId);
    await onSave({
      ...form,
      memberName: member?.name || "All Team",
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-display text-navy text-lg">Block Time</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="flex border-b border-gray-200">
          {["new", "existing"].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? "border-navy text-navy" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t === "new" ? "Add Block" : `Existing (${timeBlocks.length})`}
            </button>
          ))}
        </div>

        {tab === "new" ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="label-field">Photographer</label>
              <select value={form.memberId} onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
                className="input-field w-full">
                <option value="">All Team (everyone blocked)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Start Date</label>
                <input type="date" value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="input-field w-full" />
              </div>
              <div>
                <label className="label-field">End Date</label>
                <input type="date" value={form.endDate} min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="input-field w-full" />
              </div>
            </div>
            <div>
              <label className="label-field">Time Range (optional)</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="time" value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="input-field w-full" placeholder="Start time" />
                <input type="time" value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="input-field w-full" placeholder="End time" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Leave blank to block the entire day(s).</p>
            </div>
            <div>
              <label className="label-field">Reason</label>
              <select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                className="input-field w-full">
                {BLOCK_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label-field">Note (optional)</label>
              <input type="text" value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="input-field w-full" placeholder="Internal note…" />
            </div>
            <div className="pt-2 flex gap-3">
              <button onClick={handleSave} disabled={saving || !form.startDate || !form.endDate}
                className="btn-primary px-6 py-2 text-sm flex-1">
                {saving ? "Saving…" : "Block Dates"}
              </button>
              <button onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {timeBlocks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No time blocks set.</p>
            ) : (
              timeBlocks.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-sm">
                  <div>
                    <p className="text-sm font-medium text-charcoal">{b.memberName} — {b.reason}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(b.startDate).toLocaleDateString()} – {new Date(b.endDate).toLocaleDateString()}
                      {b.note && ` · ${b.note}`}
                    </p>
                  </div>
                  <button onClick={() => onDeleteBlock(b.id)}
                    className="text-xs text-red-500 hover:text-red-700 ml-3 font-medium">
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const toast = useToast();
  const [members,       setMembers]       = useState([]);
  const [bookings,      setBookings]      = useState([]);
  const [products,      setProducts]      = useState({ services: [], packages: [], addons: [] });
  const [loading,       setLoading]       = useState(true);
  const [editing,       setEditing]       = useState(null);
  const [anchor,        setAnchor]        = useState(new Date());
  const [filterMember,  setFilterMember]  = useState("all");
  const [calModal,      setCalModal]      = useState(null);
  const [calView,       setCalView]       = useState("2wk");  // "2wk" | "week" | "month" | "day"
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [showInvite,    setShowInvite]    = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg,     setInviteMsg]     = useState("");
  const [timeBlocks,    setTimeBlocks]    = useState([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockDetail,    setBlockDetail]    = useState(null); // { member, blocks, date }

  const getToken = () => auth.currentUser?.getIdToken();

  // Handle OAuth callback params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("calSuccess")) {
      toast("Google Calendar connected successfully!");
      window.history.replaceState({}, "", "/dashboard/team");
    } else if (params.get("calError")) {
      toast("Calendar connection failed: " + params.get("calError"), "error");
      window.history.replaceState({}, "", "/dashboard/team");
    }
  }, []);

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const [teamRes, listRes, svcRes, pkgRes, adnRes, blocksRes] = await Promise.all([
        fetch("/api/dashboard/team",                   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/listings",               { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=services", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=packages", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=addons",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team/blocks",            { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [teamData, listData, svcData, pkgData, adnData, blocksData] = await Promise.all([
        teamRes.json(), listRes.json(), svcRes.json(), pkgRes.json(), adnRes.json(), blocksRes.json(),
      ]);
      setMembers(teamData.members   || []);
      setBookings(listData.listings || []);
      setProducts({
        services: svcData.items || [],
        packages: pkgData.items || [],
        addons:   adnData.items || [],
      });
      setTimeBlocks(blocksData.blocks || []);
      setLoading(false);
    }
    load();
  }, []);

  async function saveMember(form) {
    const token = await getToken();
    try {
      if (editing === "new") {
        const res  = await fetch("/api/dashboard/team", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) { toast(data.error || "Failed to add member.", "error"); return; }
        setMembers((m) => [...m, data.member]);
        toast("Team member added.");
      } else {
        const res = await fetch(`/api/dashboard/team/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(form),
        });
        if (!res.ok) { toast("Failed to save.", "error"); return; }
        setMembers((m) => m.map((x) => x.id === editing.id ? { ...x, ...form } : x));
        toast("Team member saved.");
      }
    } catch { toast("Something went wrong.", "error"); }
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

  // 14 days (2 weeks) starting from the Sunday of the anchor week
  const twoWeekDates = useMemo(() => {
    const sunday = getWeekDates(anchor)[0];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  }, [anchor]);

  function prevPeriod() {
    setAnchor((d) => {
      const n = new Date(d);
      if (calView === "month") n.setMonth(n.getMonth() - 1);
      else if (calView === "day") n.setDate(n.getDate() - 1);
      else if (calView === "2wk") n.setDate(n.getDate() - 14);
      else n.setDate(n.getDate() - 7);
      return n;
    });
  }
  function nextPeriod() {
    setAnchor((d) => {
      const n = new Date(d);
      if (calView === "month") n.setMonth(n.getMonth() + 1);
      else if (calView === "day") n.setDate(n.getDate() + 1);
      else if (calView === "2wk") n.setDate(n.getDate() + 14);
      else n.setDate(n.getDate() + 7);
      return n;
    });
  }
  function goToday() { setAnchor(new Date()); }

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setInviteMsg("");
    try {
      const token = await getToken();
      const res = await fetch("/api/dashboard/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteMsg(`Invite sent to ${inviteEmail.trim()}!`);
        setInviteEmail("");
        setTimeout(() => { setShowInvite(false); setInviteMsg(""); }, 2500);
      } else {
        setInviteMsg(data.error || "Failed to send invite.");
      }
    } catch {
      setInviteMsg("Something went wrong.");
    } finally {
      setInviteSending(false);
    }
  }

  async function createBlock(blockData) {
    const token = await getToken();
    const res = await fetch("/api/dashboard/team/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(blockData),
    });
    const data = await res.json();
    if (res.ok) setTimeBlocks((prev) => [...prev, data.block]);
    return res.ok;
  }

  async function deleteBlock(id) {
    const token = await getToken();
    await fetch(`/api/dashboard/team/blocks?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setTimeBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  // ── Month view helpers ────────────────────────────────────────────────────
  const monthDates = useMemo(() => {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const startDow = first.getDay();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [anchor]);

  // Map confirmed/completed bookings that have a shootDate to calendar
  const calendarEvents = useMemo(() => {
    return bookings
      .filter((b) => (b.shootDate || b.preferredDate) && ["confirmed", "completed", "requested"].includes(b.status))
      .map((b) => {
        const raw = b.shootDate || b.preferredDate;
        const ds = typeof raw === "string" && raw.length === 10 ? raw + "T12:00:00" : raw;
        return { ...b, shootDateObj: new Date(ds) };
      });
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

  // In availability views hide inactive photographers; the member list still shows all
  const activeMembers = members.filter((m) => m.active !== false);
  const visibleMembers = filterMember === "all"
    ? (calView === "2wk" || calView === "week" ? activeMembers : members)
    : members.filter((m) => m.id === filterMember);

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">Team</h1>
          <p className="text-gray-400 text-sm mt-0.5">{members.length} team member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBlockModal(true)} className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
            🚫 Block Time
          </button>
          <button onClick={() => setShowInvite(true)} className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
            ✉ Invite via Email
          </button>
          <button onClick={() => setEditing("new")} className="btn-primary text-sm px-5 py-2 flex items-center gap-2">
            <span className="text-lg leading-none">+</span> Add Manually
          </button>
        </div>
      </div>

      {/* Team member cards */}
      {members.length > 0 && (
        <div className="flex gap-3 flex-wrap mb-6">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-sm px-4 py-3 hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: m.color || "#0b2a55" }}>
                {m.name?.[0]?.toUpperCase() || "?"}
              </div>
              <button onClick={() => setEditing(m)} className="text-left">
                <p className="text-sm font-medium text-charcoal">{m.name}</p>
                <p className="text-xs text-gray-400">{m.skills?.length || 0} skills</p>
              </button>
              <button
                onClick={() => setCalModal(m)}
                title="Calendar sync"
                className={`ml-2 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${
                  m.googleCalendar?.refreshToken
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-400 hover:border-navy/40 hover:text-navy"
                }`}
              >
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {m.googleCalendar?.refreshToken ? "Synced" : "Sync Cal"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Calendar section */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden mb-6">
        {/* Calendar toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button onClick={prevPeriod} className="p-1.5 hover:bg-gray-100 rounded">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button onClick={goToday} className="text-xs border border-gray-200 px-2.5 py-1 rounded hover:bg-gray-50">Today</button>
            <button onClick={nextPeriod} className="p-1.5 hover:bg-gray-100 rounded">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <p className="font-semibold text-charcoal text-sm">
              {calView === "month"
                ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
                : calView === "day"
                ? `${DAYS_SHORT[anchor.getDay()]}, ${MONTHS[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`
                : calView === "2wk"
                ? `${MONTHS[twoWeekDates[0].getMonth()].slice(0,3)} ${twoWeekDates[0].getDate()} – ${MONTHS[twoWeekDates[13].getMonth()].slice(0,3)} ${twoWeekDates[13].getDate()}, ${twoWeekDates[0].getFullYear()}`
                : `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getDate()} – ${weekDates[6].getDate()}, ${weekDates[0].getFullYear()}`
              }
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View selector */}
            <div className="flex border border-gray-200 rounded-sm overflow-hidden text-xs">
              {[
                { key: "2wk",   label: "2 Weeks" },
                { key: "week",  label: "Week" },
                { key: "month", label: "Month" },
                { key: "day",   label: "Day" },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setCalView(key)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    calView === key ? "bg-navy text-white" : "text-gray-500 hover:bg-gray-50"
                  }`}>{label}</button>
              ))}
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
        </div>

        {/* ── 2-WEEK AVAILABILITY GRID ───────────────────────────────────── */}
        {calView === "2wk" && (
          <div className="overflow-x-auto">
            {members.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <p className="text-3xl mb-2">📅</p>
                <p className="font-medium text-gray-500">No team members yet</p>
                <p className="text-sm mt-1">Add photographers to see their schedule here.</p>
              </div>
            ) : (
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="w-32 min-w-32 text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-r border-gray-200 bg-gray-50/60 sticky left-0 z-10">
                      Photographer
                    </th>
                    {twoWeekDates.map((d, i) => {
                      const isToday    = isSameDay(d, today);
                      const isSunday   = d.getDay() === 0;
                      const isWeek2Start = i === 7;
                      return (
                        <th key={d.toISOString()}
                          className={`text-center py-2 px-1 border-b border-r last:border-r-0 border-gray-200 min-w-14 ${
                            isToday    ? "bg-navy/5"  :
                            isWeek2Start ? "bg-gray-50" : ""
                          }`}>
                          {isWeek2Start && (
                            <div className="text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">Next Wk</div>
                          )}
                          {i === 0 && (
                            <div className="text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">This Wk</div>
                          )}
                          <div className={`text-[10px] uppercase font-semibold ${isToday ? "text-navy" : "text-gray-400"}`}>
                            {DAYS_SHORT[d.getDay()]}
                          </div>
                          <div className={`text-sm font-bold leading-tight ${
                            isToday ? "w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center mx-auto" : "text-charcoal"
                          }`}>
                            {d.getDate()}
                          </div>
                          <div className="text-[10px] text-gray-300 mt-0.5">
                            {MONTHS[d.getMonth()].slice(0,3)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((member) => {
                    const memberEvents = calendarEvents.filter(
                      (e) => e.photographerId === member.id || (e.photographerEmail && e.photographerEmail === member.email)
                    );
                    return (
                      <tr key={member.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40 transition-colors">
                        <td className="px-3 py-2 border-r border-gray-200 bg-white sticky left-0 z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: member.color || "#0b2a55" }} />
                            <span className="font-medium text-charcoal truncate max-w-24">{member.name}</span>
                          </div>
                        </td>
                        {twoWeekDates.map((d, i) => {
                          const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                          const dayEvents  = memberEvents.filter((e) => isSameDay(e.shootDateObj, d));
                          const dayBlocks  = timeBlocks.filter((b) => {
                            const startStr = (b.startDate || "").slice(0, 10);
                            const endStr   = (b.endDate   || b.startDate || "").slice(0, 10);
                            return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === member.id);
                          });
                          const isBlocked  = dayBlocks.length > 0;
                          const isPast     = d < today;
                          const isToday    = isSameDay(d, today);
                          const count      = dayEvents.length;
                          const isWeek2    = i >= 7;

                          return (
                            <td key={d.toISOString()}
                              className={`text-center py-2 px-1 border-r last:border-r-0 border-gray-100 min-w-14 align-middle ${
                                isToday  ? "bg-navy/3"  :
                                isWeek2  ? "bg-gray-50/50" :
                                isPast   ? "bg-gray-50/30" : ""
                              }`}>
                              {isBlocked ? (
                                <button
                                  onClick={() => setBlockDetail({ member, blocks: dayBlocks, date: d })}
                                  title="Click for details"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-500 mx-auto hover:bg-red-200 transition-colors cursor-pointer" style={{ fontSize: 14 }}>
                                  —
                                </button>
                              ) : count > 0 ? (
                                <a href={`/dashboard/listings/${dayEvents[0].id}`}
                                  title={dayEvents.map((e) => e.address?.split(",")[0]).join(", ")}
                                  className="inline-flex flex-col items-center gap-0.5">
                                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold mx-auto"
                                    style={{ background: member.color || "#0b2a55" }}>
                                    {count}
                                  </span>
                                  {dayEvents[0].preferredTime && (
                                    <span className="text-[10px] text-gray-400 capitalize leading-none">
                                      {dayEvents[0].preferredTime.slice(0, 3)}
                                    </span>
                                  )}
                                </a>
                              ) : isPast ? (
                                <span className="block w-1.5 h-1.5 rounded-full bg-gray-200 mx-auto" />
                              ) : (
                                <span className="block w-2 h-2 rounded-full bg-green-400 mx-auto" title="Available" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50/60 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-navy inline-flex items-center justify-center text-white text-[10px] font-bold">1</span> Booked (tap to view)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-red-100 inline-flex items-center justify-center text-red-500 text-xs">—</span> Blocked
              </span>
            </div>
          </div>
        )}

        {/* ── WEEK VIEW ──────────────────────────────────────────────────── */}
        {calView === "week" && (<>
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDates.map((d) => {
              const isToday = isSameDay(d, today);
              return (
                <div key={d.toISOString()} className={`px-2 py-3 text-center border-r last:border-r-0 border-gray-100 ${isToday ? "bg-navy/4" : ""}`}>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{DAYS_SHORT[d.getDay()]}</p>
                  <p className={`text-base font-bold mt-0.5 ${isToday ? "w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center mx-auto" : "text-charcoal"}`}>
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>
          {visibleMembers.length === 0 && members.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p className="text-3xl mb-2">📅</p>
              <p className="font-medium text-gray-500">No team members yet</p>
              <p className="text-sm mt-1">Add photographers to see their schedule here.</p>
            </div>
          ) : (
            <div>
              {visibleMembers.map((member) => {
                const memberEvents = calendarEvents.filter((e) => e.photographerId === member.id || (e.photographerEmail && e.photographerEmail === member.email));
                return (
                  <div key={member.id} className="border-b last:border-b-0 border-gray-100">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50/50">
                      <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: member.color || "#0b2a55" }} />
                      <p className="text-xs font-semibold text-charcoal">{member.name}</p>
                      <div className="flex gap-1 flex-wrap ml-1">
                        {(member.skills || []).slice(0, 4).map((s) => (
                          <span key={s} className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-sm">{SKILL_LABELS[s] || s}</span>
                        ))}
                        {(member.skills || []).length > 4 && <span className="text-xs text-gray-400">+{member.skills.length - 4} more</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-7 min-h-20">
                      {weekDates.map((d) => {
                        const dayEvents = memberEvents.filter((e) => isSameDay(e.shootDateObj, d));
                        const isToday = isSameDay(d, today);
                        // Compare as YYYY-MM-DD strings to avoid timezone shifts
                        const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                        const dayBlocks = timeBlocks.filter((b) => {
                          const startStr = (b.startDate || "").slice(0, 10);
                          const endStr   = (b.endDate || b.startDate || "").slice(0, 10);
                          return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === member.id);
                        });
                        return (
                          <div key={d.toISOString()} className={`p-1.5 border-r last:border-r-0 border-gray-100 min-h-20 relative ${isToday ? "bg-navy/2" : ""}`}>
                            {dayBlocks.length > 0 && (
                              <div className="absolute inset-0 pointer-events-none"
                                style={{ background: `repeating-linear-gradient(-45deg, ${hexWithAlpha(member.color || "#0b2a55", 0.12)}, ${hexWithAlpha(member.color || "#0b2a55", 0.12)} 3px, transparent 3px, transparent 10px)` }} />
                            )}
                            <div className="relative z-10">
                            {dayBlocks.map((bl) => (
                              <div key={bl.id} className="text-xs border-l-2 px-1.5 py-0.5 rounded-sm mb-1 group"
                                style={{ background: hexWithAlpha(member.color || "#0b2a55", 0.1), borderLeftColor: member.color || "#0b2a55" }}>
                                <div className="flex items-center justify-between">
                                  <span className="font-medium truncate" style={{ color: member.color || "#0b2a55" }}>{bl.reason}</span>
                                  <button onClick={() => deleteBlock(bl.id)}
                                    className="opacity-0 group-hover:opacity-100 ml-1 flex-shrink-0 text-[10px]"
                                    style={{ color: member.color || "#0b2a55" }}>×</button>
                                </div>
                                {(bl.startTime || bl.endTime) && (
                                  <p className="text-[10px]" style={{ color: hexWithAlpha(member.color || "#0b2a55", 0.7) }}>
                                    {fmt12(bl.startTime)}{bl.endTime ? ` – ${fmt12(bl.endTime)}` : ""}
                                  </p>
                                )}
                              </div>
                            ))}
                            {dayEvents.map((ev) => (
                              <div key={ev.id} style={{ background: member.color + "22", borderLeftColor: member.color }}
                                className="text-xs border-l-2 px-1.5 py-1 rounded-sm mb-1 truncate">
                                <p className="font-medium truncate" style={{ color: member.color }}>{ev.address}</p>
                                {ev.preferredTime && <p className="text-gray-400 capitalize">{ev.preferredTime}</p>}
                              </div>
                            ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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

          {/* ── Availability recap ─────────────────────────────────────────── */}
          {visibleMembers.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/60">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">This Week&apos;s Availability</p>
              <div className="space-y-2">
                {visibleMembers.map((member) => {
                  const memberEvents = calendarEvents.filter((e) => e.photographerId === member.id || (e.photographerEmail && e.photographerEmail === member.email));
                  const bookedDays = new Set(
                    memberEvents
                      .filter((e) => weekDates.some((d) => isSameDay(e.shootDateObj, d)))
                      .map((e) => DAYS_SHORT[e.shootDateObj.getDay()])
                  );
                  // Also mark days with time blocks as unavailable
                  weekDates.forEach((d) => {
                    const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                    const hasBlock = timeBlocks.some((b) => {
                      const startStr = (b.startDate || "").slice(0, 10);
                      const endStr   = (b.endDate   || b.startDate || "").slice(0, 10);
                      return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === member.id);
                    });
                    if (hasBlock) bookedDays.add(DAYS_SHORT[d.getDay()]);
                  });
                  const freeDays = weekDates
                    .filter((d) => d >= today && !bookedDays.has(DAYS_SHORT[d.getDay()]))
                    .map((d) => `${DAYS_SHORT[d.getDay()]} ${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`);
                  return (
                    <div key={member.id} className="flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0" style={{ background: member.color || "#0b2a55" }} />
                      <div>
                        <span className="text-xs font-semibold text-charcoal">{member.name}: </span>
                        {freeDays.length === 0
                          ? <span className="text-xs text-amber-600">Fully booked this week</span>
                          : <span className="text-xs text-green-700">Free — {freeDays.join(", ")}</span>
                        }
                        {bookedDays.size > 0 && (
                          <span className="text-xs text-gray-400 ml-2">· Booked: {Array.from(bookedDays).join(", ")}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>)}

        {/* ── MONTH VIEW ─────────────────────────────────────────────────── */}
        {calView === "month" && (
          <div>
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS_SHORT.map((d) => (
                <div key={d} className="px-2 py-2 text-center text-xs text-gray-400 uppercase tracking-wide border-r last:border-r-0 border-gray-100">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDates.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} className="border-r last:border-r-0 border-b border-gray-100 min-h-20 bg-gray-50/30" />;
                const isToday = isSameDay(d, today);
                const dayStr  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                const dayEvents = calendarEvents.filter((e) => isSameDay(e.shootDateObj, d));
                const visibleDayEvents = filterMember === "all"
                  ? dayEvents
                  : dayEvents.filter((e) => e.photographerId === filterMember);
                const dayBlocks = timeBlocks.filter((b) => {
                  const startStr = (b.startDate || "").slice(0, 10);
                  const endStr   = (b.endDate || b.startDate || "").slice(0, 10);
                  const memberMatch = filterMember === "all" ? true : (!b.memberId || b.memberId === filterMember);
                  return dayStr >= startStr && dayStr <= endStr && memberMatch;
                });
                const hasBlocks = dayBlocks.length > 0;
                return (
                  <div key={d.toISOString()} className={`border-r last:border-r-0 border-b border-gray-100 min-h-28 p-1.5 relative ${isToday ? "bg-blue-50/30" : ""}`}>
                    {hasBlocks && (
                      <div className="absolute inset-0 pointer-events-none rounded-sm"
                        style={{ background: "repeating-linear-gradient(-45deg, #fee2e2, #fee2e2 3px, transparent 3px, transparent 10px)", opacity: 0.5 }} />
                    )}
                    <p className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full relative z-10 ${isToday ? "bg-navy text-white" : "text-charcoal"}`}>
                      {d.getDate()}
                    </p>
                    {dayBlocks.slice(0, 2).map((bl) => (
                      <div key={bl.id} className="text-xs bg-red-100 border-l-2 border-red-400 px-1 py-0.5 rounded-sm mb-0.5 truncate relative z-10">
                        <span className="text-red-600 font-medium">{bl.reason || "Blocked"}</span>
                      </div>
                    ))}
                    {visibleDayEvents.slice(0, 3).map((ev) => {
                      const member = members.find((m) => m.id === ev.photographerId);
                      return (
                        <div key={ev.id} style={{ background: (member?.color || "#0b2a55") + "22", borderLeftColor: member?.color || "#0b2a55" }}
                          className="text-xs border-l-2 px-1 py-0.5 rounded-sm mb-0.5 truncate relative z-10">
                          <span style={{ color: member?.color || "#0b2a55" }} className="font-medium">{ev.address?.split(",")[0]}</span>
                        </div>
                      );
                    })}
                    {visibleDayEvents.length > 3 && (
                      <p className="text-xs text-gray-500 relative z-10">+{visibleDayEvents.length - 3} more</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── DAY VIEW ───────────────────────────────────────────────────── */}
        {calView === "day" && (
          <div className="p-4">
            {visibleMembers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No team members to display.</p>
            ) : (
              <div className="space-y-4">
                {visibleMembers.map((member) => {
                  const dayStr = `${anchor.getFullYear()}-${String(anchor.getMonth()+1).padStart(2,"0")}-${String(anchor.getDate()).padStart(2,"0")}`;
                  const memberEvents = calendarEvents.filter(
                    (e) => (e.photographerId === member.id || (e.photographerEmail && e.photographerEmail === member.email)) && isSameDay(e.shootDateObj, anchor)
                  );
                  const dayBlocks = timeBlocks.filter((b) => {
                    const startStr = (b.startDate || "").slice(0, 10);
                    const endStr   = (b.endDate || b.startDate || "").slice(0, 10);
                    return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === member.id);
                  });
                  const isBlocked = dayBlocks.length > 0;
                  return (
                    <div key={member.id} className="border border-gray-200 rounded-sm overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/50 border-b border-gray-100">
                        <div className="w-4 h-4 rounded-full" style={{ background: member.color || "#0b2a55" }} />
                        <p className="text-sm font-semibold text-charcoal">{member.name}</p>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                          isBlocked ? "bg-red-50 text-red-600" :
                          memberEvents.length > 0 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                        }`}>
                          {isBlocked ? "Blocked" : memberEvents.length > 0 ? `${memberEvents.length} shoot${memberEvents.length !== 1 ? "s" : ""}` : "Available"}
                        </span>
                      </div>
                      {dayBlocks.map((bl) => (
                        <div key={bl.id} className="px-4 py-2 border-b flex items-center justify-between"
                          style={{ background: hexWithAlpha(member.color || "#0b2a55", 0.06), borderColor: hexWithAlpha(member.color || "#0b2a55", 0.15) }}>
                          <div>
                            <p className="text-xs font-semibold" style={{ color: member.color || "#0b2a55" }}>{bl.reason || "Blocked"}</p>
                            {(bl.startTime || bl.endTime) && (
                              <p className="text-xs" style={{ color: hexWithAlpha(member.color || "#0b2a55", 0.65) }}>{fmt12(bl.startTime)} – {fmt12(bl.endTime)}</p>
                            )}
                            {bl.note && <p className="text-xs mt-0.5" style={{ color: hexWithAlpha(member.color || "#0b2a55", 0.6) }}>{bl.note}</p>}
                          </div>
                          <button onClick={() => deleteBlock(bl.id)} className="text-xs ml-3 font-medium"
                            style={{ color: hexWithAlpha(member.color || "#0b2a55", 0.5) }}>Remove</button>
                        </div>
                      ))}
                      {memberEvents.length === 0 && !isBlocked ? (
                        <p className="px-4 py-3 text-sm text-gray-400">No shoots scheduled for this day.</p>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {memberEvents.map((ev) => (
                            <div key={ev.id} className="px-4 py-3">
                              <p className="text-sm font-medium text-charcoal">{ev.address}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{ev.clientName} · {ev.shootTime || ev.preferredTime || "Time TBD"}</p>
                              <a href={`/dashboard/listings/${ev.id}`} className="text-xs text-navy hover:underline">View booking →</a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
          products={products}
          onSave={saveMember}
          onDelete={deleteMember}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-display text-navy text-lg">Invite Photographer</h2>
              <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteMsg(""); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">
                We&apos;ll send the photographer an email with a link to accept the invite,
                confirm their details, and connect their calendar.
              </p>
              <div>
                <label className="label-field">Photographer&apos;s Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  className="input-field w-full"
                  placeholder="photographer@example.com"
                  autoFocus
                />
              </div>
              {inviteMsg && (
                <p className={`text-sm ${inviteMsg.includes("sent") ? "text-green-600" : "text-red-500"}`}>
                  {inviteMsg}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => { setShowInvite(false); setInviteEmail(""); setInviteMsg(""); }}
                className="btn-outline px-4 py-2 text-sm">Cancel</button>
              <button onClick={sendInvite} disabled={inviteSending || !inviteEmail.trim()}
                className="btn-primary px-6 py-2 text-sm">
                {inviteSending ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar sync modal */}
      {calModal && (
        <CalendarSyncModal
          member={calModal}
          onClose={() => setCalModal(null)}
          onRegenerate={async () => {
            if (!window.confirm("Regenerate the calendar link? Any existing subscriptions will stop working.")) return;
            const token = await getToken();
            await fetch(`/api/dashboard/team/${calModal.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ regenerateCalendarToken: true }),
            });
            const res   = await fetch("/api/dashboard/team", { headers: { Authorization: `Bearer ${token}` } });
            const data  = await res.json();
            const updated = (data.members || []).find((m) => m.id === calModal.id);
            setMembers(data.members || []);
            if (updated) setCalModal(updated);
          }}
        />
      )}

      {/* Block detail popover */}
      {blockDetail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setBlockDetail(null)}>
          <div className="bg-white rounded-sm shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="font-semibold text-charcoal text-sm">
                  {blockDetail.member.name} — {DAYS_SHORT[blockDetail.date.getDay()]}, {MONTHS[blockDetail.date.getMonth()]} {blockDetail.date.getDate()}
                </p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: blockDetail.member.color || "#0b2a55" }}>Blocked</p>
              </div>
              <button onClick={() => setBlockDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-3">
              {blockDetail.blocks.map((bl) => {
                const mc = blockDetail.member.color || "#0b2a55";
                return (
                  <div key={bl.id} className="border rounded-lg p-3"
                    style={{ background: hexWithAlpha(mc, 0.06), borderColor: hexWithAlpha(mc, 0.2) }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold" style={{ color: mc }}>{bl.reason || "Blocked"}</p>
                      <button onClick={() => { deleteBlock(bl.id); setBlockDetail(null); }}
                        className="text-xs font-medium" style={{ color: hexWithAlpha(mc, 0.6) }}>Remove</button>
                    </div>
                    {(bl.startTime || bl.endTime) && (
                      <p className="text-xs mt-1" style={{ color: hexWithAlpha(mc, 0.7) }}>
                        {fmt12(bl.startTime) || "All day"}{bl.endTime ? ` – ${fmt12(bl.endTime)}` : " (no end time set)"}
                      </p>
                    )}
                    {!bl.startTime && !bl.endTime && (
                      <p className="text-xs mt-1" style={{ color: hexWithAlpha(mc, 0.55) }}>Full day</p>
                    )}
                    {bl.note && <p className="text-xs mt-1 italic" style={{ color: hexWithAlpha(mc, 0.55) }}>{bl.note}</p>}
                    <p className="text-[10px] mt-1" style={{ color: hexWithAlpha(mc, 0.4) }}>
                      {bl.startDate === bl.endDate ? "Single day" : `${bl.startDate} – ${bl.endDate}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Block Time modal */}
      {showBlockModal && (
        <BlockTimeModal
          members={members}
          onSave={async (data) => {
            const ok = await createBlock(data);
            if (ok) setShowBlockModal(false);
          }}
          onClose={() => setShowBlockModal(false)}
          timeBlocks={timeBlocks}
          onDeleteBlock={deleteBlock}
        />
      )}
    </div>
  );
}
