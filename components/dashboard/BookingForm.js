"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { calculateTenantPrice, getSqftTier, getItemPrice, formatPrice } from "@/lib/catalogUtils";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import { getPlan } from "@/lib/plans";
import { WORKFLOW_STATUSES } from "@/lib/workflowStatus";
import WeatherWidget from "@/components/dashboard/WeatherWidget";

const TIME_SLOTS = [
  { label: "7:00 AM",  value: "07:00" }, { label: "7:30 AM",  value: "07:30" },
  { label: "8:00 AM",  value: "08:00" }, { label: "8:30 AM",  value: "08:30" },
  { label: "9:00 AM",  value: "09:00" }, { label: "9:30 AM",  value: "09:30" },
  { label: "10:00 AM", value: "10:00" }, { label: "10:30 AM", value: "10:30" },
  { label: "11:00 AM", value: "11:00" }, { label: "11:30 AM", value: "11:30" },
  { label: "12:00 PM", value: "12:00" }, { label: "12:30 PM", value: "12:30" },
  { label: "1:00 PM",  value: "13:00" }, { label: "1:30 PM",  value: "13:30" },
  { label: "2:00 PM",  value: "14:00" }, { label: "2:30 PM",  value: "14:30" },
  { label: "3:00 PM",  value: "15:00" }, { label: "3:30 PM",  value: "15:30" },
  { label: "4:00 PM",  value: "16:00" }, { label: "4:30 PM",  value: "16:30" },
  { label: "5:00 PM",  value: "17:00" }, { label: "5:30 PM",  value: "17:30" },
  { label: "6:00 PM",  value: "18:00" }, { label: "6:30 PM",  value: "18:30" },
  { label: "7:00 PM",  value: "19:00" }, { label: "7:30 PM",  value: "19:30" },
];

const DURATION_PRESETS = [
  { label: "30 min", value: 30  },
  { label: "1 hr",   value: 60  },
  { label: "1.5 hr", value: 90  },
  { label: "2 hr",   value: 120 },
  { label: "2.5 hr", value: 150 },
  { label: "3 hr",   value: 180 },
  { label: "4 hr",   value: 240 },
];

const SPECIAL_VALUES = new Set(["golden-hour", "sunset", "twilight"]);

function AutocompleteInput({ value, onChange, onSelect, suggestions, placeholder, type = "text", label, required, className }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = suggestions.filter((s) =>
    s.toLowerCase().includes((value || "").toLowerCase())
  ).slice(0, 8);

  return (
    <div ref={ref} className="relative">
      {label && <label className="label-field">{label}{required && " *"}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        className={className || "input-field w-full"}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((s, i) => (
            <li key={i}
              onMouseDown={(e) => { e.preventDefault(); onSelect(s); setOpen(false); }}
              className="px-3 py-2 text-sm hover:bg-[#3486cf]/5 cursor-pointer text-[#0F172A]">
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// mode: "create" | "edit"
// bookingId: string (required when mode === "edit")
// initialValues: booking object (prefills form in edit mode)
// onSuccess: (bookingId: string) => void (called after save; if omitted, router.push is used)
export default function BookingForm({ mode = "create", bookingId, initialValues, onSuccess }) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const init   = initialValues || {};

  const [form, setForm] = useState({
    clientName:              init.clientName              || "",
    clientEmail:             init.clientEmail             || "",
    clientPhone:             init.clientPhone             || "",
    address:                 init.address                 || "",
    unit:                    init.unit                    || "",
    city:                    init.city                    || "",
    state:                   init.state                   || "CA",
    zip:                     init.zip                     || "",
    lat:                     init.lat                     ?? null,
    lng:                     init.lng                     ?? null,
    sqft:                    init.squareFootage ? String(init.squareFootage) : (init.sqft ? String(init.sqft) : ""),
    notes:                   init.notes                   || "",
    shootDate:               init.shootDate?.split?.("T")?.[0] || "",
    shootTime:               init.shootTime               || "",
    shootDuration:           init.shootDuration           ? String(init.shootDuration) : "",
    additionalAppointments:  init.additionalAppointments  || [],
    packageId:               init.packageId               || "",
    serviceIds:              init.serviceIds              || [],
    addonIds:                init.addonIds                || [],
    customLineItems:         [],
    depositPaid:             init.depositPaid             || false,
    photographerId:          init.photographerId          || "",
    photographerEmail:       init.photographerEmail       || "",
    photographerName:        init.photographerName        || "",
    photographerPhone:       init.photographerPhone       || "",
    photographerTbd:         isEdit ? (!init.photographerId && !init.photographerName) : false,
    additionalPhotographers: init.additionalPhotographers || [],
    sendNotification:        !isEdit,
    workflowStatus:          init.workflowStatus          || (isEdit ? "booked" : "booked"),
  });

  const [catalog,       setCatalog]       = useState({ packages: [], services: [], addons: [], pricingConfig: null });
  const [team,          setTeam]          = useState([]);
  const [timeBlocks,    setTimeBlocks]    = useState([]);
  const [bookings,      setBookings]      = useState([]);
  const [agents,        setAgents]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [tenantPlan,    setTenantPlan]    = useState("solo");
  const [newItem,       setNewItem]       = useState({ label: "", price: "" });
  const [travelInfo,    setTravelInfo]    = useState({});
  const [travelLoading, setTravelLoading] = useState(false);
  const travelTimerRef  = useRef(null);
  const addressTimerRef = useRef(null);
  const [travelFee,         setTravelFee]         = useState(null);
  const [serviceArea,       setServiceArea]       = useState(null);
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);

  const getToken = () => auth.currentUser?.getIdToken();

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const safeFetch = (url) =>
          fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({}));

        const [svc, pkg, adn, teamData, blocks, list, tenantData, agentsData] = await Promise.all([
          safeFetch("/api/dashboard/products?type=services"),
          safeFetch("/api/dashboard/products?type=packages"),
          safeFetch("/api/dashboard/products?type=addons"),
          safeFetch("/api/dashboard/team"),
          safeFetch("/api/dashboard/team/blocks"),
          safeFetch("/api/dashboard/listings"),
          safeFetch("/api/dashboard/tenant"),
          safeFetch("/api/dashboard/agents"),
        ]);
        const tenantDoc = tenantData?.tenant || {};
        setTenantPlan(tenantDoc.subscriptionPlan || "solo");
        setCatalog({
          packages:      pkg.items  || [],
          services:      svc.items  || [],
          addons:        adn.items  || [],
          pricingConfig: tenantDoc.pricingConfig || null,
          bookingConfig: tenantDoc.bookingConfig || null,
          showWeather:   tenantDoc.availability?.showWeather ?? true,
        });
        setTeam(teamData.members || []);
        setTimeBlocks(blocks.blocks || []);
        setBookings((list.listings || []).filter((b) => b.id !== bookingId));
        setAgents(agentsData.agents || []);
      } catch (err) {
        console.error("BookingForm load error:", err);
        setError("Failed to load form data. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pricing = useMemo(() => {
    const sqft = Number(form.sqft) || 0;
    const base = calculateTenantPrice(
      form.packageId || null, form.serviceIds, form.addonIds, 0, catalog, sqft,
    );
    const customTotal = form.customLineItems.reduce((s, i) => s + (Number(i.price) || 0), 0);
    return { ...base, customTotal, total: base.subtotal + customTotal };
  }, [form.packageId, form.serviceIds, form.addonIds, form.sqft, form.customLineItems, catalog]);

  const computedDuration = useMemo(() => {
    if (form.packageId) {
      const pkg = catalog.packages.find((p) => p.id === form.packageId);
      if (!pkg?.includes?.length) return 0;
      return pkg.includes.reduce((sum, svcId) => {
        const svc = catalog.services.find((s) => s.id === svcId);
        return sum + (svc?.duration || 0);
      }, 0);
    }
    return form.serviceIds.reduce((sum, id) => {
      const svc = catalog.services.find((s) => s.id === id);
      return sum + (svc?.duration || 0);
    }, 0);
  }, [form.packageId, form.serviceIds, catalog]);

  const effectiveDuration = form.shootDuration !== "" ? Number(form.shootDuration) : computedDuration;

  const shootEndTime = useMemo(() => {
    if (!form.shootTime || SPECIAL_VALUES.has(form.shootTime) || !effectiveDuration) return null;
    const [h, m] = form.shootTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const totalMin = h * 60 + m + effectiveDuration;
    const endH = Math.floor(totalMin / 60) % 24;
    const endM = totalMin % 60;
    const suffix = endH >= 12 ? "PM" : "AM";
    const h12 = endH % 12 || 12;
    return `${h12}:${String(endM).padStart(2, "0")} ${suffix}`;
  }, [form.shootTime, effectiveDuration]);

  const availability = useMemo(() => {
    if (!form.shootDate) return {};
    const dayStr = form.shootDate;
    const selectedServiceIds = form.packageId ? [form.packageId] : form.serviceIds;
    return team.reduce((acc, m) => {
      const blocked = timeBlocks.some((b) => {
        const startStr = (b.startDate || "").slice(0, 10);
        const endStr   = (b.endDate   || "").slice(0, 10);
        return dayStr >= startStr && dayStr <= endStr && (!b.memberId || b.memberId === m.id);
      });
      const booked = bookings.some((b) => {
        if (!b.shootDate) return false;
        const bDateStr = typeof b.shootDate === "string" ? b.shootDate.slice(0, 10) : null;
        return bDateStr === dayStr &&
          (b.photographerId === m.id || (b.photographerEmail && b.photographerEmail === m.email));
      });
      let cantPerform = false;
      if (selectedServiceIds.length > 0 && m.skills?.length > 0) {
        const skillSet = new Set(m.skills.map(String));
        cantPerform = !selectedServiceIds.every((id) => skillSet.has(String(id)));
      }
      const travelConflict = travelInfo[m.id]?.conflict === true;
      acc[m.id] = blocked ? "blocked"
        : booked && travelConflict ? "travel_conflict"
        : booked ? "booked"
        : cantPerform ? "cant_perform"
        : "available";
      return acc;
    }, {});
  }, [form.shootDate, form.packageId, form.serviceIds, team, timeBlocks, bookings, travelInfo]);

  useEffect(() => {
    if (travelTimerRef.current) clearTimeout(travelTimerRef.current);
    if (!form.shootDate || (!form.lat && !form.address)) { setTravelInfo({}); return; }
    travelTimerRef.current = setTimeout(async () => {
      const dayStr = form.shootDate;
      const conflicts = [];
      for (const member of team) {
        const sameDayBookings = bookings.filter((b) => {
          const bDateStr = typeof b.shootDate === "string" ? b.shootDate.slice(0, 10) : null;
          return bDateStr === dayStr &&
            (b.photographerId === member.id || b.photographerEmail === member.email) &&
            (b.fullAddress || b.address);
        });
        if (sameDayBookings.length === 0) continue;
        for (const existing of sameDayBookings) {
          const existingAddr = existing.fullAddress || existing.address;
          conflicts.push({ memberId: member.id, memberName: member.name, existingBookingId: existing.id, existingAddr, existingTime: existing.shootDate });
        }
      }
      if (conflicts.length === 0) { setTravelInfo({}); return; }
      setTravelLoading(true);
      try {
        const token = await getToken();
        const newAddr = form.lat && form.lng ? { lat: form.lat, lng: form.lng } : form.address;
        const res = await fetch("/api/dashboard/travel-time", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ origins: conflicts.map((c) => c.existingAddr), destinations: [newAddr] }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const newTravelInfo = {};
        conflicts.forEach((c, i) => {
          const el = data.rows?.[i]?.elements?.[0];
          if (!el || el.status !== "OK") return;
          const SHOOT_MIN = effectiveDuration || 120;
          let conflict = false;
          if (form.shootTime && c.existingTime) {
            const existingD = new Date(c.existingTime.length === 10 ? c.existingTime + "T12:00:00" : c.existingTime);
            const newD      = new Date(`${form.shootDate}T${form.shootTime}`);
            const gapMin    = Math.abs(newD - existingD) / 60000;
            conflict = gapMin < SHOOT_MIN + el.durationMinutes;
          }
          const prev = newTravelInfo[c.memberId];
          if (!prev || el.durationMinutes > prev.durationMinutes) {
            newTravelInfo[c.memberId] = { durationMinutes: el.durationMinutes, durationText: el.durationText, distanceText: el.distanceText, fromAddress: c.existingAddr, conflict };
          }
        });
        setTravelInfo(newTravelInfo);
      } catch { /* non-critical */ } finally { setTravelLoading(false); }
    }, 800);
    return () => { if (travelTimerRef.current) clearTimeout(travelTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.shootDate, form.lat, form.lng, form.address, form.shootTime]);

  useEffect(() => {
    if (addressTimerRef.current) clearTimeout(addressTimerRef.current);
    if (!form.address || (!form.lat && !form.lng)) { setTravelFee(null); setServiceArea(null); return; }
    addressTimerRef.current = setTimeout(async () => {
      const token = await getToken();
      const body  = { address: form.address, lat: form.lat, lng: form.lng };
      const [feeRes, areaRes] = await Promise.all([
        fetch("/api/dashboard/travel-fee",         { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }),
        fetch("/api/dashboard/check-service-area", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ address: form.address, lat: form.lat, lng: form.lng }) }),
      ]);
      if (feeRes.ok)  setTravelFee(await feeRes.json());
      if (areaRes.ok) setServiceArea(await areaRes.json());
    }, 600);
    return () => { if (addressTimerRef.current) clearTimeout(addressTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, form.lat, form.lng]);

  function set(key) { return (e) => setForm((f) => ({ ...f, [key]: e.target.value })); }

  function fillClient(agent) {
    setForm((f) => ({
      ...f,
      clientName:  agent.name  || f.clientName,
      clientEmail: agent.email || f.clientEmail,
      clientPhone: agent.phone || f.clientPhone,
    }));
  }

  function toggleService(id) {
    setForm((f) => ({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id] }));
  }
  function toggleAddon(id) {
    setForm((f) => ({ ...f, addonIds: f.addonIds.includes(id) ? f.addonIds.filter((x) => x !== id) : [...f.addonIds, id] }));
  }

  function assignPhotographer(member) {
    setForm((f) => ({
      ...f,
      photographerId:    member.id,
      photographerEmail: member.email || "",
      photographerName:  member.name,
      photographerPhone: member.phone || "",
      photographerTbd:   false,
    }));
  }

  function assignTbd() {
    setForm((f) => ({ ...f, photographerId: "", photographerEmail: "", photographerName: "TBD", photographerPhone: "", photographerTbd: true }));
  }

  function toggleAdditional(member) {
    setForm((f) => {
      const already = f.additionalPhotographers.some((p) => p.id === member.id);
      return {
        ...f,
        additionalPhotographers: already
          ? f.additionalPhotographers.filter((p) => p.id !== member.id)
          : [...f.additionalPhotographers, { id: member.id, name: member.name, email: member.email || "", phone: member.phone || "" }],
      };
    });
  }

  function addCustomItem() {
    if (!newItem.label.trim()) return;
    setForm((f) => ({ ...f, customLineItems: [...f.customLineItems, { label: newItem.label.trim(), price: Number(newItem.price) || 0 }] }));
    setNewItem({ label: "", price: "" });
  }
  function removeCustomItem(i) {
    setForm((f) => ({ ...f, customLineItems: f.customLineItems.filter((_, idx) => idx !== i) }));
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
      let res, data;

      if (isEdit) {
        res = await fetch(`/api/dashboard/bookings/${bookingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            clientName:              form.clientName,
            clientEmail:             form.clientEmail,
            clientPhone:             form.clientPhone,
            address:                 form.address,
            unit:                    form.unit,
            city:                    form.city,
            state:                   form.state,
            zip:                     form.zip,
            fullAddress:             [form.address, form.unit, form.city, form.state, form.zip].filter(Boolean).join(", "),
            squareFootage:           Number(form.sqft) || null,
            notes:                   form.notes,
            shootDate:               form.shootDate,
            shootTime:               form.shootTime,
            shootDuration:           Number(form.shootDuration) || null,
            additionalAppointments:  form.additionalAppointments,
            packageId:               form.packageId,
            serviceIds:              form.serviceIds,
            addonIds:                form.addonIds,
            totalPrice:              pricing.total,
            depositPaid:             form.depositPaid,
            photographerId:          form.photographerId,
            photographerEmail:       form.photographerEmail,
            photographerName:        form.photographerName,
            photographerPhone:       form.photographerPhone,
            additionalPhotographers: form.additionalPhotographers,
            workflowStatus:          form.workflowStatus,
          }),
        });
        data = await res.json();
        if (res.ok) {
          if (onSuccess) onSuccess(bookingId);
          else router.push("/dashboard/bookings");
        } else {
          setError(data.error || "Failed to save changes.");
        }
      } else {
        res = await fetch("/api/dashboard/bookings/create", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...form, totalPrice: pricing.total, sqft: Number(form.sqft) || "" }),
        });
        data = await res.json();
        if (res.ok) {
          if (onSuccess) onSuccess(data.bookingId);
          else router.push(`/dashboard/listings/${data.bookingId}`);
        } else {
          setError(data.error || "Failed to create booking.");
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const agentNameSuggestions  = agents.map((a) => a.name).filter(Boolean);
  const agentEmailSuggestions = agents.map((a) => a.email).filter(Boolean);
  const tier = getSqftTier(form.sqft, catalog.pricingConfig);
  const backHref  = "/dashboard/bookings";
  const backLabel = "← Bookings";
  const pageTitle = isEdit
    ? `Edit Booking${form.address ? ` · ${form.address}` : ""}`
    : "New Booking";

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={backHref} className="text-sm text-gray-400 hover:text-[#3486cf]">{backLabel}</Link>
        <span className="text-gray-300">/</span>
        <h1 className="page-title">{pageTitle}</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── LEFT: Client, Property, Services ─────────────────── */}
          <div className="space-y-4">

            {/* Client / Agent */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Client / Agent Info</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <AutocompleteInput
                  label="Name" required
                  value={form.clientName}
                  onChange={(v) => setForm((f) => ({ ...f, clientName: v }))}
                  onSelect={(name) => {
                    const agent = agents.find((a) => a.name === name);
                    if (agent) fillClient(agent); else setForm((f) => ({ ...f, clientName: name }));
                  }}
                  suggestions={agentNameSuggestions}
                  placeholder="Jane Smith"
                />
                <AutocompleteInput
                  label="Email" type="email" required
                  value={form.clientEmail}
                  onChange={(v) => setForm((f) => ({ ...f, clientEmail: v }))}
                  onSelect={(email) => {
                    const agent = agents.find((a) => a.email === email);
                    if (agent) fillClient(agent); else setForm((f) => ({ ...f, clientEmail: email }));
                  }}
                  suggestions={agentEmailSuggestions}
                  placeholder="jane@example.com"
                />
                <div>
                  <label className="label-field">Phone</label>
                  <input type="tel" value={form.clientPhone} onChange={set("clientPhone")}
                    className="input-field w-full" placeholder="(555) 555-5555" />
                </div>
              </div>
            </div>

            {/* Property */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Property</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <PlacesAutocomplete
                    label="Street Address" required
                    value={form.address}
                    onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                    onSelect={({ address, city, state, zip, lat, lng }) => {
                      setForm((f) => ({
                        ...f,
                        address: address || f.address,
                        city:    city    || f.city,
                        state:   state   || f.state,
                        zip:     zip     || f.zip,
                        lat:     lat     ?? f.lat,
                        lng:     lng     ?? f.lng,
                      }));
                    }}
                    placeholder="Start typing an address…"
                  />
                </div>
                <div>
                  <label className="label-field">Unit / Suite</label>
                  <input type="text" value={form.unit} onChange={set("unit")} className="input-field w-full" placeholder="Apt 4B" />
                </div>
                <div>
                  <label className="label-field">City</label>
                  <input type="text" value={form.city} onChange={set("city")} className="input-field w-full" />
                </div>
                <div>
                  <label className="label-field">State</label>
                  <input type="text" value={form.state} onChange={set("state")} className="input-field w-full" maxLength={2} />
                </div>
                <div>
                  <label className="label-field">ZIP</label>
                  <input type="text" value={form.zip} onChange={set("zip")} className="input-field w-full" maxLength={5} />
                </div>
                <div>
                  <label className="label-field">
                    Square Footage
                    {tier && <span className="text-xs text-[#3486cf] font-normal ml-1">({tier} tier)</span>}
                  </label>
                  <input type="number" value={form.sqft} onChange={set("sqft")} className="input-field w-full" placeholder="2400" />
                </div>
              </div>

              {serviceArea && !serviceArea.covered && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <strong>Outside service area.</strong> This address is outside your configured service zones. You can still {isEdit ? "save" : "create"} the booking manually.
                </div>
              )}
              {serviceArea?.covered && serviceArea.zoneName && (
                <p className="mt-2 text-xs text-green-600">Zone: {serviceArea.zoneName}</p>
              )}
              {travelFee != null && travelFee.miles > 0 && (
                <div className={`mt-3 rounded-lg px-4 py-3 text-sm border ${travelFee.travelFee > 0 ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                  {travelFee.travelFee > 0
                    ? <>Estimated travel fee: <strong>${travelFee.travelFee}</strong> ({travelFee.miles} mi). Add as a custom line item if needed.</>
                    : <>Travel: <strong>{travelFee.miles} mi</strong> — within free radius, no travel fee.</>
                  }
                </div>
              )}
            </div>

            {/* Services */}
            {(catalog.packages.length > 0 || catalog.services.length > 0 || catalog.addons.length > 0) && (
              <div className="card">
                <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Services</h2>

                {catalog.packages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Package</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catalog.packages.filter((p) => p.active !== false).map((p) => {
                        const price = getItemPrice(p, tier);
                        return (
                          <button key={p.id} type="button"
                            onClick={() => setForm((f) => ({ ...f, packageId: f.packageId === p.id ? "" : p.id, serviceIds: [] }))}
                            className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                              form.packageId === p.id ? "border-[#3486cf] bg-[#3486cf]/5 text-[#3486cf]" : "border-gray-200 text-gray-700 hover:border-gray-300"
                            }`}>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-[#3486cf] font-semibold mt-0.5">{formatPrice(price)}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {catalog.services.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Services</p>
                    <div className="flex flex-wrap gap-2">
                      {catalog.services.filter((s) => s.active !== false).map((s) => {
                        const price = getItemPrice(s, tier);
                        return (
                          <button key={s.id} type="button"
                            onClick={() => { toggleService(s.id); setForm((f) => ({ ...f, packageId: "" })); }}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                              form.serviceIds.includes(s.id) ? "border-[#3486cf] bg-[#3486cf] text-white" : "border-gray-200 text-gray-600 hover:border-[#3486cf]/40"
                            }`}>
                            {s.name}{price > 0 ? ` · ${formatPrice(price)}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {catalog.addons.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Add-ons</p>
                    <div className="flex flex-wrap gap-2">
                      {catalog.addons.filter((a) => a.active !== false).map((a) => {
                        const price = getItemPrice(a, tier);
                        return (
                          <button key={a.id} type="button" onClick={() => toggleAddon(a.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                              form.addonIds.includes(a.id) ? "border-gold bg-gold/10 text-[#0F172A]" : "border-gray-200 text-gray-600 hover:border-gold/40"
                            }`}>
                            {a.name}{price > 0 ? ` · ${formatPrice(price)}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Schedule, Pricing, Notes, Status, Submit ── */}
          <div className="space-y-4 lg:sticky lg:top-6">

            {/* Schedule + Team Availability */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Schedule</h2>

              <button type="button" onClick={() => setShowSchedulePopup(true)}
                className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-[#3486cf]/50 hover:bg-gray-50 transition-colors mb-4">
                <div>
                  {form.shootDate ? (
                    <>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(form.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        {form.shootTime && (() => { const [hh, mm] = form.shootTime.split(":"); const h = Number(hh); const sfx = h >= 12 ? "PM" : "AM"; return ` · ${h % 12 || 12}:${mm} ${sfx}`; })()}
                      </p>
                      {shootEndTime && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Ends {shootEndTime}
                          {effectiveDuration > 0 ? ` · ${effectiveDuration >= 60 ? `${effectiveDuration / 60}h` : `${effectiveDuration}m`}` : ""}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">No date selected</p>
                  )}
                </div>
                <span className="text-xs font-medium text-[#3486cf] flex-shrink-0 ml-3">
                  {form.shootDate ? "Edit" : "Pick date →"}
                </span>
              </button>

              {catalog.showWeather && form.shootDate && form.address && (
                <WeatherWidget address={form.address} date={form.shootDate} />
              )}

              {form.additionalAppointments.map((appt, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
                  <div className="absolute top-2 right-2">
                    <button type="button" onClick={() => setForm((f) => ({
                      ...f, additionalAppointments: f.additionalAppointments.filter((_, idx) => idx !== i)
                    }))} className="text-gray-400 hover:text-red-500 text-sm">✕</button>
                  </div>
                  <div>
                    <label className="label-field">Appt {i + 2} Date</label>
                    <input type="date" value={appt.date}
                      onChange={(e) => setForm((f) => { const arr = [...f.additionalAppointments]; arr[i] = { ...arr[i], date: e.target.value }; return { ...f, additionalAppointments: arr }; })}
                      className="input-field w-full" />
                  </div>
                  <div>
                    <label className="label-field">Appt {i + 2} Time</label>
                    <input type="time" value={appt.time}
                      onChange={(e) => setForm((f) => { const arr = [...f.additionalAppointments]; arr[i] = { ...arr[i], time: e.target.value }; return { ...f, additionalAppointments: arr }; })}
                      className="input-field w-full" />
                  </div>
                </div>
              ))}
              <button type="button"
                onClick={() => setForm((f) => ({ ...f, additionalAppointments: [...f.additionalAppointments, { date: "", time: "" }] }))}
                className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-3 py-1.5 rounded hover:bg-[#3486cf]/5 transition-colors mb-4">
                + Add Another Appointment
              </button>

              {/* Solo plan: self-assign only */}
              {getPlan(tenantPlan).teamSeats === 1 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Assign Photographer</p>
                  <div
                    onClick={() => {
                      const isSelf = form.photographerId === "owner";
                      setForm((f) => ({
                        ...f,
                        photographerId:    isSelf ? "" : "owner",
                        photographerEmail: isSelf ? "" : (auth.currentUser?.email || ""),
                        photographerName:  isSelf ? "" : (auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "Me"),
                        photographerPhone: "",
                        photographerTbd:   false,
                      }));
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      form.photographerId === "owner" ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-[#3486cf]/40"
                    }`}>
                    <div className="w-7 h-7 rounded-full bg-[#3486cf] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {(auth.currentUser?.displayName?.[0] || auth.currentUser?.email?.[0] || "Y")?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A]">Assign Myself</p>
                      <p className="text-xs text-gray-400 truncate">{auth.currentUser?.email || "You"}</p>
                    </div>
                    {form.photographerId === "owner" && <span className="text-[#3486cf] text-[11px] font-semibold flex-shrink-0">✓ Primary</span>}
                  </div>
                  <div onClick={assignTbd}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                      form.photographerTbd ? "border-[#3486cf] bg-[#3486cf]/5" : "border-dashed border-gray-300 hover:border-[#3486cf]/40"
                    }`}>
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold flex-shrink-0">?</div>
                    <div className="flex-1"><p className="text-sm font-medium text-gray-500">Assign Later / TBD</p></div>
                    {form.photographerTbd && <span className="text-[#3486cf] text-[11px] font-semibold">✓ Selected</span>}
                  </div>
                  <p className="text-xs text-gray-400 pt-1">
                    Need additional photographers?{" "}
                    <a href="/dashboard/billing" className="text-[#3486cf] hover:underline">Upgrade to Studio →</a>
                  </p>
                </div>
              )}

              {/* Team plan: availability matrix */}
              {getPlan(tenantPlan).teamSeats !== 1 && form.shootDate && team.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Availability — {new Date(form.shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    {travelLoading && <span className="text-xs text-gray-400 italic">Calculating…</span>}
                  </div>
                  <div className="space-y-2">
                    {team.filter((m) => m.active !== false).map((m) => {
                      const avail        = availability[m.id] || "available";
                      const isSelected   = form.photographerId === m.id && !form.photographerTbd;
                      const canSelect    = avail === "available";
                      const travel       = travelInfo[m.id];
                      const isAdditional = form.additionalPhotographers.some((p) => p.id === m.id);
                      return (
                        <div key={m.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all ${
                            isSelected  ? "border-[#3486cf] bg-[#3486cf]/5"
                            : canSelect ? "border-gray-200 hover:border-[#3486cf]/40"
                            : "border-gray-100 bg-gray-50 opacity-60"
                          }`}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                            style={{ background: m.color || "#3486cf" }}>
                            {m.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => canSelect && assignPhotographer(m)}>
                            <p className="text-sm font-medium text-[#0F172A] leading-tight">{m.name}</p>
                            {travel?.conflict && <p className="text-xs text-red-500 mt-0.5">Travel conflict — {travel.durationText} away</p>}
                            {travel && !travel.conflict && avail === "booked" && <p className="text-xs text-blue-500 mt-0.5">Another shoot {travel.distanceText} away</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              avail === "available"       ? "bg-green-50 text-green-700"   :
                              avail === "blocked"         ? "bg-red-50 text-red-600"       :
                              avail === "travel_conflict" ? "bg-red-50 text-red-600"       :
                              avail === "cant_perform"    ? "bg-orange-50 text-orange-600" :
                              "bg-amber-50 text-amber-700"
                            }`}>
                              {avail === "available"       ? "Available"     :
                               avail === "blocked"         ? "Blocked"       :
                               avail === "travel_conflict" ? "Conflict"      :
                               avail === "cant_perform"    ? "Can't perform" :
                               "Booked"}
                            </div>
                            {isSelected
                              ? <span className="text-[#3486cf] text-[11px] font-semibold">✓ Primary</span>
                              : (
                                <button type="button" onClick={() => toggleAdditional(m)}
                                  className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium transition-colors ${
                                    isAdditional
                                      ? "bg-[#3486cf]/10 text-[#3486cf] border-[#3486cf]/20"
                                      : "text-gray-400 border-gray-200 hover:border-[#3486cf]/30 hover:text-[#3486cf]"
                                  }`}>
                                  {isAdditional ? "✓ Co-photo" : "+ Co-photo"}
                                </button>
                              )
                            }
                          </div>
                        </div>
                      );
                    })}
                    <div onClick={assignTbd}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                        form.photographerTbd ? "border-[#3486cf] bg-[#3486cf]/5" : "border-dashed border-gray-300 hover:border-[#3486cf]/40"
                      }`}>
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold flex-shrink-0">?</div>
                      <div className="flex-1"><p className="text-sm font-medium text-gray-500">Assign Later / TBD</p></div>
                      {form.photographerTbd && <span className="text-[#3486cf] text-[11px] font-semibold">✓ Selected</span>}
                    </div>
                  </div>
                  {(form.photographerName || form.additionalPhotographers.length > 0) && (
                    <div className="mt-3 space-y-0.5">
                      {form.photographerName && (
                        <p className="text-xs text-green-600">
                          Primary: <strong>{form.photographerName}</strong>
                          {form.photographerTbd && <span className="text-amber-600"> — assign before shoot</span>}
                        </p>
                      )}
                      {form.additionalPhotographers.map((p) => (
                        <p key={p.id} className="text-xs text-blue-600">Co-photographer: <strong>{p.name}</strong></p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {form.shootDate && team.length === 0 && (
                <p className="text-xs text-gray-400">
                  No team members yet. <Link href="/dashboard/team" className="text-[#3486cf] underline">Add team members →</Link>
                </p>
              )}
            </div>

            {/* Pricing */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Pricing</h2>
              {(form.packageId || form.serviceIds.length > 0 || form.addonIds.length > 0 || form.customLineItems.length > 0) ? (
                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
                  {pricing.base > 0 && (
                    <div className="flex justify-between text-[#0F172A]">
                      <span>{form.packageId ? (catalog.packages.find((p) => p.id === form.packageId)?.name || "Package") : "Services"}</span>
                      <span>{formatPrice(pricing.base)}</span>
                    </div>
                  )}
                  {pricing.addonTotal > 0 && (
                    <div className="flex justify-between text-[#0F172A]">
                      <span>Add-ons</span><span>{formatPrice(pricing.addonTotal)}</span>
                    </div>
                  )}
                  {form.customLineItems.map((item, i) => (
                    <div key={i} className="flex justify-between text-[#0F172A]">
                      <span>{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span>{formatPrice(item.price)}</span>
                        <button type="button" onClick={() => removeCustomItem(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-semibold text-[#0F172A]">
                    <span>Total</span>
                    <span className="text-[#3486cf]">{formatPrice(pricing.total)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-4">Select services to auto-calculate.</p>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Add Custom Item</p>
                <div className="flex gap-2">
                  <input type="text" value={newItem.label} onChange={(e) => setNewItem((n) => ({ ...n, label: e.target.value }))}
                    placeholder="Description" className="input-field flex-1 text-sm" />
                  <input type="number" value={newItem.price} onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))}
                    placeholder="$" className="input-field w-20 text-sm" min="0" step="0.01" />
                  <button type="button" onClick={addCustomItem} className="btn-outline px-3 py-2 text-sm flex-shrink-0">+ Add</button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="checkbox" id="depositPaid" checked={form.depositPaid}
                  onChange={(e) => setForm((f) => ({ ...f, depositPaid: e.target.checked }))} />
                <label htmlFor="depositPaid" className="text-sm text-[#0F172A] cursor-pointer">Deposit already paid</label>
              </div>
            </div>

            {/* Notes */}
            <div className="card">
              <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Notes</h2>
              <textarea value={form.notes} onChange={set("notes")} rows={3}
                placeholder="Special instructions, access notes, lockbox code, etc."
                className="input-field w-full text-sm" />
            </div>

            {/* Workflow status (edit mode only) */}
            {isEdit && (
              <div className="card">
                <h2 className="font-semibold text-[#0F172A] text-sm uppercase tracking-wide mb-3">Workflow Stage</h2>
                <select
                  value={form.workflowStatus}
                  onChange={(e) => setForm((f) => ({ ...f, workflowStatus: e.target.value }))}
                  className="input-field w-full">
                  {WORKFLOW_STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Notifications + Submit */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <input type="checkbox" id="sendNotif" checked={form.sendNotification}
                  onChange={(e) => setForm((f) => ({ ...f, sendNotification: e.target.checked }))} />
                <label htmlFor="sendNotif" className="text-sm text-[#0F172A] cursor-pointer">
                  {isEdit ? "Send update email to client" : "Send booking confirmation to client"}
                </label>
              </div>
              {form.photographerEmail && !form.photographerTbd && (
                <p className="text-xs text-gray-400 mb-4">
                  Photographer notified: <strong>{form.photographerEmail}</strong>
                </p>
              )}
              <button type="submit" disabled={saving} className="btn-primary w-full py-3 text-sm">
                {saving
                  ? (isEdit ? "Saving…" : "Creating…")
                  : isEdit
                    ? "Save Changes"
                    : `Create Booking${pricing.total > 0 ? ` · ${formatPrice(pricing.total)}` : ""}`
                }
              </button>
              <Link href={backHref} className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-3">
                Cancel
              </Link>
            </div>

          </div>
        </div>
      </form>

      {/* ── Schedule popup ─────────────────────────────────── */}
      {showSchedulePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <h3 className="font-semibold text-[#0F172A]">Date &amp; Time</h3>
              <button type="button" onClick={() => setShowSchedulePopup(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-5 py-4 space-y-5">
              <div>
                <label className="label-field">Shoot Date</label>
                <input type="date" value={form.shootDate} onChange={set("shootDate")} className="input-field w-full" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-field">Start Time</label>
                  {form.shootTime && (
                    <span className="text-xs font-semibold text-[#3486cf]">
                      {(() => { const [hh, mm] = form.shootTime.split(":"); const h = Number(hh); const sfx = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${mm} ${sfx}`; })()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 mb-3">
                  {TIME_SLOTS.map((slot) => (
                    <button key={slot.value} type="button"
                      onClick={() => setForm((f) => ({ ...f, shootTime: slot.value }))}
                      className={`py-2 text-[13px] rounded-lg border text-center transition-colors font-medium ${
                        form.shootTime === slot.value
                          ? "border-[#3486cf] bg-[#3486cf]/10 text-[#3486cf]"
                          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}>
                      {slot.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">Custom:</span>
                  <input type="time" value={form.shootTime}
                    onChange={(e) => setForm((f) => ({ ...f, shootTime: e.target.value }))}
                    className="input-field text-sm py-1" style={{ width: "auto" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-field">Duration</label>
                  {computedDuration > 0 && form.shootDuration === "" && (
                    <span className="text-[11px] text-[#3486cf] font-medium">{computedDuration} min from services</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {DURATION_PRESETS.map((d) => {
                    const isSelected = form.shootDuration === String(d.value)
                      || (form.shootDuration === "" && computedDuration === d.value);
                    return (
                      <button key={d.value} type="button"
                        onClick={() => setForm((f) => ({ ...f, shootDuration: f.shootDuration === String(d.value) ? "" : String(d.value) }))}
                        className={`py-1.5 px-3 text-[13px] rounded-lg border transition-colors font-medium ${
                          isSelected
                            ? "border-[#3486cf] bg-[#3486cf]/10 text-[#3486cf]"
                            : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400">Custom (min):</span>
                  <input type="number" min="0" max="720" step="15"
                    value={form.shootDuration} onChange={set("shootDuration")}
                    className="input-field text-sm py-1 w-20" placeholder={computedDuration || "—"} />
                </div>
              </div>
              {shootEndTime && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0">
                    <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/>
                  </svg>
                  <span className="text-xs text-gray-500">Ends at</span>
                  <span className="text-sm font-semibold text-gray-800">{shootEndTime}</span>
                  {effectiveDuration > 0 && (
                    <span className="text-xs text-gray-400 ml-auto">
                      {effectiveDuration >= 60 ? `${effectiveDuration / 60}h` : `${effectiveDuration}m`}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="px-5 pb-5">
              <button type="button" onClick={() => setShowSchedulePopup(false)} className="btn-primary w-full py-2.5 text-sm">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
