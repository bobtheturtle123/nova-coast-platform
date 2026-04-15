"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

function WeatherWidget({ booking }) {
  const [wx,      setWx]      = useState(null);
  const [loading, setLoading] = useState(false);

  // Use confirmed shootDate, fall back to preferredDate
  const weatherDate = (booking.shootDate || booking.preferredDate)?.split?.("T")?.[0];

  useEffect(() => {
    const address = booking.fullAddress || booking.address;
    const date    = weatherDate;
    if (!address || !date) return;
    setLoading(true);
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch(
        `/api/dashboard/weather?address=${encodeURIComponent(address)}&date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setWx(data);
      setLoading(false);
    });
  }, [booking.fullAddress, booking.address, weatherDate]);

  if (!weatherDate) return null;
  if (loading) return (
    <div className="bg-white rounded-sm border border-gray-200 p-5 mb-6">
      <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Weather Forecast</h3>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-navy rounded-full animate-spin" />
        Loading forecast…
      </div>
    </div>
  );
  if (!wx) return null;

  if (!wx.available) {
    const msg = wx.reason === "too_far"
      ? `Forecast unavailable — shoot is ${wx.daysOut} days out (max 16 days)`
      : wx.reason === "past"
      ? "Shoot date has passed"
      : "Forecast unavailable for this location";
    return (
      <div className="bg-white rounded-sm border border-gray-200 p-5 mb-6">
        <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Weather Forecast</h3>
        <p className="text-sm text-gray-400">{msg}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-sm border border-gray-200 p-5 mb-6">
      <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-3">
        Weather Forecast
        <span className="ml-2 font-normal normal-case text-gray-300">
          {wx.daysOut === 0 ? "Today" : wx.daysOut === 1 ? "Tomorrow" : `${wx.daysOut} days out`}
        </span>
      </h3>
      <div className="flex items-center gap-4 mb-3">
        <span className="text-4xl">{wx.icon}</span>
        <div>
          <p className="text-2xl font-semibold text-charcoal">{wx.temp}°F</p>
          <p className="text-sm text-gray-500">{wx.description} · H:{wx.tempHigh}° L:{wx.tempLow}°</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-50 rounded p-2.5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">UV Index</p>
          <p className={`font-semibold ${wx.uvLabel?.color || "text-charcoal"}`}>{wx.uvIndex}</p>
          <p className={`text-xs ${wx.uvLabel?.color || "text-gray-400"}`}>{wx.uvLabel?.label}</p>
        </div>
        {wx.aqi !== null && (
          <div className="bg-gray-50 rounded p-2.5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Air Quality</p>
            <p className={`font-semibold ${wx.aqiLabel?.color || "text-charcoal"}`}>{wx.aqi}</p>
            <p className={`text-xs ${wx.aqiLabel?.color || "text-gray-400"}`}>{wx.aqiLabel?.label}</p>
          </div>
        )}
        <div className="bg-gray-50 rounded p-2.5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Wind</p>
          <p className="font-semibold text-charcoal">{wx.windSpeed} mph</p>
          {wx.precipitation > 0 && (
            <p className="text-xs text-blue-500">{wx.precipitation}" precip</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id }   = useParams();
  const router   = useRouter();
  const [booking, setBooking]  = useState(null);
  const [loading, setLoading]  = useState(true);
  const [saving,  setSaving]   = useState(false);
  const [msg,     setMsg]      = useState("");
  const [shootDate, setShootDate] = useState("");
  const [showWeather, setShowWeather] = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const [bookingRes, tenantRes] = await Promise.all([
        fetch(`/api/dashboard/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",          { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bookingRes.ok) {
        const data = await bookingRes.json();
        setBooking(data.booking);
        setShootDate(data.booking.shootDate?.split?.("T")?.[0] || "");
      }
      if (tenantRes.ok) {
        const td = await tenantRes.json();
        const av = td.tenant?.bookingConfig?.availability;
        if (av?.showWeather !== undefined) setShowWeather(av.showWeather);
      }
      setLoading(false);
    });
  }, [id]);

  async function update(fields) {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (res.ok) {
        setBooking((b) => ({ ...b, ...fields }));
        setMsg("Saved successfully.");
      } else {
        setMsg(data.error || "Failed to save.");
      }
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function sendConfirmation() {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      await fetch(`/api/dashboard/bookings/${id}/send-confirmation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg("Confirmation email sent.");
    } catch {
      setMsg("Failed to send email.");
    } finally {
      setSaving(false);
    }
  }

  async function sendDepositRequest() {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}/send-deposit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        // Copy link to clipboard
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(data.url);
          setMsg(`Deposit link copied to clipboard! Send it to ${booking.clientEmail || "the client"}.`);
        } else {
          setMsg(`Deposit link: ${data.url}`);
        }
        setBooking((b) => ({ ...b, depositCheckoutUrl: data.url }));
      } else {
        setMsg(data.error || "Failed to create deposit link.");
      }
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function createGallery() {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}/gallery`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setMsg("Gallery created.");
        router.push(`/dashboard/galleries/${data.galleryId}`);
      } else {
        setMsg(data.error || "Failed to create gallery.");
      }
    } catch {
      setMsg("Failed to create gallery.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="p-8 flex justify-center"><div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" /></div>
  );

  if (!booking) return (
    <div className="p-8">
      <p className="text-gray-500">Booking not found.</p>
      <Link href="/dashboard/bookings" className="text-navy text-sm hover:underline mt-2 block">← Back to bookings</Link>
    </div>
  );

  return (
    <div className="p-8 max-w-3xl">
      <Link href="/dashboard/bookings" className="text-sm text-gray-400 hover:text-navy flex items-center gap-1 mb-6">
        ← Back to bookings
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">{booking.clientName}</h1>
          <p className="text-gray-400 text-sm">{booking.fullAddress}</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-medium
          ${booking.status === "confirmed" ? "bg-green-50 text-green-700" :
            booking.status === "requested" ? "bg-amber-50 text-amber-700" :
            booking.status === "completed" ? "bg-blue-50 text-blue-700"  :
            "bg-gray-50 text-gray-600"}`}>
          {booking.status}
        </span>
      </div>

      {msg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-sm mb-4">
          {msg}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Client info */}
        <div className="bg-white rounded-sm border border-gray-200 p-5">
          <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-3">Client</h3>
          <p className="text-sm font-medium">{booking.clientName}</p>
          <p className="text-sm text-gray-500">{booking.clientEmail}</p>
          <p className="text-sm text-gray-500">{booking.clientPhone}</p>
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-sm border border-gray-200 p-5">
          <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-3">Pricing</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold">${booking.totalPrice}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Deposit</span>
              <span className={booking.depositPaid ? "text-green-600" : "text-gray-400"}>
                ${booking.depositAmount} {booking.depositPaid ? "✓" : "(unpaid)"}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Balance</span>
              <span className={booking.balancePaid ? "text-green-600" : "text-gray-400"}>
                ${booking.remainingBalance} {booking.balancePaid ? "✓" : "(pending)"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Weather */}
      {showWeather && <WeatherWidget booking={booking} />}

      {/* Status + shoot date */}
      <div className="bg-white rounded-sm border border-gray-200 p-5 mb-6">
        <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-4">Manage Booking</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">Status</label>
            <select
              value={booking.status}
              onChange={(e) => update({ status: e.target.value })}
              className="input-field w-full">
              <option value="pending_payment">Pending payment</option>
              <option value="requested">Pending review</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">Shoot Date</label>
            <div className="flex gap-2">
              <input type="date" value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                className="input-field flex-1" />
              <button onClick={() => update({ shootDate })} disabled={saving}
                className="btn-outline px-3 py-2 text-xs">Save</button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {/* Deposit request — show when deposit not yet paid */}
        {!booking.depositPaid && (
          <div className="flex flex-col gap-1.5">
            <button onClick={sendDepositRequest} disabled={saving}
              className="btn-primary px-4 py-2 text-sm">
              {saving ? "Generating…" : "📋 Copy Deposit Link"}
            </button>
            {booking.depositCheckoutUrl && (
              <a href={booking.depositCheckoutUrl} target="_blank" rel="noreferrer"
                className="text-xs text-navy/60 hover:text-navy underline text-center">
                View deposit page →
              </a>
            )}
          </div>
        )}
        {booking.depositPaid && booking.status === "requested" && (
          <button onClick={sendConfirmation} disabled={saving}
            className="btn-primary px-4 py-2 text-sm">
            Send Confirmation Email
          </button>
        )}
        {booking.status === "completed" && !booking.galleryId && (
          <button onClick={createGallery} disabled={saving}
            className="btn-gold px-4 py-2 text-sm">
            Create Gallery
          </button>
        )}
        {booking.galleryId && (
          <Link href={`/dashboard/galleries/${booking.galleryId}`}
            className="btn-outline px-4 py-2 text-sm">
            View Gallery →
          </Link>
        )}
      </div>
    </div>
  );
}
