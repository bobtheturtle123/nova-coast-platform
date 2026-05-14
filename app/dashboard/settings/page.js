"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/Toast";
import { getAppUrl } from "@/lib/appUrl";

// ─── Notification definitions (shared with notifications page) ───────────────

const CUSTOMER_NOTIFICATIONS = [
  { id: "order_confirmation",    label: "Order Confirmation",    description: "Sent when a client submits a new booking request.",               channels: ["email", "sms"] },
  { id: "appointment_scheduled", label: "Appointment Scheduled", description: "Sent when a shoot date and time are confirmed.",                   channels: ["email", "sms"] },
  { id: "appointment_reminder",  label: "Appointment Reminder",  description: "Sent 24 hours before an upcoming shoot.",                          channels: ["email", "sms"] },
  { id: "appointment_canceled",  label: "Appointment Canceled",  description: "Sent when a booking is canceled.",                                 channels: ["email", "sms"] },
  { id: "listing_delivered",     label: "Listing Delivered",     description: "Sent when your media is delivered to the agent.",                  channels: ["email", "sms"] },
  { id: "payment_required",      label: "Payment Required",      description: "Sent when a payment (deposit or balance) is due.",                 channels: ["email"] },
];

const TEAM_NOTIFICATIONS = [
  { id: "team_order_received",        label: "New Order Received",    description: "Sent to you when a new booking is submitted.",                     channels: ["email", "sms"] },
  { id: "team_appointment_assigned",  label: "Appointment Assigned",  description: "Sent to a photographer when assigned to a shoot.",                 channels: ["email", "sms"] },
  { id: "team_appointment_reminder",  label: "Team Shoot Reminder",   description: "Sent to the assigned photographer 24 hours before a shoot.",       channels: ["email", "sms"] },
  { id: "team_revision_request",      label: "Revision Request",      description: "Sent to you when an agent submits a revision request on a delivered gallery.", channels: ["email", "sms"] },
];

const SMS_PLANS_LIST = ["studio", "pro", "scale"];

function NotifToggleRow({ notif, pref, plan, onToggle }) {
  const emailOn  = pref?.channels?.email !== false;
  const smsOn    = pref?.channels?.sms   !== false;
  const smsOk    = SMS_PLANS_LIST.includes(plan);
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0 border-gray-100">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F172A]">{notif.label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{notif.description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {notif.channels.includes("email") && (
          <button onClick={() => onToggle("email")}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${emailOn ? "bg-[#3486cf] text-white border-[#3486cf]" : "text-gray-400 border-gray-200 hover:border-gray-300"}`}>
            Email
          </button>
        )}
        {notif.channels.includes("sms") && (
          <button onClick={() => smsOk && onToggle("sms")}
            title={!smsOk ? "SMS is available on Studio plan and above" : undefined}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
              !smsOk ? "opacity-40 cursor-not-allowed text-gray-400 border-gray-200"
              : smsOn ? "bg-emerald-600 text-white border-emerald-600"
              : "text-gray-400 border-gray-200 hover:border-gray-300"
            }`}>
            SMS{!smsOk && <span className="ml-0.5 text-[9px] opacity-70"> Studio+</span>}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Staff Access Section ─────────────────────────────────────────────────────
function StaffAccessSection() {
  const [members,     setMembers]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole,  setInviteRole]  = useState("photographer");
  const [sending,     setSending]     = useState(false);
  const [msg,         setMsg]         = useState("");

  function loadMembers() {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/team", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setMembers(d.members || d.team || []); }
      setLoading(false);
    });
  }

  useEffect(() => { loadMembers(); }, []);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setSending(true); setMsg("");
    const token = await auth.currentUser.getIdToken();
    const res = await fetch("/api/dashboard/team/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.emailFailed ? `Email failed — share: ${data.inviteUrl}` : `Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      loadMembers();
    } else {
      setMsg(data.error || "Failed to send.");
    }
    setSending(false);
    setTimeout(() => setMsg(""), 8000);
  }

  async function removeMember(id) {
    if (!window.confirm("Remove this team member / revoke access?")) return;
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/team/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div id="settings-staff-access" className="card mt-6 scroll-mt-24">
      <h2 className="font-semibold text-[#0F172A] text-base mb-1">Team Members</h2>
      <p className="text-sm text-gray-500 mb-5">
        Invite photographers, assistants, and staff. They appear on the Team page and in the booking scheduler.
        Full profiles (pay rates, skills, hours) can be set on the <a href="/dashboard/team" className="text-[#3486cf] hover:underline">Team page</a>.
      </p>

      {/* Invite form */}
      <div className="flex gap-3 flex-wrap mb-4">
        <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendInvite()}
          className="input-field flex-1 min-w-48" placeholder="colleague@email.com" />
        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="input-field w-40">
          <option value="photographer">Photographer</option>
          <option value="assistant">Assistant</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={sendInvite} disabled={sending || !inviteEmail.trim()} className="btn-primary px-6 py-2 text-sm">
          {sending ? "Sending…" : "Send Invite"}
        </button>
      </div>
      {msg && <p className="text-sm text-green-700 mb-4">{msg}</p>}

      {/* Member list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-4 h-4 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-400">No team members yet. Send an invite above.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
                  style={{ background: m.color || "#3486cf" }}>
                  {(m.name || m.email || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">{m.name || m.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.role} ·{" "}
                    {m.status === "invited"
                      ? <span className="text-amber-500">Invite pending</span>
                      : <span className="text-green-600">Active</span>}
                    {m.email && m.name ? ` · ${m.email}` : ""}
                  </p>
                </div>
              </div>
              <button onClick={() => removeMember(m.id)}
                className="text-xs text-red-400 hover:text-red-600 font-medium ml-4 flex-shrink-0">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SMS Notifications Section ────────────────────────────────────────────────
const SMS_EVENTS = [
  {
    key:   "bookingConfirmed",
    label: "Booking Confirmed",
    desc:  "Sent when a booking is created or payment received",
    roles: ["client", "photographer"],
  },
  {
    key:   "mediaDelivered",
    label: "Media Delivered",
    desc:  "Sent when photos are delivered to the agent/client",
    roles: ["client", "photographer"],
  },
  {
    key:   "shootReminder",
    label: "Shoot Day Reminder",
    desc:  "Sent 24 hours before the scheduled shoot",
    roles: ["client", "photographer"],
    extra: "hoursBeforeShoot",
  },
];

const ROLE_LABELS = { client: "Agent / Client", photographer: "Photographer" };

function SmsSetting({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={onChange}
        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked ? "bg-[#3486cf]" : "bg-gray-200"}`}>
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-gray-600">{label}</span>
    </label>
  );
}

function SmsNotificationsSection() {
  const [prefs,   setPrefs]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState("");
  const [twilio,  setTwilio]  = useState(null); // null=unknown, true/false

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/sms-settings", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPrefs(data.prefs);
      }
    });
    // Check if Twilio is configured by attempting a test (we just check env indirectly via a flag)
    // We'll show a soft warning instead of a real check
    setTwilio(!!process.env.NEXT_PUBLIC_TWILIO_CONFIGURED); // set this env var if Twilio is configured
  }, []);

  function toggle(eventKey, role) {
    setPrefs((p) => ({
      ...p,
      [eventKey]: { ...p[eventKey], [role]: !p[eventKey][role] },
    }));
  }

  function setHours(eventKey, val) {
    setPrefs((p) => ({
      ...p,
      [eventKey]: { ...p[eventKey], hoursBeforeShoot: Math.max(1, Number(val) || 24) },
    }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch("/api/dashboard/sms-settings", {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify(prefs),
      });
      setMsg(res.ok ? "SMS settings saved." : "Failed to save.");
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  if (!prefs) {
    return (
      <div id="settings-sms" className="card mt-6 scroll-mt-24">
        <div className="animate-pulse h-4 bg-gray-100 rounded w-32" />
      </div>
    );
  }

  return (
    <div id="settings-sms" className="card mt-6 scroll-mt-24">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="font-semibold text-[#0F172A] text-base">SMS Notifications</h2>
          <p className="text-sm text-gray-500 mt-0.5">Toggle automated text messages sent to clients and photographers.</p>
        </div>
        <button onClick={save} disabled={saving}
          className="btn-primary text-sm px-4 py-2 flex-shrink-0">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {msg && <p className={`text-xs mt-2 ${msg.includes("saved") ? "text-green-600" : "text-red-500"}`}>{msg}</p>}

      {/* Twilio setup hint */}
      <div className="mt-3 mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <strong>Setup required:</strong> Add <code className="font-mono bg-amber-100 px-1 rounded">TWILIO_ACCOUNT_SID</code>, <code className="font-mono bg-amber-100 px-1 rounded">TWILIO_AUTH_TOKEN</code>, and <code className="font-mono bg-amber-100 px-1 rounded">TWILIO_FROM_NUMBER</code> to your Vercel environment variables to enable SMS. <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="underline font-medium">Get a free Twilio number →</a>
      </div>

      <div className="space-y-5">
        {SMS_EVENTS.map((evt) => (
          <div key={evt.key} className="pb-5 border-b border-gray-100 last:border-0 last:pb-0">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-[#0F172A] text-sm">{evt.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{evt.desc}</p>
              </div>
              {evt.extra === "hoursBeforeShoot" && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
                  <span>Send</span>
                  <input
                    type="number"
                    value={prefs[evt.key]?.hoursBeforeShoot || 24}
                    onChange={(e) => setHours(evt.key, e.target.value)}
                    className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-center text-xs"
                    min="1" max="72"
                  />
                  <span>hrs before</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-5">
              {evt.roles.map((role) => (
                <SmsSetting
                  key={role}
                  label={ROLE_LABELS[role]}
                  checked={!!prefs[evt.key]?.[role]}
                  onChange={() => toggle(evt.key, role)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Custom Domain Section ────────────────────────────────────────────────────
function CustomDomainSection() {
  const [domain,   setDomain]   = useState("");
  const [current,  setCurrent]  = useState(null);   // { domain, verified, addedAt }
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg,      setMsg]      = useState({ text: "", type: "" });

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/custom-domain", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setCurrent(data.customDomain || null);
        if (data.customDomain?.domain) setDomain(data.customDomain.domain);
      }
      setLoading(false);
    });
  }, []);

  async function save() {
    if (!domain.trim()) return;
    setSaving(true);
    setMsg({ text: "", type: "" });
    const token = await auth.currentUser.getIdToken();
    const res = await fetch("/api/dashboard/custom-domain", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ domain: domain.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setCurrent(data.customDomain);
      setMsg({ text: "Domain saved. Follow the DNS instructions below to connect it.", type: "success" });
    } else {
      setMsg({ text: data.error || "Failed to save.", type: "error" });
    }
    setSaving(false);
  }

  async function remove() {
    if (!window.confirm("Remove custom domain?")) return;
    setRemoving(true);
    const token = await auth.currentUser.getIdToken();
    await fetch("/api/dashboard/custom-domain", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setCurrent(null);
    setDomain("");
    setRemoving(false);
    setMsg({ text: "Custom domain removed.", type: "success" });
  }

  const platformHost = process.env.NEXT_PUBLIC_APP_DOMAIN || "novaos.app";

  return (
    <div id="settings-custom-domain" className="card mt-6 scroll-mt-24">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="font-semibold text-[#0F172A] text-base">Custom Domain</h2>
          <p className="text-sm text-gray-500 mt-0.5">Connect your own domain to your property websites.</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200 flex-shrink-0 mt-0.5">
          Add-on Feature
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-6">
        Agents can share branded listing URLs like <span className="font-mono bg-gray-100 px-1 rounded">listings.youragency.com</span> instead of your platform subdomain.
      </p>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Input row */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="listings.yourdomain.com"
              className="input-field flex-1 font-mono text-sm"
            />
            <button onClick={save} disabled={saving || !domain.trim()} className="btn-primary px-6 py-2 text-sm flex-shrink-0">
              {saving ? "Saving…" : current ? "Update" : "Connect Domain"}
            </button>
            {current && (
              <button onClick={remove} disabled={removing}
                className="px-4 py-2 text-sm text-red-500 hover:text-red-700 border border-red-200 rounded-xl transition-colors flex-shrink-0">
                {removing ? "…" : "Remove"}
              </button>
            )}
          </div>

          {msg.text && (
            <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 ${
              msg.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"
            }`}>{msg.text}</div>
          )}

          {/* DNS Instructions */}
          {current && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mt-2">
              <p className="text-sm font-semibold text-[#0F172A] mb-3">
                {current.verified ? "✅ Domain is active" : "⚙️ DNS Setup Required"}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Add the following record to your DNS provider (GoDaddy, Namecheap, Cloudflare, etc.):
              </p>
              <div className="card-section overflow-hidden mb-4">
                <div className="grid grid-cols-3 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-[0.06em]" style={{ background: "var(--bg-subtle)" }}>
                  <span>Type</span><span>Name</span><span>Value</span>
                </div>
                <div className="grid grid-cols-3 px-4 py-3 font-mono text-sm">
                  <span className="text-blue-600 font-semibold">CNAME</span>
                  <span className="text-gray-700">{current.domain.split(".").slice(0, -2).join(".") || "@"}</span>
                  <span className="text-gray-700 break-all">{platformHost}</span>
                </div>
              </div>
              <div className="space-y-2 text-xs text-gray-500">
                <p><span className="font-semibold text-gray-700">1.</span> Log into your DNS provider and navigate to DNS settings for your domain.</p>
                <p><span className="font-semibold text-gray-700">2.</span> Add the CNAME record above. DNS changes can take up to 24 hours to propagate.</p>
                <p><span className="font-semibold text-gray-700">3.</span> If using Vercel hosting, also add the domain in your Vercel project → Settings → Domains.</p>
                <p><span className="font-semibold text-gray-700">4.</span> Once connected, property websites will be accessible at <span className="font-mono bg-gray-100 px-1 rounded">{current.domain}/[bookingId]</span></p>
              </div>
              {current.addedAt && (
                <p className="text-xs text-gray-400 mt-3">Added {new Date(current.addedAt).toLocaleDateString()}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const DEFAULT_TERMS = `⚠️ IMPORTANT NOTICE — PLACEHOLDER ONLY
These default terms are provided for reference and convenience only. They are NOT a legal document, do NOT constitute legal advice, and should NOT be used without review by a qualified attorney. Replace this text with terms drafted or approved by your legal counsel before accepting client bookings.
────────────────────────────────────────────

TERMS OF SERVICE — REAL ESTATE MEDIA SERVICES

Last updated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

1. BOOKING & SCHEDULING
By submitting a booking request, you agree to the terms outlined below. All bookings are subject to availability and confirmed only after receipt of the required deposit or full payment. We reserve the right to decline any booking at our discretion.

2. PAYMENT
A deposit (as indicated at checkout) is required to hold your booking date. The remaining balance is due upon delivery of final media. Failure to pay the remaining balance may result in media being withheld until payment is received in full.

3. CANCELLATIONS & RESCHEDULING
Cancellations made more than 48 hours before the scheduled shoot will receive a full refund of the deposit. Cancellations within 48 hours of the shoot are non-refundable. Rescheduling requests made more than 24 hours in advance will be accommodated at no charge, subject to availability.

4. PROPERTY ACCESS
The client is responsible for ensuring the property is ready and accessible at the scheduled shoot time. This includes: unlocking all doors and rooms, staging and decluttering, ensuring pets are secured, and arranging for adequate lighting. A trip fee may be charged if the photographer arrives and the property is not accessible or shoot-ready.

5. DELIVERY TIMELINE
Standard delivery is within 24–48 hours for photography and 48–72 hours for video, unless otherwise agreed in writing. Rush delivery options are available for an additional fee.

6. LICENSING & USAGE
Upon receipt of full payment, the client receives a non-exclusive, non-transferable license to use the delivered media for real estate marketing purposes, including MLS listings, social media, and print materials. The media may not be resold, sublicensed, or used for purposes other than marketing the specific property without prior written consent.

7. COPYRIGHT
All media remains the copyright of the photographer/company. We reserve the right to use any images for portfolio, marketing, and promotional purposes unless the client requests otherwise in writing at the time of booking.

8. WEATHER & FORCE MAJEURE
In the event of inclement weather that affects the quality of the shoot, we reserve the right to reschedule at no penalty to either party. We are not liable for delays or cancellations caused by circumstances beyond our control.

9. LIMITATION OF LIABILITY
Our liability is limited to the amount paid for the specific service. We are not responsible for indirect, incidental, or consequential damages arising from the use of our services.

10. GOVERNING LAW
These terms shall be governed by the laws of the state in which services are rendered.

By proceeding with a booking, you acknowledge that you have read, understood, and agreed to these Terms of Service.`;

const DEFAULT_PRIVACY = `PRIVACY POLICY

Last updated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}

1. INFORMATION WE COLLECT
We collect the following information when you submit a booking: your name, email address, phone number, and property address. We may also collect billing information processed securely through our payment provider (Stripe).

2. HOW WE USE YOUR INFORMATION
Your information is used solely to process your booking, communicate with you about your shoot, and deliver your media. We do not sell or share your personal information with third parties except as necessary to process payment or deliver services.

3. DATA RETENTION
We retain your booking and contact information for up to 3 years for record-keeping purposes. You may request deletion of your data at any time by contacting us.

4. COOKIES
Our booking platform may use cookies to maintain session state. No personally identifiable information is stored in cookies.

5. THIRD-PARTY SERVICES
We use Stripe for payment processing and Resend for email delivery. These services have their own privacy policies and we encourage you to review them.

6. CONTACT
For privacy-related questions or requests, please contact us directly through your booking confirmation email.`;

const DEFAULT_TIERS = [
  { name: "Small",  label: "Under 2,500 sqft",   max: 2500 },
  { name: "Medium", label: "2,501 – 4,000 sqft", max: 4000 },
  { name: "Large",  label: "4,001 – 6,000 sqft", max: 6000 },
  { name: "XL",     label: "6,000+ sqft",         max: 999999 },
];

export default function SettingsPage() {
  const toast = useToast();
  const [tenant,  setTenant]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  const [openSections, setOpenSections] = useState({
    identity: false,
    pricing:  false,
    booking:  false,
    legal:    false,
    team:     false,
    comms:    false,
    integrations: false,
  });

  const [form, setForm] = useState({
    businessName: "", phone: "", fromZip: "",
    tagline: "", primaryColor: "#3486cf", accentColor: "#c9a96e",
    country: "US", tempUnit: "F",
  });
  const [logoUrl,       setLogoUrl]       = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Pricing config state
  const [pricingMode,     setPricingMode]     = useState("sqft");
  const [tiers,           setTiers]           = useState([]);
  const [customGateLabel, setCustomGateLabel] = useState("Custom value");
  const [savingTiers,     setSavingTiers]     = useState(false);

  // Booking config state
  const [depositType,   setDepositType]   = useState("percent"); // "percent" | "fixed" | "none"
  const [depositValue,  setDepositValue]  = useState(50);
  const [timeSlots,     setTimeSlots]     = useState([
    { value: "morning",   label: "Morning",   desc: "8am – 12pm",     enabled: true },
    { value: "afternoon", label: "Afternoon", desc: "12pm – 5pm",     enabled: true },
    { value: "flexible",  label: "Flexible",  desc: "Any time works", enabled: true },
    { value: "specific",  label: "Specific Time", desc: "Agent enters exact time", enabled: false },
  ]);
  const [customFields,  setCustomFields]  = useState([]); // [{ id, label, type, required }]
  const [enableApn,                setEnableApn]                = useState(false);
  const [requireServiceArea,      setRequireServiceArea]      = useState(false);
  const [autoConvertToListing,    setAutoConvertToListing]    = useState(false);
  const [allowRevisionRequests,   setAllowRevisionRequests]   = useState(false);
  const [requireScheduleApproval, setRequireScheduleApproval] = useState(false);
  const [savingBooking, setSavingBooking] = useState(false);

  // Global job cost rates
  const [costRates,     setCostRates]     = useState({ shooterHourly: 75, editorPerPhoto: 2, travelPerMile: 0.67, otherFlat: 0 });
  const [savingCosts,   setSavingCosts]   = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType,  setNewFieldType]  = useState("text");

  // Travel fee state
  const [travelEnabled,      setTravelEnabled]      = useState(false);
  const [travelMode,         setTravelMode]         = useState("perMile"); // "perMile" | "flat" | "zones"
  const [travelFlatFee,      setTravelFlatFee]      = useState(50);
  const [travelFreeRadius,   setTravelFreeRadius]   = useState(20);
  const [travelRate,         setTravelRate]         = useState(1.5);
  const [travelMaxRadius,    setTravelMaxRadius]    = useState(0);
  const [usePhotographerZip, setUsePhotographerZip] = useState(false);
  const [savingTravel,       setSavingTravel]       = useState(false);

  // Availability state
  const [availMode,        setAvailMode]        = useState("slots"); // "slots" | "real"
  const [availStart,       setAvailStart]       = useState("08:00");
  const [availEnd,         setAvailEnd]         = useState("18:00");
  const [availDays,        setAvailDays]        = useState(["mon","tue","wed","thu","fri"]);
  const [availInterval,    setAvailInterval]    = useState(30);
  const [availDuration,    setAvailDuration]    = useState(120);
  const [availBuffer,      setAvailBuffer]      = useState(30);
  const [availBufferAfter,    setAvailBufferAfter]    = useState(0);
  const [durationAwareSlots,  setDurationAwareSlots]  = useState(true);
  const [savingAvail,               setSavingAvail]               = useState(false);
  const [showWeather,               setShowWeather]               = useState(true);
  const [twilightOffsetMinutes,     setTwilightOffsetMinutes]     = useState(60);
  const [allowAgentPhotographerSel, setAllowAgentPhotographerSel] = useState(false);

  // Booking limits state
  const [minNoticeHours,    setMinNoticeHours]    = useState(24);
  const [maxAdvanceDays,    setMaxAdvanceDays]     = useState(90);
  const [maxBookingsPerDay, setMaxBookingsPerDay]  = useState(0);  // 0 = unlimited
  const [maxWeeklyHours,    setMaxWeeklyHours]     = useState(0);  // 0 = unlimited

  // Cancel / reschedule fee state
  const [cancelFeeEnabled,    setCancelFeeEnabled]    = useState(false);
  const [cancelFeePercent,    setCancelFeePercent]    = useState(50);
  const [cancelFeeWindowHrs,  setCancelFeeWindowHrs]  = useState(48);
  const [rescheduleFeeEnabled,  setRescheduleFeeEnabled]   = useState(false);
  const [rescheduleFeePercent,  setRescheduleFeePercent]   = useState(25);
  const [rescheduleFeeWindowHrs, setRescheduleFeeWindowHrs] = useState(24);

  // Service agreement (contract) state
  const [serviceAgreementEnabled, setServiceAgreementEnabled] = useState(false);
  const [serviceAgreementText,    setServiceAgreementText]    = useState("");
  const [savingAgreement,         setSavingAgreement]         = useState(false);

  // Terms of service state
  const [termsText,    setTermsText]    = useState("");
  const [savingTerms,  setSavingTerms]  = useState(false);

  // Privacy policy state
  const [privacyText,   setPrivacyText]   = useState("");
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Email template state — gallery delivery (existing)
  const [emailTplSubject, setEmailTplSubject] = useState("Your listing media is ready — {{address}}");
  const [emailTplBody,    setEmailTplBody]    = useState("");
  // Email templates — other transactional emails
  const [bookingReceivedSubject, setBookingReceivedSubject] = useState("");
  const [bookingReceivedBody,    setBookingReceivedBody]    = useState("");
  const [bookingApprovedSubject, setBookingApprovedSubject] = useState("");
  const [bookingApprovedBody,    setBookingApprovedBody]    = useState("");
  const [paymentReminderSubject, setPaymentReminderSubject] = useState("");
  const [paymentReminderBody,    setPaymentReminderBody]    = useState("");
  const [savingTemplate,  setSavingTemplate]  = useState(false);
  const [emailTab,        setEmailTab]        = useState("gallery");

  // Gallery settings
  const [viewerTracking,     setViewerTracking]     = useState(true);
  const [savingGalleryPrefs, setSavingGalleryPrefs] = useState(false);

  // Notification prefs (merged from Notifications page)
  const [notifPrefs,    setNotifPrefs]    = useState({});
  const [savingNotifs,  setSavingNotifs]  = useState(false);
  const [editingNotif,  setEditingNotif]  = useState(null);

  // Promo codes state
  const [promoCodes,    setPromoCodes]    = useState([]);
  const [promoForm,     setPromoForm]     = useState({ code: "", type: "flat", value: "", description: "", usageLimit: "", minOrder: "", expiresAt: "", firstTimeOnly: false });
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [savingPromo,   setSavingPromo]   = useState(false);
  const [promoError,    setPromoError]    = useState("");

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/promo-codes", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setPromoCodes(d.codes || []); }
    });
  }, []);

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/tenant", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTenant(data.tenant);
        setForm({
          businessName:  data.tenant.businessName || "",
          phone:         data.tenant.phone || "",
          fromZip:       data.tenant.fromZip || "",
          tagline:       data.tenant.branding?.tagline || "",
          primaryColor:  data.tenant.branding?.primaryColor || "#3486cf",
          accentColor:   data.tenant.branding?.accentColor  || "#c9a96e",
          country:       data.tenant.country  || "US",
          tempUnit:      data.tenant.tempUnit || "F",
        });
        if (data.tenant.branding?.logoUrl) setLogoUrl(data.tenant.branding.logoUrl);
        // Load pricing config — always pre-populate tiers so Pricing Tiers section is ready
        {
          const pc = data.tenant.pricingConfig;
          setPricingMode(pc?.mode || "sqft");
          setTiers(pc?.tiers?.length ? pc.tiers : DEFAULT_TIERS);
          if (pc?.customGateLabel) setCustomGateLabel(pc.customGateLabel);
        }
        // Load booking config
        if (data.tenant.bookingConfig) {
          const bc = data.tenant.bookingConfig;
          if (bc.deposit) {
            setDepositType(bc.deposit.type || "percent");
            setDepositValue(bc.deposit.value ?? 50);
          }
          if (bc.timeSlots?.length) setTimeSlots(bc.timeSlots);
          if (bc.customFields?.length) setCustomFields(bc.customFields);
          if (bc.enableApn !== undefined) setEnableApn(bc.enableApn);
          if (bc.requireServiceArea !== undefined) setRequireServiceArea(bc.requireServiceArea);
          if (bc.autoConvertToListing !== undefined) setAutoConvertToListing(bc.autoConvertToListing);
          if (bc.allowRevisionRequests !== undefined) setAllowRevisionRequests(bc.allowRevisionRequests);
          if (bc.requireScheduleApproval !== undefined) setRequireScheduleApproval(bc.requireScheduleApproval);
          if (bc.serviceAgreement) {
            setServiceAgreementEnabled(bc.serviceAgreement.enabled || false);
            setServiceAgreementText(bc.serviceAgreement.text || "");
          }
          if (bc.terms)   setTermsText(bc.terms);
          if (bc.privacy) setPrivacyText(bc.privacy);
          if (bc.availability) {
            const av = bc.availability;
            if (av.mode)             setAvailMode(av.mode);
            if (av.businessHours?.start) setAvailStart(av.businessHours.start);
            if (av.businessHours?.end)   setAvailEnd(av.businessHours.end);
            if (av.businessHours?.days?.length) setAvailDays(av.businessHours.days);
            if (av.intervalMinutes)  setAvailInterval(av.intervalMinutes);
            if (av.defaultDuration)  setAvailDuration(av.defaultDuration);
            if (av.bufferMinutes)      setAvailBuffer(av.bufferMinutes);
            if (av.bufferAfterMinutes) setAvailBufferAfter(av.bufferAfterMinutes);
            if (av.showWeather !== undefined) setShowWeather(av.showWeather);
            if (av.twilightOffsetMinutes !== undefined) setTwilightOffsetMinutes(av.twilightOffsetMinutes);
            if (av.allowAgentPhotographerSelection !== undefined) setAllowAgentPhotographerSel(av.allowAgentPhotographerSelection);
            if (av.durationAwareSlots !== undefined) setDurationAwareSlots(av.durationAwareSlots);
            if (av.minNoticeHours    != null) setMinNoticeHours(av.minNoticeHours);
            if (av.maxAdvanceDays    != null) setMaxAdvanceDays(av.maxAdvanceDays);
            if (av.maxBookingsPerDay != null) setMaxBookingsPerDay(av.maxBookingsPerDay);
            if (av.maxWeeklyHours    != null) setMaxWeeklyHours(av.maxWeeklyHours);
          }
          if (bc.cancellation) {
            const c = bc.cancellation;
            if (c.feeEnabled    !== undefined) setCancelFeeEnabled(c.feeEnabled);
            if (c.feePercent    != null)       setCancelFeePercent(c.feePercent);
            if (c.feeWindowHrs  != null)       setCancelFeeWindowHrs(c.feeWindowHrs);
            if (c.rescheduleEnabled !== undefined) setRescheduleFeeEnabled(c.rescheduleEnabled);
            if (c.reschedulePercent != null)       setRescheduleFeePercent(c.reschedulePercent);
            if (c.rescheduleWindowHrs != null)     setRescheduleFeeWindowHrs(c.rescheduleWindowHrs);
          }
        }
        if (data.tenant.notificationPrefs) setNotifPrefs(data.tenant.notificationPrefs);
        if (data.tenant.gallerySettings?.viewerTracking !== undefined) {
          setViewerTracking(data.tenant.gallerySettings.viewerTracking);
        }

        if (data.tenant.emailTemplate) {
          if (data.tenant.emailTemplate.subject) setEmailTplSubject(data.tenant.emailTemplate.subject);
          if (data.tenant.emailTemplate.body)    setEmailTplBody(data.tenant.emailTemplate.body);
        }
        if (data.tenant.emailTemplates) {
          const t = data.tenant.emailTemplates;
          if (t.bookingReceived?.subject) setBookingReceivedSubject(t.bookingReceived.subject);
          if (t.bookingReceived?.body)    setBookingReceivedBody(t.bookingReceived.body);
          if (t.bookingApproved?.subject) setBookingApprovedSubject(t.bookingApproved.subject);
          if (t.bookingApproved?.body)    setBookingApprovedBody(t.bookingApproved.body);
          if (t.paymentReminder?.subject) setPaymentReminderSubject(t.paymentReminder.subject);
          if (t.paymentReminder?.body)    setPaymentReminderBody(t.paymentReminder.body);
        }
        // Load cost rates
        if (data.tenant.costRates) {
          setCostRates((prev) => ({ ...prev, ...data.tenant.costRates }));
        }
        // Load travel fee config
        if (data.tenant.travelFeeConfig) {
          const tf = data.tenant.travelFeeConfig;
          if (tf.enabled           !== undefined) setTravelEnabled(tf.enabled);
          if (tf.mode              !== undefined) setTravelMode(tf.mode);
          if (tf.flatFee           !== undefined) setTravelFlatFee(tf.flatFee);
          if (tf.freeRadius        !== undefined) setTravelFreeRadius(tf.freeRadius);
          if (tf.ratePerMile       !== undefined) setTravelRate(tf.ratePerMile);
          if (tf.maxRadius         !== undefined) setTravelMaxRadius(tf.maxRadius);
          if (tf.usePhotographerZip !== undefined) setUsePhotographerZip(tf.usePhotographerZip);
        }
      }
      setLoading(false);
    });
  }, []);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function showMsg(text, type = "success") {
    toast(text, type === "success" ? "success" : "error");
  }

  async function saveBranding(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessName: form.businessName,
          phone:        form.phone,
          fromZip:      form.fromZip,
          country:      form.country,
          tempUnit:     form.tempUnit,
          branding: {
            ...(tenant?.branding || {}),
            businessName: form.businessName,
            tagline:      form.tagline,
            primaryColor: form.primaryColor,
            accentColor:  form.accentColor,
            logoUrl:      logoUrl || null,
          },
        }),
      });
      if (res.ok) showMsg("Settings saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSaving(false);
  }

  async function uploadLogo(file) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: "branding" }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, publicUrl } = await res.json();
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      setLogoUrl(publicUrl);
    } catch { showMsg("Logo upload failed.", "error"); }
    setUploadingLogo(false);
  }

  async function savePricingConfig() {
    setSavingTiers(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pricingConfig: { mode: pricingMode, tiers, ...(pricingMode === "custom" ? { customGateLabel } : {}) },
        }),
      });
      if (res.ok) showMsg("Pricing configuration saved.");
      else showMsg("Failed to save pricing.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingTiers(false);
  }

  function updateTier(i, field, value) {
    setTiers((prev) => prev.map((t, idx) =>
      idx === i ? { ...t, [field]: field === "max" ? Number(value) || 0 : value } : t
    ));
  }

  function addTier() {
    setTiers((prev) => [...prev, { name: `Tier ${prev.length + 1}`, label: "New tier", max: 0 }]);
  }

  function removeTier(i) {
    if (tiers.length <= 2) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function switchPricingMode(mode) {
    setPricingMode(mode);
    if (mode === "photos") {
      setTiers([
        { name: "XS", label: "Under 20 photos", max: 20 },
        { name: "S",  label: "21–40 photos",     max: 40 },
        { name: "M",  label: "41–70 photos",     max: 70 },
        { name: "L",  label: "71–100 photos",    max: 100 },
        { name: "XL", label: "100+ photos",      max: 999999 },
      ]);
    } else if (mode === "sqft") {
      setTiers(DEFAULT_TIERS);
    } else if (mode === "custom") {
      setTiers([
        { name: "Tier1", label: "Level 1", max: 0 },
        { name: "Tier2", label: "Level 2", max: 0 },
        { name: "Tier3", label: "Level 3", max: 999999 },
      ]);
    }
    // flat: no tiers needed
  }

  function resetTiers() {
    switchPricingMode(pricingMode);
  }

  // ─── Booking config helpers ───────────────────────────────────────────────
  function toggleTimeSlot(value) {
    setTimeSlots((prev) => prev.map((s) => s.value === value ? { ...s, enabled: !s.enabled } : s));
  }

  function updateTimeSlot(value, field, val) {
    setTimeSlots((prev) => prev.map((s) => s.value === value ? { ...s, [field]: val } : s));
  }

  function addCustomField() {
    const label = newFieldLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32) + "_" + Date.now().toString(36);
    setCustomFields((prev) => [...prev, { id, label, type: newFieldType, required: false }]);
    setNewFieldLabel(""); setNewFieldType("text");
  }

  function removeCustomField(id) {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  }

  function toggleFieldRequired(id) {
    setCustomFields((prev) => prev.map((f) => f.id === id ? { ...f, required: !f.required } : f));
  }

  function buildBookingConfig() {
    return {
      deposit:      { type: depositType, value: Number(depositValue) || 0 },
      timeSlots,
      customFields,
      enableApn,
      requireServiceArea,
      autoConvertToListing,
      allowRevisionRequests,
      requireScheduleApproval,
      serviceAgreement: { enabled: serviceAgreementEnabled, text: serviceAgreementText },
      terms:        termsText,
      privacy:      privacyText,
      availability: {
        mode:           availMode,
        businessHours:  { start: availStart, end: availEnd, days: availDays },
        intervalMinutes: Number(availInterval) || 30,
        defaultDuration: Number(availDuration) || 120,
        bufferMinutes:      Number(availBuffer)      || 30,
        bufferAfterMinutes: Number(availBufferAfter) || 0,
        showWeather,
        twilightOffsetMinutes: Number(twilightOffsetMinutes) || 60,
        allowAgentPhotographerSelection: allowAgentPhotographerSel,
        minNoticeHours:    Number(minNoticeHours)    || 0,
        maxAdvanceDays:    Number(maxAdvanceDays)    || 0,
        maxBookingsPerDay:  Number(maxBookingsPerDay) || 0,
        maxWeeklyHours:     Number(maxWeeklyHours)    || 0,
        durationAwareSlots,
      },
      cancellation: {
        feeEnabled:           cancelFeeEnabled,
        feePercent:           Number(cancelFeePercent)     || 0,
        feeWindowHrs:         Number(cancelFeeWindowHrs)   || 0,
        rescheduleEnabled:    rescheduleFeeEnabled,
        reschedulePercent:    Number(rescheduleFeePercent)  || 0,
        rescheduleWindowHrs:  Number(rescheduleFeeWindowHrs) || 0,
      },
    };
  }

  async function saveAvailability() {
    setSavingAvail(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingConfig: buildBookingConfig() }),
      });
      if (res.ok) showMsg("Availability settings saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingAvail(false);
  }

  async function saveBookingConfig() {
    setSavingBooking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingConfig: buildBookingConfig() }),
      });
      if (res.ok) showMsg("Booking settings saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingBooking(false);
  }

  async function saveCostRates() {
    setSavingCosts(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ costRates }),
      });
      if (res.ok) showMsg("Cost rates saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingCosts(false);
  }

  async function savePrivacy() {
    setSavingPrivacy(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingConfig: buildBookingConfig() }),
      });
      if (res.ok) showMsg("Privacy policy saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingPrivacy(false);
  }

  async function saveAgreement() {
    setSavingAgreement(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingConfig: buildBookingConfig() }),
      });
      if (res.ok) showMsg("Service agreement saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingAgreement(false);
  }

  async function saveTerms() {
    setSavingTerms(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingConfig: buildBookingConfig() }),
      });
      if (res.ok) showMsg("Terms saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingTerms(false);
  }

  async function saveTravelFee() {
    setSavingTravel(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          travelFeeConfig: {
            enabled:           travelEnabled,
            mode:              travelMode,
            flatFee:           Number(travelFlatFee) || 0,
            freeRadius:        Number(travelFreeRadius) || 20,
            ratePerMile:       Number(travelRate) || 1.5,
            maxRadius:         Number(travelMaxRadius) || 0,
            usePhotographerZip,
          },
        }),
      });
      if (res.ok) showMsg("Travel fee settings saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingTravel(false);
  }

  async function saveGalleryPrefs() {
    setSavingGalleryPrefs(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gallerySettings: { viewerTracking } }),
      });
      if (res.ok) showMsg("Gallery settings saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingGalleryPrefs(false);
  }

  async function saveNotifPrefs() {
    setSavingNotifs(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prefs: notifPrefs }),
      });
      if (res.ok) showMsg("Notification preferences saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingNotifs(false);
  }

  function toggleNotifChannel(id, channel) {
    setNotifPrefs((prev) => {
      const existing = prev[id] || { channels: { email: true, sms: true } };
      return {
        ...prev,
        [id]: {
          ...existing,
          channels: { ...existing.channels, [channel]: !(existing.channels?.[channel] !== false) },
        },
      };
    });
  }

  function saveNotifTemplate(id, data) {
    setNotifPrefs((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { channels: { email: true, sms: true } }), ...data },
    }));
    setEditingNotif(null);
  }

  async function saveEmailTemplate() {
    setSavingTemplate(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          emailTemplate: { subject: emailTplSubject, body: emailTplBody },
          emailTemplates: {
            bookingReceived:  { subject: bookingReceivedSubject, body: bookingReceivedBody },
            bookingApproved:  { subject: bookingApprovedSubject, body: bookingApprovedBody },
            paymentReminder:  { subject: paymentReminderSubject, body: paymentReminderBody },
          },
        }),
      });
      if (res.ok) showMsg("Email templates saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingTemplate(false);
  }

  async function createPromoCode(e) {
    e.preventDefault();
    if (!promoForm.code.trim() || !promoForm.value) return;
    setSavingPromo(true); setPromoError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(promoForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create code");
      setPromoCodes((prev) => [{ id: data.id, ...promoForm, code: promoForm.code.trim().toUpperCase(), usageCount: 0, active: true }, ...prev]);
      setPromoForm({ code: "", type: "flat", value: "", description: "", usageLimit: "", minOrder: "", expiresAt: "", firstTimeOnly: false });
      setShowPromoForm(false);
    } catch (err) { setPromoError(err.message); }
    setSavingPromo(false);
  }

  async function togglePromoCode(promo) {
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/promo-codes/${promo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active: !promo.active }),
    });
    setPromoCodes((prev) => prev.map((p) => p.id === promo.id ? { ...p, active: !p.active } : p));
  }

  async function deletePromoCode(promo) {
    if (!confirm(`Delete code "${promo.code}"? This cannot be undone.`)) return;
    const token = await auth.currentUser.getIdToken();
    await fetch(`/api/dashboard/promo-codes/${promo.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setPromoCodes((prev) => prev.filter((p) => p.id !== promo.id));
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  const APP_URL = getAppUrl();
  const bookingUrl = `${APP_URL}/${tenant?.slug}/book`;

  const modeLabels = {
    sqft:   { unit: "Sq. Ft.", gate: "Square footage" },
    photos: { unit: "Photos",  gate: "Number of photos" },
    custom: { unit: "Value",   gate: "Custom value" },
  };


  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
    <div className="max-w-[1140px] mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="page-title mb-1">Settings</h1>
        <p className="page-subtitle">Configure your business, booking flow, and communications.</p>
      </div>

      <div className="space-y-3">

      {/* ─── BUSINESS INFO & BRANDING ─────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
        <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection("identity")}>
          <div>
            <h2 className="font-semibold text-[#0F172A] text-sm">Business Info & Branding</h2>
            <p className="text-xs text-gray-400 mt-0.5">Business name, colors, tagline, booking URL</p>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${openSections.identity ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {openSections.identity && (
        <div className="pt-2 pb-4">
      {/* Booking URL */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Your Booking Page</p>
        <div className="flex items-center gap-2">
          <code className="text-sm text-[#3486cf] flex-1 truncate">{bookingUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(bookingUrl); showMsg("Copied!"); }}
            className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-2 py-1 rounded hover:bg-[#3486cf]/5">Copy</button>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-2 py-1 rounded hover:bg-[#3486cf]/5">Open</a>
        </div>
      </div>

      {/* Embed Code */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Embed Booking Form</p>
        <p className="text-xs text-gray-400 mb-3">Paste this snippet into any website to embed your booking form directly. The header and navigation chrome are hidden inside the iframe.</p>
        <div className="relative">
          <pre className="text-[11px] bg-white border border-gray-200 rounded p-3 overflow-x-auto text-gray-700 leading-relaxed whitespace-pre-wrap break-all">{`<iframe\n  src="${bookingUrl}?embed=1"\n  width="100%"\n  height="700"\n  style="border:none;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,0.08);"\n  title="Book a Session"\n  allow="payment"\n></iframe>`}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(`<iframe\n  src="${bookingUrl}?embed=1"\n  width="100%"\n  height="700"\n  style="border:none;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,0.08);"\n  title="Book a Session"\n  allow="payment"\n></iframe>`); showMsg("Embed code copied!"); }}
            className="absolute top-2 right-2 text-xs text-[#3486cf] border border-[#3486cf]/20 px-2 py-1 rounded bg-white hover:bg-[#3486cf]/5">
            Copy
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Tip: Add this to your website, bio page, or anywhere clients should be able to book directly.</p>
      </div>

      <form id="settings-branding" onSubmit={saveBranding} className="space-y-6 scroll-mt-24">
        {/* Business info */}
        <div className="card">
          <h2 className="font-semibold text-[#0F172A] text-base mb-4">Business Info</h2>
          <div className="space-y-4">
            <div>
              <label className="label-field">Business Name</label>
              <input type="text" value={form.businessName} onChange={set("businessName")} className="input-field w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Phone</label>
                <input type="tel" value={form.phone} onChange={set("phone")} className="input-field w-full" />
              </div>
              <div>
                <label className="label-field">{form.country === "US" ? "Home ZIP Code" : "Postal Code"}</label>
                <input type="text" value={form.fromZip} onChange={set("fromZip")} maxLength={10} className="input-field w-full" />
              </div>
            </div>

            {/* Regional settings */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
              <div>
                <label className="label-field">Country / Region</label>
                <select value={form.country} onChange={set("country")} className="input-field w-full">
                  <option value="US">🇺🇸 United States</option>
                  <option value="CA">🇨🇦 Canada</option>
                  <option value="AU">🇦🇺 Australia</option>
                  <option value="GB">🇬🇧 United Kingdom</option>
                  <option value="NZ">🇳🇿 New Zealand</option>
                  <option value="IE">🇮🇪 Ireland</option>
                  <option value="ZA">🇿🇦 South Africa</option>
                  <option value="OTHER">🌍 Other</option>
                </select>
              </div>
              <div>
                <label className="label-field">Temperature Units</label>
                <div className="flex gap-2">
                  {[{ v: "F", label: "°F  Fahrenheit" }, { v: "C", label: "°C  Celsius" }].map(({ v, label }) => (
                    <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, tempUnit: v }))}
                      className={`flex-1 py-2 px-3 text-sm border rounded-xl transition-colors ${
                        form.tempUnit === v ? "bg-[#3486cf] text-white border-[#3486cf]" : "border-gray-200 text-gray-600 hover:border-[#3486cf]/30"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="card">
          <h2 className="font-semibold text-[#0F172A] text-base mb-4">Branding</h2>
          <div className="space-y-4">
            {/* Logo */}
            <div>
              <label className="label-field">Business Logo</label>
              <div className="flex items-center gap-4 mt-1">
                {logoUrl ? (
                  <div className="relative w-24 h-16 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                    <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                    <button type="button" onClick={() => setLogoUrl("")}
                      className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors border border-gray-200">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-16 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 21h18" /></svg>
                  </div>
                )}
                <div className="flex-1">
                  <label className={`inline-flex items-center gap-2 text-sm px-3 py-2 border border-gray-200 rounded-xl cursor-pointer hover:border-[#3486cf]/40 transition-colors ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    {uploadingLogo ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                  </label>
                  <p className="text-xs text-gray-400 mt-1.5">PNG or SVG recommended. Shown on invoices sent to clients.</p>
                </div>
              </div>
            </div>
            <div>
              <label className="label-field">Tagline</label>
              <input type="text" value={form.tagline} onChange={set("tagline")} className="input-field w-full"
                placeholder="Professional real estate photography" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Primary Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.primaryColor} onChange={set("primaryColor")}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                  <input type="text" value={form.primaryColor} onChange={set("primaryColor")}
                    className="input-field flex-1 font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="label-field">Accent Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.accentColor} onChange={set("accentColor")}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                  <input type="text" value={form.accentColor} onChange={set("accentColor")}
                    className="input-field flex-1 font-mono text-sm" />
                </div>
              </div>
            </div>
            {/* Preview */}
            <div className="rounded-xl overflow-hidden border border-gray-200 mt-2">
              <div style={{ background: form.primaryColor }} className="px-4 py-3">
                <span style={{ color: form.accentColor }} className="font-display text-sm tracking-widest uppercase">
                  {form.businessName || "Your Business"}
                </span>
              </div>
              <div className="px-4 py-3 bg-white text-xs text-gray-500">{form.tagline || "Your tagline"}</div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary px-8 py-3">
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </form>
        </div>
        )}
      </div>

      {/* ─── PRICING ─────────────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
        <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection("pricing")}>
          <div>
            <h2 className="font-semibold text-[#0F172A] text-sm">Pricing</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pricing mode and tier configuration</p>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${openSections.pricing ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {openSections.pricing && (
        <div className="pt-2 pb-4">
      {/* ─── Pricing Tiers ─────────────────────────────────────────────────────── */}
      <div id="settings-pricing" className="card mt-6 scroll-mt-24">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-[#3486cf] text-base">Pricing Tiers</h2>
          <button onClick={resetTiers} className="text-xs text-gray-400 hover:text-[#3486cf]">Reset to defaults</button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Customize how pricing tiers work. Each product can have a price per tier.
        </p>

        {/* Pricing mode */}
        <div className="mb-5">
          <label className="label-field">Pricing mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "sqft",   label: "By Square Footage", desc: "Client enters sq ft — pricing adjusts by tier" },
              { value: "photos", label: "By Photo Count",    desc: "Client enters # of photos — pricing adjusts by tier" },
              { value: "flat",   label: "Flat Pricing",      desc: "No gate question — every item uses its base price" },
              { value: "custom", label: "Custom Value",      desc: "Define your own tier labels and gate question" },
            ].map((m) => (
              <button key={m.value} type="button" onClick={() => switchPricingMode(m.value)}
                className={`p-3 border rounded-xl text-left transition-colors ${
                  pricingMode === m.value ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-[#3486cf]/30"
                }`}>
                <p className={`text-sm font-semibold ${pricingMode === m.value ? "text-[#3486cf]" : "text-[#0F172A]"}`}>{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Tier table — hidden for flat pricing */}
        {pricingMode === "flat" && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
            Flat pricing is active. Clients will not be asked for square footage — every product uses its base price.
          </p>
        )}
        <div className={`space-y-2 mb-4 ${pricingMode === "flat" ? "opacity-40 pointer-events-none" : ""}`}>
          <div className="grid grid-cols-12 text-xs text-gray-400 uppercase tracking-wide font-medium px-1 mb-1">
            <div className="col-span-3">Tier name</div>
            <div className="col-span-4">Label (shown to client)</div>
            <div className="col-span-2 text-right pr-2">From</div>
            <div className="col-span-2">To</div>
            <div className="col-span-1" />
          </div>
          {tiers.map((tier, i) => {
            const prevMax = i === 0 ? 0 : (tiers[i - 1].max === 999999 ? null : tiers[i - 1].max + 1);
            const isLast  = i === tiers.length - 1;
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-3">
                  <input type="text" value={tier.name} onChange={(e) => updateTier(i, "name", e.target.value)}
                    className="input-field py-2 text-sm font-mono" placeholder="Tier ID" />
                </div>
                <div className="col-span-4">
                  <input type="text" value={tier.label} onChange={(e) => updateTier(i, "label", e.target.value)}
                    className="input-field py-2 text-sm" placeholder="Shown to client" />
                </div>
                {/* "From" — read-only, derived from previous tier */}
                <div className="col-span-2 text-right pr-2">
                  <span className="text-sm text-gray-400 font-mono">
                    {i === 0 ? "0" : prevMax?.toLocaleString()}
                  </span>
                </div>
                {/* "To" — editable max */}
                <div className="col-span-2">
                  {!isLast ? (
                    <input type="number" value={tier.max === 999999 ? "" : tier.max}
                      onChange={(e) => updateTier(i, "max", e.target.value)}
                      className="input-field py-2 text-sm" placeholder="e.g. 800" min="1" />
                  ) : (
                    <span className="text-sm text-gray-400">unlimited</span>
                  )}
                </div>
                <div className="col-span-1 flex justify-center">
                  {tiers.length > 2 && (
                    <button onClick={() => removeTier(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {pricingMode === "custom" && (
          <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
            <label className="label-field">Gate question label</label>
            <p className="text-xs text-gray-400 mb-2">What will clients be asked for at booking? (e.g. "Number of rooms", "Project size")</p>
            <input type="text" value={customGateLabel}
              onChange={(e) => setCustomGateLabel(e.target.value)}
              className="input-field w-full text-sm"
              placeholder="e.g. Number of rooms" />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="button" onClick={addTier}
            className="text-sm text-[#3486cf] border border-[#3486cf]/20 px-3 py-1.5 rounded hover:bg-[#3486cf]/5">
            + Add tier
          </button>
          <p className="text-xs text-gray-400">
            {pricingMode === "flat" ? "With flat pricing, all products use their base price." :
             pricingMode === "custom" ? `Client will be asked: "${customGateLabel}"` :
             `Client will be asked for their ${modeLabels[pricingMode]?.gate?.toLowerCase() || "value"} at booking.`}
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <button onClick={savePricingConfig} disabled={savingTiers} className="btn-primary px-8 py-3">
            {savingTiers ? "Saving…" : "Save Pricing Config"}
          </button>
        </div>
      </div>
        </div>
        )}
      </div>

      {/* ─── BOOKING SETTINGS ────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
        <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection("booking")}>
          <div>
            <h2 className="font-semibold text-[#0F172A] text-sm">Booking Settings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Booking logic, deposits, availability, service areas, travel fees, legal</p>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${openSections.booking ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {openSections.booking && (
        <div className="pt-2 pb-4">
      {/* ─── Booking Config ──────────────────────────────────────────────────── */}
      <div id="settings-booking" className="card mt-8 space-y-8 scroll-mt-24">
        <div>
          <h2 className="font-semibold text-[#0F172A] text-base mb-1">Booking Logic</h2>
          <p className="text-sm text-gray-500">Configure time slots, property options, and custom form fields.</p>
        </div>

        {/* Deposit config */}
        <div id="settings-deposits" className="scroll-mt-24">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Deposits & Payments</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { value: "percent", label: "% of total",  desc: "e.g. 50% deposit" },
              { value: "fixed",   label: "Fixed amount", desc: "e.g. $200 flat deposit" },
              { value: "none",    label: "No deposit",   desc: "Clients pay in full" },
            ].map((m) => (
              <button key={m.value} type="button" onClick={() => setDepositType(m.value)}
                className={`p-3 border rounded-xl text-left transition-colors ${
                  depositType === m.value ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-[#3486cf]/30"
                }`}>
                <p className={`text-sm font-semibold ${depositType === m.value ? "text-[#3486cf]" : "text-[#0F172A]"}`}>{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>

          {depositType !== "none" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {depositType === "percent" ? "Percentage:" : "Amount: $"}
              </span>
              <input
                type="number" value={depositValue}
                onChange={(e) => setDepositValue(e.target.value)}
                min="0" max={depositType === "percent" ? 100 : undefined}
                className="input-field w-28 text-sm"
              />
              {depositType === "percent" && <span className="text-sm text-gray-400">%</span>}
              <span className="text-xs text-gray-400 ml-2">
                {depositType === "percent"
                  ? `On a $1,000 order, deposit = $${Math.round(1000 * (depositValue / 100))}`
                  : `Fixed deposit regardless of order size`}
              </span>
            </div>
          )}
          {depositType === "none" && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Clients will be required to pay the full amount upfront at booking.
            </p>
          )}
        </div>

        {/* Custom form fields */}
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Custom Booking Form Fields</h3>
          <p className="text-xs text-gray-400 mb-3">Add extra fields to the property step of your booking form (e.g. Gate Code, Planned Live Date).</p>

          {customFields.length > 0 && (
            <div className="space-y-2 mb-3">
              {customFields.map((f) => (
                <div key={f.id} className="flex items-center gap-3 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.type}{f.required ? " · required" : " · optional"}</p>
                  </div>
                  <button
                    onClick={() => toggleFieldRequired(f.id)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      f.required ? "bg-[#3486cf]/10 border-[#3486cf]/20 text-[#3486cf]" : "border-gray-200 text-gray-400 hover:border-[#3486cf]/30"
                    }`}
                  >
                    {f.required ? "Required" : "Optional"}
                  </button>
                  <button onClick={() => removeCustomField(f.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input type="text" value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomField()}
              placeholder="Field label (e.g. Gate Code)" className="input-field flex-1 text-sm" />
            <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)} className="input-field text-sm w-32">
              <option value="text">Text</option>
              <option value="date">Date</option>
              <option value="textarea">Long text</option>
            </select>
            <button onClick={addCustomField} disabled={!newFieldLabel.trim()}
              className="btn-primary px-4 py-2 text-sm">Add</button>
          </div>
        </div>

        {/* APN toggle */}
        <div className="pt-4 border-t border-gray-100 mt-2">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setEnableApn((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5 ${enableApn ? "bg-[#3486cf]" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${enableApn ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Enable APN / Land Parcel Field</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Shows an optional APN (Assessor Parcel Number) field on the booking form.
                Useful if you offer land or vacant lot photography.
              </p>
            </div>
          </div>
        </div>

        {/* Service area gate toggle */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setRequireServiceArea((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5 ${requireServiceArea ? "bg-[#3486cf]" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${requireServiceArea ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Require address to be in a service zone</p>
              <p className="text-xs text-gray-400 mt-0.5">
                If enabled, bookings are blocked for addresses outside your defined service areas.
                Clients will see your contact info (phone &amp; email) and be asked to reach out.
                Configure zones in the <a href="/dashboard/service-areas" className="text-[#3486cf] underline">Service Areas</a> page.
              </p>
            </div>
          </div>
        </div>

        {/* Auto-convert to listing toggle */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setAutoConvertToListing((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5 ${autoConvertToListing ? "bg-[#3486cf]" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${autoConvertToListing ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Auto-convert bookings to listing workspaces</p>
              <p className="text-xs text-gray-400 mt-0.5">
                When ON, every new booking automatically becomes a listing workspace (gallery, property site, deliverables).
                When OFF, bookings are plain orders — you manually promote them via "Create Listing Workspace" on the booking page.
              </p>
            </div>
          </div>
        </div>

        {/* Revision Requests toggle */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setAllowRevisionRequests((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5 ${allowRevisionRequests ? "bg-[#3486cf]" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${allowRevisionRequests ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Allow agent revision requests</p>
              <p className="text-xs text-gray-400 mt-0.5">
                When ON, agents can submit revision requests from their portal. Requests appear in your Revisions inbox.
              </p>
            </div>
          </div>
        </div>

        {/* Schedule approval toggle */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setRequireScheduleApproval((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5 ${requireScheduleApproval ? "bg-[#3486cf]" : "bg-gray-200"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${requireScheduleApproval ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Require schedule approval</p>
              <p className="text-xs text-gray-400 mt-0.5">
                When ON, the time an agent selects during booking is a preference, not a confirmed appointment.
                You review and confirm (or propose a new time) from the booking detail page.
                The agent is notified by email once the time is confirmed or changed.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button onClick={saveBookingConfig} disabled={savingBooking} className="btn-primary px-8 py-3">
            {savingBooking ? "Saving…" : "Save Booking Settings"}
          </button>
        </div>
      </div>

      {/* ─── Availability ────────────────────────────────────────────────────── */}
      <div id="settings-availability" className="card mt-6 scroll-mt-24">
        <h2 className="font-semibold text-[#0F172A] text-base mb-1">Availability & Scheduling</h2>
        <p className="text-sm text-gray-500 mb-6">
          Control how time slots are offered to clients on the booking schedule step.
        </p>

        {/* Mode toggle */}
        <div className="mb-5">
          <label className="label-field mb-2">Booking Mode</label>
          <div className="flex gap-2">
            {[
              { value: "slots", label: "Time Grid" },
              { value: "real",  label: "Live Availability" },
              { value: "named", label: "Named Slots" },
            ].map((m) => (
              <button key={m.value} type="button" onClick={() => setAvailMode(m.value)}
                className={`px-4 py-2 border rounded text-sm font-medium transition-colors ${
                  availMode === m.value ? "border-[#3486cf] bg-[#3486cf] text-white" : "border-gray-200 text-gray-600 hover:border-[#3486cf]/40"
                }`}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {availMode === "slots"  && "Fixed intervals within business hours — client picks an exact time."}
            {availMode === "real"   && "Only shows times not already booked, respecting shoot duration and buffer."}
            {availMode === "named"  && "Client picks a named window: Morning, Afternoon, or Flexible."}
          </p>
        </div>

        {/* Business hours — shown for time grid + real availability */}
        <div className={`mb-5 ${availMode === "named" ? "hidden" : ""}`}>
          <div className="mb-3">
            <label className="label-field mb-2">Working Days</label>
            <div className="flex gap-1.5 flex-wrap">
              {[["mon","Mon"],["tue","Tue"],["wed","Wed"],["thu","Thu"],["fri","Fri"],["sat","Sat"],["sun","Sun"]].map(([val, label]) => {
                const active = availDays.includes(val);
                return (
                  <button key={val} type="button"
                    onClick={() => setAvailDays((d) => active ? d.filter((x) => x !== val) : [...d, val])}
                    className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                      active ? "bg-[#3486cf] text-white border-[#3486cf]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                    }`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="label-field">Start time</label>
              <input type="time" value={availStart} onChange={(e) => setAvailStart(e.target.value)}
                className="input-field text-sm" />
            </div>
            <span className="text-gray-400 mt-5">to</span>
            <div>
              <label className="label-field">End time</label>
              <input type="time" value={availEnd} onChange={(e) => setAvailEnd(e.target.value)}
                className="input-field text-sm" />
            </div>
          </div>
        </div>

        {/* Slot interval — shown for time grid + real availability */}
        <div className={`mb-5 ${availMode === "named" ? "hidden" : ""}`}>
          <label className="label-field mb-2">Timing</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-field text-[11px]">Slot interval</label>
              <select value={availInterval} onChange={(e) => setAvailInterval(e.target.value)} className="input-field w-full text-sm">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>
            <div>
              <label className="label-field text-[11px]">Shoot duration</label>
              <input type="number" value={availDuration} min={30} step={15}
                onChange={(e) => setAvailDuration(e.target.value)}
                className="input-field w-full text-sm" />
            </div>
            <div>
              <label className="label-field text-[11px]">Buffer before shoot (min)</label>
              <input type="number" value={availBuffer} min={0} step={15}
                onChange={(e) => setAvailBuffer(e.target.value)}
                className="input-field w-full text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Travel / prep time before each appointment.</p>
            </div>
            <div>
              <label className="label-field text-[11px]">Buffer after shoot (min)</label>
              <input type="number" value={availBufferAfter} min={0} step={15}
                onChange={(e) => setAvailBufferAfter(e.target.value)}
                className="input-field w-full text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Wind-down / editing time after each appointment.</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 border border-gray-100 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Duration-aware slot blocking</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Hide slots where the full service duration can&apos;t fit — e.g. a 1-hour service blocks 9:30 AM if 10:00 AM is busy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDurationAwareSlots((v) => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${durationAwareSlots ? "bg-[#3486cf]" : "bg-gray-200"}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${durationAwareSlots ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Named time slots — only shown when "named" mode is selected */}
        <div className={`mb-5 ${availMode !== "named" ? "hidden" : ""}`}>
          <label className="label-field mb-2">Named Time Slot Options</label>
          <div className="space-y-2">
            {timeSlots.map((slot) => (
              <div key={slot.value} className={`border rounded-xl px-3 py-2.5 flex items-center gap-3 ${slot.enabled ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50 opacity-60"}`}>
                <div
                  onClick={() => toggleTimeSlot(slot.value)}
                  className={`relative w-9 h-5 rounded-full flex-shrink-0 cursor-pointer transition-colors ${slot.enabled ? "bg-[#3486cf]" : "bg-gray-300"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${slot.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input type="text" value={slot.label} disabled={!slot.enabled}
                    onChange={(e) => updateTimeSlot(slot.value, "label", e.target.value)}
                    className="input-field py-1.5 text-sm" placeholder="Label" />
                  <input type="text" value={slot.desc} disabled={!slot.enabled}
                    onChange={(e) => updateTimeSlot(slot.value, "desc", e.target.value)}
                    className="input-field py-1.5 text-sm text-gray-500" placeholder="Description" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weather Widget */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Weather Report</h3>
          <p className="text-xs text-gray-400 mb-3">Show a weather forecast (temp, UV, AQI) on each booking for the shoot date and location. Shown to admin only.</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setShowWeather((v) => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${showWeather ? "bg-[#3486cf]" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${showWeather ? "left-5" : "left-0.5"}`} />
            </button>
            <span className="text-sm text-[#0F172A]">{showWeather ? "Weather widget enabled" : "Weather widget disabled"}</span>
          </label>
        </div>

        {/* Twilight Offset */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Twilight Shoot Offset</h3>
          <p className="text-xs text-gray-400 mb-3">
            When a twilight service is booked, the suggested twilight start time is this many minutes before the real sunset for the property's location.
          </p>
          <div className="flex items-center gap-3">
            <input type="number" value={twilightOffsetMinutes} min={0} max={180} step={5}
              onChange={(e) => setTwilightOffsetMinutes(e.target.value)}
              className="input-field w-24 text-sm" />
            <span className="text-sm text-gray-500">minutes before sunset</span>
          </div>
        </div>

        {/* Booking Limits */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Booking Limits</h3>
          <p className="text-xs text-gray-400 mb-3">Control how far in advance clients can book and how many shoots your team can take on.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field text-[11px]">Minimum notice (hours)</label>
              <input type="number" value={minNoticeHours} min={0} step={1}
                onChange={(e) => setMinNoticeHours(e.target.value)}
                className="input-field w-full text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">How many hours ahead a client must book. 0 = no minimum.</p>
            </div>
            <div>
              <label className="label-field text-[11px]">Max days in advance</label>
              <input type="number" value={maxAdvanceDays} min={0} step={1}
                onChange={(e) => setMaxAdvanceDays(e.target.value)}
                className="input-field w-full text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Furthest date a client can book. 0 = no limit.</p>
            </div>
            <div>
              <label className="label-field text-[11px]">Max bookings per day</label>
              <input type="number" value={maxBookingsPerDay} min={0} step={1}
                onChange={(e) => setMaxBookingsPerDay(e.target.value)}
                className="input-field w-full text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Cap new bookings per day. 0 = unlimited.</p>
            </div>
            <div>
              <label className="label-field text-[11px]">Max team hours per week</label>
              <input type="number" value={maxWeeklyHours} min={0} step={1}
                onChange={(e) => setMaxWeeklyHours(e.target.value)}
                className="input-field w-full text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Weekly capacity limit across all team. 0 = unlimited.</p>
            </div>
          </div>
        </div>

        {/* Cancellation & Reschedule Fees */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Cancellation &amp; Reschedule Fees</h3>
          <p className="text-xs text-gray-400 mb-3">
            Charge a fee when a client cancels or reschedules within a short window before the shoot.
            These settings are for your records — you apply the charge manually from the booking.
          </p>

          {/* Cancel fee */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#0F172A]">Late Cancellation Fee</p>
              <button type="button" onClick={() => setCancelFeeEnabled((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${cancelFeeEnabled ? "bg-[#3486cf]" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${cancelFeeEnabled ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
            {cancelFeeEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field text-[11px]">Fee (%)</label>
                  <input type="number" value={cancelFeePercent} min={0} max={100} step={5}
                    onChange={(e) => setCancelFeePercent(e.target.value)}
                    className="input-field w-full text-sm" />
                </div>
                <div>
                  <label className="label-field text-[11px]">Within (hours of shoot)</label>
                  <input type="number" value={cancelFeeWindowHrs} min={1} step={1}
                    onChange={(e) => setCancelFeeWindowHrs(e.target.value)}
                    className="input-field w-full text-sm" />
                </div>
              </div>
            )}
            {cancelFeeEnabled && (
              <p className="text-[10px] text-gray-400 mt-2">
                e.g. {cancelFeePercent}% of booking total if cancelled within {cancelFeeWindowHrs} hours of the scheduled shoot.
              </p>
            )}
          </div>

          {/* Reschedule fee */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#0F172A]">Late Reschedule Fee</p>
              <button type="button" onClick={() => setRescheduleFeeEnabled((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${rescheduleFeeEnabled ? "bg-[#3486cf]" : "bg-gray-200"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${rescheduleFeeEnabled ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
            {rescheduleFeeEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field text-[11px]">Fee (%)</label>
                  <input type="number" value={rescheduleFeePercent} min={0} max={100} step={5}
                    onChange={(e) => setRescheduleFeePercent(e.target.value)}
                    className="input-field w-full text-sm" />
                </div>
                <div>
                  <label className="label-field text-[11px]">Within (hours of shoot)</label>
                  <input type="number" value={rescheduleFeeWindowHrs} min={1} step={1}
                    onChange={(e) => setRescheduleFeeWindowHrs(e.target.value)}
                    className="input-field w-full text-sm" />
                </div>
              </div>
            )}
            {rescheduleFeeEnabled && (
              <p className="text-[10px] text-gray-400 mt-2">
                e.g. {rescheduleFeePercent}% of booking total if rescheduled within {rescheduleFeeWindowHrs} hours of the scheduled shoot.
              </p>
            )}
          </div>
        </div>

        {/* Agent Photographer Selection */}
        <div className="pt-4 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Agent Photographer Selection</h3>
          <p className="text-xs text-gray-400 mb-3">
            Allow agents to choose their preferred photographer or videographer when booking. Off by default — your team assigns photographers.
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setAllowAgentPhotographerSel((v) => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${allowAgentPhotographerSel ? "bg-[#3486cf]" : "bg-gray-200"}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${allowAgentPhotographerSel ? "left-5" : "left-0.5"}`} />
            </button>
            <span className="text-sm text-[#0F172A]">
              {allowAgentPhotographerSel ? "Agents can select their photographer" : "Team assigns photographer (default)"}
            </span>
          </label>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button onClick={saveAvailability} disabled={savingAvail} className="btn-primary px-8 py-3">
            {savingAvail ? "Saving…" : "Save Availability Settings"}
          </button>
        </div>
      </div>

      {/* ─── Service Areas ──────────────────────────────────────────────────────── */}
      <div id="settings-service-areas" className="card mt-6 scroll-mt-24">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-[#0F172A] text-base">Service Areas & Zones</h2>
            <p className="text-sm text-gray-500 mt-0.5">Draw include/exclude zones on a map, assign photographers to regions.</p>
          </div>
          <a href="/dashboard/service-areas" className="btn-outline text-sm px-4 py-2">
            Manage Service Areas →
          </a>
        </div>
      </div>

      {/* ─── Travel Fees ─────────────────────────────────────────────────────── */}
      <div id="settings-travel" className="card mt-6 scroll-mt-24">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-[#0F172A] text-base">Travel Fees</h2>
          <button
            type="button"
            onClick={() => setTravelEnabled((v) => !v)}
            className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${travelEnabled ? "bg-[#3486cf]" : "bg-gray-200"}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${travelEnabled ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Automatically add a travel fee to bookings based on drive distance from the photographer's home base.
          {!travelEnabled && <span className="text-gray-400"> (Currently disabled — clients won't be charged travel fees.)</span>}
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-xs text-blue-700 leading-relaxed">
          <strong>Home base ZIP:</strong> Currently using <code className="bg-blue-100 px-1 rounded">{form.fromZip || "not set"}</code> (from Business settings).{" "}
          {form.fromZip ? "" : <span className="text-blue-600">Set your ZIP in Business settings first.</span>}
          {" "}Each team member can also have their own home ZIP (set in Team → edit member) so photographers in different cities charge the right travel rate from their location.
        </div>

        {travelEnabled && (
          <div className="space-y-5">
            {/* Mode selection */}
            <div>
              <label className="label-field">Fee Type</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "perMile", label: "Per Mile",        desc: "Rate × distance beyond free radius" },
                  { value: "flat",    label: "Flat Fee",         desc: "Same amount for all bookings" },
                  { value: "zones",   label: "By Service Area",  desc: "Different fee per geographic zone" },
                ].map((m) => (
                  <button key={m.value} type="button" onClick={() => setTravelMode(m.value)}
                    className={`p-2.5 border rounded-xl text-left transition-colors ${
                      travelMode === m.value ? "border-[#3486cf] bg-[#3486cf]/5" : "border-gray-200 hover:border-[#3486cf]/30"
                    }`}>
                    <p className={`text-xs font-semibold ${travelMode === m.value ? "text-[#3486cf]" : "text-[#0F172A]"}`}>{m.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Flat fee config */}
            {travelMode === "flat" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Flat travel fee</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0" step="1" value={travelFlatFee}
                      onChange={(e) => setTravelFlatFee(e.target.value)}
                      className="input-field w-full pl-6" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Added to every booking</p>
                </div>
                <div>
                  <label className="label-field">Max service radius (miles)</label>
                  <input type="number" min="0" max="500" value={travelMaxRadius}
                    onChange={(e) => setTravelMaxRadius(e.target.value)} className="input-field w-full" />
                  <p className="text-xs text-gray-400 mt-1">0 = no limit</p>
                </div>
              </div>
            )}

            {/* Per-mile config */}
            {travelMode === "perMile" && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label-field">Free radius (miles)</label>
                    <input type="number" min="0" max="200" value={travelFreeRadius}
                      onChange={(e) => setTravelFreeRadius(e.target.value)} className="input-field w-full" />
                    <p className="text-xs text-gray-400 mt-1">No charge within this distance</p>
                  </div>
                  <div>
                    <label className="label-field">Rate per mile</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" min="0" step="0.25" value={travelRate}
                        onChange={(e) => setTravelRate(e.target.value)} className="input-field w-full pl-6" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Per mile beyond free radius</p>
                  </div>
                  <div>
                    <label className="label-field">Max service radius (miles)</label>
                    <input type="number" min="0" max="500" value={travelMaxRadius}
                      onChange={(e) => setTravelMaxRadius(e.target.value)} className="input-field w-full" />
                    <p className="text-xs text-gray-400 mt-1">0 = no limit</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-sm">
                  <p className="font-medium text-[#0F172A] mb-2">Example</p>
                  <div className="space-y-1 text-gray-500 text-xs">
                    <div className="flex justify-between">
                      <span>Within {travelFreeRadius} miles</span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{Number(travelFreeRadius) + 10} miles away</span>
                      <span className="font-medium">${(10 * Number(travelRate)).toFixed(0)} fee</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{Number(travelFreeRadius) + 30} miles away</span>
                      <span className="font-medium">${(30 * Number(travelRate)).toFixed(0)} fee</span>
                    </div>
                    {Number(travelMaxRadius) > 0 && (
                      <div className="flex justify-between text-gray-400">
                        <span>Beyond {travelMaxRadius} miles</span>
                        <span className="font-medium">Outside service area</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Zones config */}
            {travelMode === "zones" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                <p className="font-medium text-amber-800 mb-1">Zone-based pricing</p>
                <p className="text-amber-700 text-xs">Draw service zones in <a href="/dashboard/service-areas" className="underline">Service Areas</a> and assign a travel fee to each zone. Fees will be applied automatically based on the property address.</p>
              </div>
            )}

            {/* Per-photographer ZIP toggle */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#0F172A]">Calculate from photographer's home ZIP</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    When on, travel fees use each photographer's individual home ZIP instead of the business ZIP. Requires setting a home ZIP on each team member.
                  </p>
                </div>
                <button type="button" onClick={() => setUsePhotographerZip((v) => !v)}
                  className={`relative w-10 h-6 rounded-full flex-shrink-0 ml-4 transition-colors ${usePhotographerZip ? "bg-[#3486cf]" : "bg-gray-200"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${usePhotographerZip ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
              {usePhotographerZip && (
                <p className="text-xs text-[#3486cf]/70 mt-2 bg-[#3486cf]/5 rounded px-3 py-2">
                  A photographer in LA shooting in LA, and one in San Diego shooting in San Diego, will each be charged travel from their own home ZIP — not yours. Set home ZIPs under Team → edit member.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-gray-100">
          <button onClick={saveTravelFee} disabled={savingTravel} className="btn-primary px-8 py-3">
            {savingTravel ? "Saving…" : "Save Travel Fee Settings"}
          </button>
        </div>
      </div>

      {/* ─── Promo Codes ─────────────────────────────────────────────────────── */}
      <div id="settings-promos" className="card mt-6 scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-[#0F172A] text-base">Promo Codes</h2>
            <p className="text-sm text-gray-500 mt-0.5">Create discount codes customers can apply at checkout.</p>
          </div>
          <button onClick={() => { setShowPromoForm((v) => !v); setPromoError(""); }}
            className="btn-primary text-sm px-4 py-2">
            {showPromoForm ? "Cancel" : "+ New Code"}
          </button>
        </div>

        {showPromoForm && (
          <form onSubmit={createPromoCode} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3 border border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Code</label>
                <input type="text" value={promoForm.code}
                  onChange={(e) => setPromoForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="input-field w-full font-mono" placeholder="SUMMER20" required />
              </div>
              <div>
                <label className="label-field">Description (optional)</label>
                <input type="text" value={promoForm.description}
                  onChange={(e) => setPromoForm((f) => ({ ...f, description: e.target.value }))}
                  className="input-field w-full" placeholder="Summer promo" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Discount Type</label>
                <select value={promoForm.type}
                  onChange={(e) => setPromoForm((f) => ({ ...f, type: e.target.value }))}
                  className="input-field w-full">
                  <option value="flat">Flat amount ($ off)</option>
                  <option value="percent">Percentage (% off)</option>
                </select>
              </div>
              <div>
                <label className="label-field">{promoForm.type === "flat" ? "Amount ($)" : "Percent (%)"}</label>
                <input type="number" value={promoForm.value}
                  onChange={(e) => setPromoForm((f) => ({ ...f, value: e.target.value }))}
                  className="input-field w-full" placeholder={promoForm.type === "flat" ? "50" : "20"}
                  min="0.01" max={promoForm.type === "percent" ? "100" : undefined} step="0.01" required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label-field">Expiry Date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="date" value={promoForm.expiresAt}
                  onChange={(e) => setPromoForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="input-field w-full text-sm" min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <label className="label-field">Min. Order <span className="text-gray-400 font-normal">($ optional)</span></label>
                <input type="number" value={promoForm.minOrder}
                  onChange={(e) => setPromoForm((f) => ({ ...f, minOrder: e.target.value }))}
                  className="input-field w-full text-sm" placeholder="0" min="0" step="1" />
              </div>
              <div>
                <label className="label-field">Max Uses <span className="text-gray-400 font-normal">(0 = unlimited)</span></label>
                <input type="number" value={promoForm.usageLimit}
                  onChange={(e) => setPromoForm((f) => ({ ...f, usageLimit: e.target.value }))}
                  className="input-field w-full text-sm" placeholder="0" min="0" step="1" />
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
              <input type="checkbox"
                checked={!!promoForm.firstTimeOnly}
                onChange={(e) => setPromoForm((f) => ({ ...f, firstTimeOnly: e.target.checked }))}
                className="w-4 h-4 accent-[#3486cf]" />
              <span className="text-sm text-gray-700">
                First-time clients only
                <span className="text-xs text-gray-400 ml-1">(validates at checkout)</span>
              </span>
            </label>
            {promoError && <p className="text-xs text-red-500">{promoError}</p>}
            <button type="submit" disabled={savingPromo} className="btn-primary px-6 py-2 text-sm">
              {savingPromo ? "Creating…" : "Create Code"}
            </button>
          </form>
        )}

        {promoCodes.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
            No promo codes yet. Create one above.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {promoCodes.map((p) => (
              <div key={p.id} className={`flex items-center justify-between px-4 py-3 gap-4 ${p.active ? "bg-white" : "bg-gray-50"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`font-mono text-sm font-semibold px-2.5 py-1 rounded ${p.active ? "bg-[#3486cf]/8 text-[#3486cf]" : "bg-gray-200 text-gray-400 line-through"}`}>
                    {p.code}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-[#0F172A] font-medium flex items-center gap-1.5 flex-wrap">
                      {p.type === "flat" ? `$${p.value} off` : `${p.value}% off`}
                      {p.firstTimeOnly && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-semibold">1st visit</span>
                      )}
                    </p>
                    {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400 hidden sm:block">{p.usageCount || 0} uses</span>
                  <button onClick={() => togglePromoCode(p)} title={p.active ? "Disable" : "Enable"}
                    className={`relative w-8 h-4 rounded-full transition-colors ${p.active ? "bg-[#3486cf]" : "bg-gray-200"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${p.active ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <button onClick={() => deletePromoCode(p)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Legal (within Booking Settings) ─────────────────────────────── */}
      {/* ─── Service Agreement ───────────────────────────────────────────────── */}
      <div id="settings-agreement" className="card mt-6 scroll-mt-24">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="font-semibold text-[#0F172A] text-base">Service Agreement</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Require clients to read and electronically sign a service agreement before completing a booking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setServiceAgreementEnabled((v) => !v)}
            className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ml-4 ${serviceAgreementEnabled ? "bg-[#3486cf]" : "bg-gray-200"}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${serviceAgreementEnabled ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>

        {!serviceAgreementEnabled && (
          <p className="text-xs text-gray-400 mb-4">Toggle on to require clients to sign a contract during checkout.</p>
        )}

        {serviceAgreementEnabled && (
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-2 text-xs bg-blue-50 border border-blue-100 text-blue-800 px-3 py-2.5 rounded">
              <span>ℹ️</span>
              <span>
                When enabled, clients must read the agreement, type their full legal name, and click "I agree and electronically sign" to complete booking.
                The signed agreement text, client name, timestamp, and IP address are recorded on the booking. Your counter-signature is applied automatically.
                Electronic consent collected this way is generally enforceable — have your attorney review the agreement text to ensure it covers your jurisdiction's requirements.
              </span>
            </div>
            <label className="label-field">Agreement Text</label>
            <textarea
              value={serviceAgreementText}
              onChange={(e) => setServiceAgreementText(e.target.value)}
              rows={16}
              placeholder={`REAL ESTATE MEDIA SERVICES AGREEMENT\n\nThis agreement is entered into between [Your Business Name] ("Photographer") and the client ("Client") as identified at the time of booking.\n\n1. SCOPE OF SERVICES\n...\n\n2. PAYMENT TERMS\n...\n\nBy clicking "I agree" below, Client acknowledges they have read and agree to the terms of this agreement.`}
              className="input-field w-full text-sm font-mono leading-relaxed resize-y"
            />
            <p className="text-xs text-gray-400">
              Clients will see this text in full, must scroll through it, and type their name to confirm before payment is processed.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-4">
          <button onClick={saveAgreement} disabled={savingAgreement} className="btn-primary px-8 py-3">
            {savingAgreement ? "Saving…" : "Save Agreement Settings"}
          </button>
        </div>
      </div>

      {/* ─── Terms of Service ─────────────────────────────────────────────────── */}
      <div id="settings-terms" className="card mt-6 scroll-mt-24">
        <h2 className="font-semibold text-[#0F172A] text-base mb-1">Terms of Service</h2>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            Clients must agree to these terms before completing a booking. Leave blank to disable the checkbox.
            Shown at <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/{tenant?.slug}/terms</code>.
          </p>
        </div>
        {!termsText && (
          <div className="mb-3 space-y-2">
            <div className="flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <span>The default template is a <strong>placeholder only</strong> — not a legal document. Have an attorney review before use. You are responsible for your own terms.</span>
            </div>
            <button type="button" onClick={() => setTermsText(DEFAULT_TERMS)}
              className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-3 py-1.5 rounded hover:bg-[#3486cf]/5 transition-colors">
              Load default template (review before publishing)
            </button>
          </div>
        )}
        <textarea
          value={termsText}
          onChange={(e) => setTermsText(e.target.value)}
          rows={18}
          placeholder="Paste your Terms of Service here…"
          className="input-field w-full text-sm font-mono leading-relaxed resize-y"
        />
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <button onClick={saveTerms} disabled={savingTerms} className="btn-primary px-8 py-3">
            {savingTerms ? "Saving…" : "Save Terms"}
          </button>
          {termsText && (
            <button type="button" onClick={() => setTermsText("")}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Clear
            </button>
          )}
          {tenant?.slug && (
            <a href={`/${tenant.slug}/terms`} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#3486cf] underline underline-offset-2 hover:opacity-70">
              Preview public terms page →
            </a>
          )}
        </div>
      </div>
      {/* ─── Privacy Policy ──────────────────────────────────────────────────── */}
      <div className="card mt-6">
        <h2 className="font-semibold text-[#0F172A] text-base mb-1">Privacy Policy</h2>
        <p className="text-sm text-gray-500 mb-4">
          Shown at <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/{tenant?.slug}/privacy</code>.
          Linked from the checkout terms checkbox. Leave blank to disable.
        </p>
        {!privacyText && (
          <div className="mb-3">
            <button type="button" onClick={() => setPrivacyText(DEFAULT_PRIVACY)}
              className="text-xs text-[#3486cf] border border-[#3486cf]/20 px-3 py-1.5 rounded hover:bg-[#3486cf]/5 transition-colors">
              Use default template
            </button>
          </div>
        )}
        <textarea
          value={privacyText}
          onChange={(e) => setPrivacyText(e.target.value)}
          rows={14}
          placeholder="Paste your Privacy Policy here…"
          className="input-field w-full text-sm font-mono leading-relaxed resize-y"
        />
        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <button onClick={savePrivacy} disabled={savingPrivacy} className="btn-primary px-8 py-3">
            {savingPrivacy ? "Saving…" : "Save Privacy Policy"}
          </button>
          {privacyText && (
            <button type="button" onClick={() => setPrivacyText("")}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Clear
            </button>
          )}
          {tenant?.slug && (
            <a href={`/${tenant.slug}/privacy`} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#3486cf] underline underline-offset-2 hover:opacity-70">
              Preview public privacy page →
            </a>
          )}
        </div>
      </div>

        </div>
        )}
      </div>

      {/* ─── TEAM ────────────────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
        <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection("team")}>
          <div>
            <h2 className="font-semibold text-[#0F172A] text-sm">Team</h2>
            <p className="text-xs text-gray-400 mt-0.5">Job cost rates and staff access</p>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${openSections.team ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {openSections.team && (
        <div className="pt-2 pb-4">
      {/* ─── Job Cost Rates ──────────────────────────────────────────────────── */}
      <div id="settings-cost-rates" className="card mt-6 scroll-mt-24">
        <h2 className="font-semibold text-[#0F172A] text-base mb-1">Default Job Cost Rates</h2>
        <p className="text-sm text-gray-500 mb-6">
          These default rates auto-fill the Job Costs card on each booking. You can still override them per booking.
        </p>
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <div>
            <label className="label-field">Shooter Rate ($/hr)</label>
            <input type="number" min="0" step="1" value={costRates.shooterHourly}
              onChange={(e) => setCostRates((r) => ({ ...r, shooterHourly: Number(e.target.value) || 0 }))}
              className="input-field w-full" placeholder="75" />
          </div>
          <div>
            <label className="label-field">Editor Rate ($/photo)</label>
            <input type="number" min="0" step="0.25" value={costRates.editorPerPhoto}
              onChange={(e) => setCostRates((r) => ({ ...r, editorPerPhoto: Number(e.target.value) || 0 }))}
              className="input-field w-full" placeholder="2.00" />
          </div>
          <div>
            <label className="label-field">Travel Rate ($/mile)</label>
            <input type="number" min="0" step="0.01" value={costRates.travelPerMile}
              onChange={(e) => setCostRates((r) => ({ ...r, travelPerMile: Number(e.target.value) || 0 }))}
              className="input-field w-full" placeholder="0.67" />
          </div>
          <div>
            <label className="label-field">Other Flat Cost ($)</label>
            <input type="number" min="0" step="1" value={costRates.otherFlat}
              onChange={(e) => setCostRates((r) => ({ ...r, otherFlat: Number(e.target.value) || 0 }))}
              className="input-field w-full" placeholder="0" />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Shooter fee = rate × shoot hours. Editor fee = rate × photo count. Travel = rate × miles (from your ZIP to property).
        </p>
        <div className="pt-4 border-t border-gray-100 mt-4">
          <button onClick={saveCostRates} disabled={savingCosts} className="btn-primary px-8 py-3">
            {savingCosts ? "Saving…" : "Save Cost Rates"}
          </button>
        </div>
      </div>

      {/* ─── Staff Access ────────────────────────────────────────────────────── */}
      <StaffAccessSection />

        </div>
        )}
      </div>

      {/* ─── NOTIFICATIONS ───────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
        <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection("comms")}>
          <div>
            <h2 className="font-semibold text-[#0F172A] text-sm">Notifications</h2>
            <p className="text-xs text-gray-400 mt-0.5">Email templates, notification channels, gallery settings</p>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${openSections.comms ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {openSections.comms && (
        <div className="pt-2 pb-4">

      {/* ─── Email Templates ─────────────────────────────────────────────────── */}
      <div id="settings-email" className="card mt-6 scroll-mt-24">
        <h2 className="font-semibold text-[#0F172A] text-base mb-1">Email Templates</h2>
        <p className="text-sm text-gray-500 mb-4">
          Customize what each email says. Click any <span className="font-medium text-[#3486cf]">insert field</span> button to add dynamic content like the client name or property address.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-5 text-xs text-amber-700">
          <strong>Email setup required:</strong> Emails are sent via Resend. Add <code className="font-mono bg-amber-100 px-1 rounded">RESEND_API_KEY</code> in your Vercel environment variables and verify your sending domain.
        </div>

        {/* Email type tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-100 overflow-x-auto">
          {[
            { id: "gallery",   label: "Gallery Delivery",  hint: "Sent when you deliver photos" },
            { id: "received",  label: "Booking Received",  hint: "Sent at booking submission" },
            { id: "approved",  label: "Shoot Confirmed",   hint: "Sent when shoot is scheduled" },
            { id: "reminder",  label: "Payment Reminder",  hint: "Sent for unpaid balances" },
          ].map((t) => (
            <button key={t.id} onClick={() => setEmailTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                emailTab === t.id
                  ? "border-[#3486cf] text-[#3486cf]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Insert field chips — shared for all tabs */}
        {(() => {
          const TAB_VARS = {
            gallery:  [["Client Name","{{clientName}}"],["Property Address","{{address}}"],["Gallery Link","{{websiteUrl}}"],["3D Tour (conditional)","[[and your 3D tour is ready: {{tourUrl}}]]"]],
            received: [["Client Name","{{clientName}}"],["Property Address","{{address}}"],["Preferred Date","{{preferredDate}}"],["Services","{{services}}"]],
            approved: [["Client Name","{{clientName}}"],["Property Address","{{address}}"],["Shoot Date","{{date}}"],["Shoot Time","{{shootTime}}"]],
            reminder: [["Client Name","{{clientName}}"],["Property Address","{{address}}"],["Balance Owed","{{balance}}"],["Pay Link","{{paymentUrl}}"]],
          };
          const vars = TAB_VARS[emailTab] || [];

          function insertInto(setter, value) {
            const el = document.activeElement;
            if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
              const start = el.selectionStart ?? el.value.length;
              const end   = el.selectionEnd   ?? el.value.length;
              const next  = el.value.slice(0, start) + value + el.value.slice(end);
              setter(next);
              requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(start + value.length, start + value.length);
              });
            } else {
              setter((v) => v + value);
            }
          }

          const subjectSetter = emailTab === "gallery" ? setEmailTplSubject
            : emailTab === "received" ? setBookingReceivedSubject
            : emailTab === "approved" ? setBookingApprovedSubject
            : setPaymentReminderSubject;
          const bodySetter = emailTab === "gallery" ? setEmailTplBody
            : emailTab === "received" ? setBookingReceivedBody
            : emailTab === "approved" ? setBookingApprovedBody
            : setPaymentReminderBody;

          return (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-2">Insert field — click while cursor is in the field:</p>
              <div className="flex flex-wrap gap-1.5">
                {vars.map(([label, token]) => (
                  <button key={token} type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertInto(document.activeElement?.closest("[data-emailbody]") ? bodySetter : subjectSetter, token); }}
                    className={`text-xs border px-2.5 py-1 rounded-full font-medium transition-colors ${
                      token.startsWith("[[")
                        ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                        : "bg-white border-[#3486cf]/20 text-[#3486cf] hover:bg-[#3486cf]/5"
                    }`}>
                    + {label}
                  </button>
                ))}
              </div>
              {emailTab === "gallery" && (
                <p className="text-[11px] text-gray-400 mt-2">
                  <span className="font-semibold text-amber-600">Conditional fields</span> like &quot;3D Tour&quot; are automatically hidden in the email if that data isn&apos;t available for the listing.
                </p>
              )}
            </div>
          );
        })()}

        {emailTab === "gallery" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Sent when you deliver a gallery. Can be customized per delivery from the gallery editor.</p>
            <div>
              <label className="label-field">Subject Line</label>
              <input type="text" value={emailTplSubject} onChange={(e) => setEmailTplSubject(e.target.value)}
                className="input-field w-full" placeholder="Your listing media is ready — {{address}}" />
            </div>
            <div>
              <label className="label-field">Message Body</label>
              <textarea data-emailbody="1" value={emailTplBody} onChange={(e) => setEmailTplBody(e.target.value)} rows={8}
                placeholder={"Hi {{clientName}},\n\nYour media for {{address}} is ready to view and download.\n\nLet me know if you need any adjustments.\n\nBest,\n" + (tenant?.businessName || "Your Photographer")}
                className="input-field w-full text-sm leading-relaxed resize-y" />
              <p className="text-xs text-gray-400 mt-1">Appears above the gallery button in the email.</p>
            </div>
          </div>
        )}

        {emailTab === "received" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Sent automatically when a client submits a booking and pays their deposit.</p>
            <div>
              <label className="label-field">Subject Line</label>
              <input type="text" value={bookingReceivedSubject} onChange={(e) => setBookingReceivedSubject(e.target.value)}
                className="input-field w-full" placeholder="Booking received — {{address}}" />
            </div>
            <div>
              <label className="label-field">Message Body</label>
              <textarea data-emailbody="1" value={bookingReceivedBody} onChange={(e) => setBookingReceivedBody(e.target.value)} rows={8}
                placeholder={"Hi {{clientName}},\n\nThanks for booking with us! Your shoot request for {{address}} is under review. We'll confirm within 24 hours.\n\nLooking forward to it,\n" + (tenant?.businessName || "Your Photographer")}
                className="input-field w-full text-sm leading-relaxed resize-y" />
              <p className="text-xs text-gray-400 mt-1">Appears above the booking details in the email.</p>
            </div>
          </div>
        )}

        {emailTab === "approved" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Sent when you approve a booking and assign a shoot date.</p>
            <div>
              <label className="label-field">Subject Line</label>
              <input type="text" value={bookingApprovedSubject} onChange={(e) => setBookingApprovedSubject(e.target.value)}
                className="input-field w-full" placeholder="Shoot confirmed — {{address}}" />
            </div>
            <div>
              <label className="label-field">Message Body</label>
              <textarea data-emailbody="1" value={bookingApprovedBody} onChange={(e) => setBookingApprovedBody(e.target.value)} rows={8}
                placeholder={"Hi {{clientName}},\n\nGreat news — your shoot at {{address}} is confirmed for {{date}}. We'll be in touch with any details beforehand.\n\nSee you then,\n" + (tenant?.businessName || "Your Photographer")}
                className="input-field w-full text-sm leading-relaxed resize-y" />
            </div>
          </div>
        )}

        {emailTab === "reminder" && (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">Sent manually from the Orders tab when a client has an outstanding balance after gallery delivery.</p>
            <div>
              <label className="label-field">Subject Line</label>
              <input type="text" value={paymentReminderSubject} onChange={(e) => setPaymentReminderSubject(e.target.value)}
                className="input-field w-full" placeholder="Friendly reminder — balance due for {{address}}" />
            </div>
            <div>
              <label className="label-field">Message Body</label>
              <textarea data-emailbody="1" value={paymentReminderBody} onChange={(e) => setPaymentReminderBody(e.target.value)} rows={8}
                placeholder={"Hi {{clientName}},\n\nJust a quick reminder that your remaining balance of ${{balance}} is due for {{address}}. You can pay directly from your gallery — it only takes a minute.\n\nThanks!\n" + (tenant?.businessName || "Your Photographer")}
                className="input-field w-full text-sm leading-relaxed resize-y" />
              <p className="text-xs text-gray-400 mt-1">Appears above the Pay &amp; Download button in the email.</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button onClick={saveEmailTemplate} disabled={savingTemplate} className="btn-primary px-8 py-3">
            {savingTemplate ? "Saving…" : "Save Email Templates"}
          </button>
        </div>
      </div>

      {/* Notification channel toggles */}
      <div id="settings-notifications" className="card mt-6 scroll-mt-24">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-[#0F172A] text-base">Notification Channels</h2>
          <button onClick={saveNotifPrefs} disabled={savingNotifs} className="btn-primary px-5 py-2 text-sm">
            {savingNotifs ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">Toggle email and SMS delivery for each notification type. SMS requires Studio plan or above.</p>

        {!SMS_PLANS_LIST.includes(tenant?.subscriptionPlan) && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700">
            SMS notifications require the <strong>Studio plan or above</strong>. Upgrade to enable SMS delivery.
          </div>
        )}

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Client notifications</p>
        {CUSTOMER_NOTIFICATIONS.map((notif) => (
          <NotifToggleRow key={notif.id} notif={notif}
            pref={notifPrefs[notif.id] || { channels: { email: true, sms: true } }}
            plan={tenant?.subscriptionPlan || "solo"}
            onToggle={(ch) => toggleNotifChannel(notif.id, ch)} />
        ))}

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-5 mb-1">Team notifications</p>
        {TEAM_NOTIFICATIONS.map((notif) => (
          <NotifToggleRow key={notif.id} notif={notif}
            pref={notifPrefs[notif.id] || { channels: { email: true, sms: true } }}
            plan={tenant?.subscriptionPlan || "solo"}
            onToggle={(ch) => toggleNotifChannel(notif.id, ch)} />
        ))}
      </div>

      {/* ─── Gallery Settings ────────────────────────────────────────────────── */}
      <div className="card mt-6 scroll-mt-24">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-[#0F172A] text-base">Gallery Settings</h2>
          <button onClick={saveGalleryPrefs} disabled={savingGalleryPrefs} className="btn-primary px-5 py-2 text-sm">
            {savingGalleryPrefs ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-5">Control how client gallery views and downloads are tracked.</p>

        <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Enable Viewer Tracking</p>
            <p className="text-xs text-gray-400 mt-0.5">
              When on, every gallery view logs the viewer&apos;s name, email, IP address, and device. Downloads are also recorded.
              Disable if your clients require stricter privacy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViewerTracking((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-0.5 ${viewerTracking ? "bg-[#3486cf]" : "bg-gray-300"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${viewerTracking ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

        </div>
        )}
      </div>

      {/* ─── INTEGRATIONS ────────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-2xl bg-white overflow-hidden">
        <button type="button" className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors" onClick={() => toggleSection("integrations")}>
          <div>
            <h2 className="font-semibold text-[#0F172A] text-sm">Integrations</h2>
            <p className="text-xs text-gray-400 mt-0.5">Custom domain and third-party connections</p>
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${openSections.integrations ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {openSections.integrations && (
        <div className="pt-2 pb-4">
      <div id="settings-integrations" className="card mt-6 scroll-mt-24">
        <h2 className="font-semibold text-[#0F172A] text-base mb-1">Integrations</h2>
        <p className="text-sm text-gray-500">More integrations coming soon.</p>
      </div>

      {/* Custom Domain */}
      <CustomDomainSection />

        </div>
        )}
      </div>

      </div>
    </div>
  </div>
  );
}
