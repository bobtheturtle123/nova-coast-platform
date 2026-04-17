"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

const TIME_OPTIONS = [
  { label: "8:00 AM",  val: "08:00" }, { label: "8:30 AM",  val: "08:30" },
  { label: "9:00 AM",  val: "09:00" }, { label: "9:30 AM",  val: "09:30" },
  { label: "10:00 AM", val: "10:00" }, { label: "10:30 AM", val: "10:30" },
  { label: "11:00 AM", val: "11:00" }, { label: "12:00 PM", val: "12:00" },
  { label: "1:00 PM",  val: "13:00" }, { label: "2:00 PM",  val: "14:00" },
  { label: "3:00 PM",  val: "15:00" }, { label: "4:00 PM",  val: "16:00" },
  { label: "5:00 PM",  val: "17:00" },
];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

export default function CreateBookingPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    clientName: "", clientEmail: "", clientPhone: "",
    address: "", unit: "", city: "", state: "CA", zip: "",
    sqft: "", notes: "",
    preferredDate: "", preferredTime: "morning",
    shootDate: "", shootTime: "",
    packageId: "", serviceIds: [], addonIds: [],
    totalPrice: "", depositPaid: false,
    photographerId: "", photographerEmail: "", photographerName: "",
    sendNotification: true,
  });

  const [catalog,      setCatalog]      = useState({ packages: [], services: [], addons: [] });
  const [team,         setTeam]         = useState([]);
  const [timeBlocks,   setTimeBlocks]   = useState([]);
  const [bookings,     setBookings]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  const getToken = () => auth.currentUser?.getIdToken();

  useEffect(() => {
    async function load() {
      const token = await getToken();
      const [svcRes, pkgRes, adnRes, teamRes, blocksRes, listRes, tenantRes] = await Promise.all([
        fetch("/api/dashboard/products?type=services", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=packages", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/products?type=addons",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team",                   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team/blocks",            { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/listings",               { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",                 { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [svc, pkg, adn, teamData, blocks, list] = await Promise.all([
        svcRes.json(), pkgRes.json(), adnRes.json(), teamRes.json(), blocksRes.json(), listRes.json(),
      ]);
      setCatalog({ packages: pkg.items || [], services: svc.items || [], addons: adn.items || [] });
      setTeam(teamData.members || []);
      setTimeBlocks(blocks.blocks || []);
      setBookings(list.listings || []);
      setLoading(false);
    }
    load();
  }, []);

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function toggleService(id) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((x) => x !== id)
        : [...f.serviceIds, id],
    }));
  }

  function toggleAddon(id) {
    setForm((f) => ({
      ...f,
      addonIds: f.addonIds.includes(id)
        ? f.addonIds.filter((x) => x !== id)
        : [...f.addonIds, id],
    }));
  }

  // Compute availability for each team member on the selected shoot date
  const availability = useMemo(() => {
    if (!form.shootDate) return {};
    const d = new Date(form.shootDate + "T12:00:00");
    const dayStr = form.shootDate; // YYYY-MM-DD

    return team.reduce((acc, m) => {
      // Check time blocks
      const blocked = timeBlocks.some((b) => {
        const startStr = (b.startDate || "").slice(0, 10);
        const endStr   = (b.endDate   || "").slice(0, 10);
        return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === m.id);
      });

      // Check existing confirmed bookings on that day
      const booked = bookings.some((b) => {
        if (!b.shootDate) return false;
        const bDay = new Date(b.shootDate);
        return isSameDay(bDay, d) &&
          (b.photographerId === m.id || b.photographerEmail === m.email);
      });

      acc[m.id] = blocked ? "blocked" : booked ? "booked" : "available";
      return acc;
    }, {});
  }, [form.shootDate, team, timeBlocks, bookings]);

  function assignPhotographer(member) {
    setForm((f) => ({
      ...f,
      photographerId:    member.id,
      photographerEmail: member.email,
      photographerName:  member.name,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.clientName || !form.clientEmail || !form.address) {
      setError("Client name, email, and address are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/dashboard/bookings/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          totalPrice: Number(form.totalPrice) || 0,
          sqft:       Number(form.sqft)       || "",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/dashboard/listings/${data.bookingId}`);
      } else {
        setError(data.error || "Failed to create booking.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const allProducts = [...catalog.packages, ...catalog.services, ...catalog.addons];

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/bookings" className="text-sm text-gray-400 hover:text-navy">← Bookings</Link>
        <span className="text-gray-300">/</span>
        <h1 className="font-display text-xl text-navy">New Manual Booking</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Client / Agent Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-charcoal text-sm uppercase tracking-wide mb-4">Client / Agent Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Name *</label>
              <input type="text" value={form.clientName} onChange={set("clientName")} required
                className="input-field w-full" placeholder="Jane Smith" />
            </div>
            <div>
              <label className="label-field">Email *</label>
              <input type="email" value={form.clientEmail} onChange={set("clientEmail")} required
                className="input-field w-full" placeholder="jane@example.com" />
            </div>
            <div>
              <label className="label-field">Phone</label>
              <input type="tel" value={form.clientPhone} onChange={set("clientPhone")}
                className="input-field w-full" placeholder="(555) 555-5555" />
            </div>
          </div>
        </div>

        {/* Property */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-charcoal text-sm uppercase tracking-wide mb-4">Property</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-field">Street Address *</label>
              <input type="text" value={form.address} onChange={set("address")} required
                className="input-field w-full" placeholder="123 Main St" />
            </div>
            <div>
              <label className="label-field">Unit / Suite</label>
              <input type="text" value={form.unit} onChange={set("unit")}
                className="input-field w-full" placeholder="Apt 4B" />
            </div>
            <div>
              <label className="label-field">City</label>
              <input type="text" value={form.city} onChange={set("city")}
                className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">State</label>
              <input type="text" value={form.state} onChange={set("state")}
                className="input-field w-full" maxLength={2} />
            </div>
            <div>
              <label className="label-field">ZIP</label>
              <input type="text" value={form.zip} onChange={set("zip")}
                className="input-field w-full" maxLength={5} />
            </div>
            <div>
              <label className="label-field">Square Footage</label>
              <input type="number" value={form.sqft} onChange={set("sqft")}
                className="input-field w-full" placeholder="2400" />
            </div>
          </div>
        </div>

        {/* Services */}
        {allProducts.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-charcoal text-sm uppercase tracking-wide mb-4">Services</h2>
            {catalog.packages.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Package</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {catalog.packages.map((p) => (
                    <button key={p.id} type="button"
                      onClick={() => setForm((f) => ({ ...f, packageId: f.packageId === p.id ? "" : p.id }))}
                      className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                        form.packageId === p.id
                          ? "border-navy bg-navy/5 text-navy"
                          : "border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}>
                      <p className="font-medium">{p.name}</p>
                      {p.price && <p className="text-xs text-gray-400 mt-0.5">${p.price}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {catalog.services.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Services</p>
                <div className="flex flex-wrap gap-2">
                  {catalog.services.map((s) => (
                    <button key={s.id} type="button" onClick={() => toggleService(s.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                        form.serviceIds.includes(s.id)
                          ? "border-navy bg-navy text-white"
                          : "border-gray-200 text-gray-600 hover:border-navy/40"
                      }`}>
                      {s.name}{s.price ? ` · $${s.price}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {catalog.addons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Add-ons</p>
                <div className="flex flex-wrap gap-2">
                  {catalog.addons.map((a) => (
                    <button key={a.id} type="button" onClick={() => toggleAddon(a.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                        form.addonIds.includes(a.id)
                          ? "border-gold bg-gold/10 text-charcoal"
                          : "border-gray-200 text-gray-600 hover:border-gold/40"
                      }`}>
                      {a.name}{a.price ? ` · $${a.price}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scheduling */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-charcoal text-sm uppercase tracking-wide mb-4">Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="label-field">Confirmed Shoot Date</label>
              <input type="date" value={form.shootDate} onChange={set("shootDate")}
                className="input-field w-full" />
            </div>
            <div>
              <label className="label-field">Shoot Time</label>
              <select value={form.shootTime} onChange={set("shootTime")} className="input-field w-full">
                <option value="">— Select time —</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t.val} value={t.val}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Team availability for selected date */}
          {form.shootDate && team.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Team Availability — {new Date(form.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </p>
              <div className="space-y-2">
                {team.filter((m) => m.active !== false).map((m) => {
                  const avail   = availability[m.id] || "available";
                  const isSelected = form.photographerId === m.id;
                  const canSelect  = avail === "available";

                  return (
                    <div key={m.id}
                      onClick={() => canSelect && assignPhotographer(m)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isSelected
                          ? "border-navy bg-navy/5"
                          : canSelect
                          ? "border-gray-200 hover:border-navy/40 cursor-pointer"
                          : "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                      }`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: m.color || "#0b2a55" }}>
                        {m.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal">{m.name}</p>
                        {m.skills?.length > 0 && (
                          <p className="text-xs text-gray-400 truncate">{m.skills.slice(0, 3).join(", ")}{m.skills.length > 3 ? ` +${m.skills.length - 3}` : ""}</p>
                        )}
                      </div>
                      <div className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${
                        avail === "available" ? "bg-green-50 text-green-700" :
                        avail === "blocked"   ? "bg-red-50 text-red-600"    :
                        "bg-amber-50 text-amber-700"
                      }`}>
                        {avail === "available" ? "Available" : avail === "blocked" ? "Blocked Off" : "Already Booked"}
                      </div>
                      {isSelected && (
                        <span className="text-navy text-xs font-semibold">✓ Assigned</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {form.photographerName && (
                <p className="text-xs text-green-600 mt-2">Assigned to: <strong>{form.photographerName}</strong></p>
              )}
            </div>
          )}

          {team.length === 0 && (
            <p className="text-xs text-gray-400">Add team members to see availability.</p>
          )}
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-charcoal text-sm uppercase tracking-wide mb-4">Pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Total Price ($)</label>
              <input type="number" value={form.totalPrice} onChange={set("totalPrice")} min="0" step="0.01"
                className="input-field w-full" placeholder="0.00" />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" id="depositPaid" checked={form.depositPaid}
                onChange={(e) => setForm((f) => ({ ...f, depositPaid: e.target.checked }))} />
              <label htmlFor="depositPaid" className="text-sm text-charcoal cursor-pointer">Deposit already paid</label>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-charcoal text-sm uppercase tracking-wide mb-4">Notes</h2>
          <textarea value={form.notes} onChange={set("notes")} rows={3}
            placeholder="Special instructions, access notes, etc."
            className="input-field w-full text-sm" />
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-charcoal text-sm uppercase tracking-wide mb-3">Notifications</h2>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="sendNotif" checked={form.sendNotification}
              onChange={(e) => setForm((f) => ({ ...f, sendNotification: e.target.checked }))} />
            <label htmlFor="sendNotif" className="text-sm text-charcoal cursor-pointer">
              Send confirmation email to client
            </label>
          </div>
          {form.photographerEmail && (
            <p className="text-xs text-gray-400 mt-2">
              Photographer notification will be sent to <strong>{form.photographerEmail}</strong>.
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4 pb-8">
          <button type="submit" disabled={saving}
            className="btn-primary px-8 py-3 text-sm">
            {saving ? "Creating booking…" : "Create Booking"}
          </button>
          <Link href="/dashboard/bookings" className="text-sm text-gray-400 hover:text-gray-600">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
