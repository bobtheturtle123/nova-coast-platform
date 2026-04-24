"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/Toast";

// ─── Notification definitions ─────────────────────────────────────────────────

const CUSTOMER_NOTIFICATIONS = [
  {
    id:          "order_confirmation",
    label:       "Order Confirmation",
    description: "Sent when a client submits a new booking request.",
    channels:    ["email", "sms"],
    defaultSubject: "We received your booking — {{address}}",
    defaultBody:    "Hi {{clientName}},\n\nThanks for booking with {{businessName}}! We've received your request and will confirm shortly.\n\nBooking details:\n{{services}}\n{{address}}\nPreferred date: {{preferredDate}}\n\nWe'll be in touch soon.",
  },
  {
    id:          "appointment_scheduled",
    label:       "Appointment Scheduled",
    description: "Sent when a shoot date and time are confirmed.",
    channels:    ["email", "sms"],
    defaultSubject: "Your shoot is confirmed — {{address}}",
    defaultBody:    "Hi {{clientName}},\n\nYour shoot is confirmed!\n\n📍 {{address}}\n📅 {{shootDate}}\n⏰ {{shootTime}}\n\nWe'll see you then.",
  },
  {
    id:          "appointment_reminder",
    label:       "Appointment Reminder",
    description: "Sent as a reminder before an upcoming shoot (24 hours ahead).",
    channels:    ["email", "sms"],
    defaultSubject: "Reminder: Your shoot is tomorrow — {{address}}",
    defaultBody:    "Hi {{clientName}},\n\nJust a reminder that your shoot is tomorrow!\n\n📍 {{address}}\n📅 {{shootDate}}\n⏰ {{shootTime}}\n\nSee you there!",
  },
  {
    id:          "appointment_rescheduled",
    label:       "Appointment Rescheduled",
    description: "Sent when a shoot is moved to a new date or time.",
    channels:    ["email", "sms"],
    defaultSubject: "Your shoot has been rescheduled — {{address}}",
    defaultBody:    "Hi {{clientName}},\n\nYour shoot has been rescheduled.\n\n📍 {{address}}\n📅 New date: {{shootDate}}\n⏰ New time: {{shootTime}}\n\nQuestions? Reply to this email.",
  },
  {
    id:          "appointment_canceled",
    label:       "Appointment Canceled",
    description: "Sent when a booking is canceled.",
    channels:    ["email", "sms"],
    defaultSubject: "Your booking has been canceled — {{address}}",
    defaultBody:    "Hi {{clientName}},\n\nYour booking for {{address}} has been canceled. Please reach out if you'd like to reschedule.",
  },
  {
    id:          "listing_delivered",
    label:       "Listing Delivered",
    description: "Sent when your media is delivered to the agent.",
    channels:    ["email", "sms"],
    defaultSubject: "Your listing media is ready — {{address}}",
    defaultBody:    "Hi {{clientName}},\n\nYour media for {{address}} is ready! Click the link below to view and download your files.\n\n{{galleryUrl}}\n\nThank you for choosing {{businessName}}.",
  },
  {
    id:          "payment_required",
    label:       "Payment Required",
    description: "Sent when a payment (deposit or balance) is due.",
    channels:    ["email"],
    defaultSubject: "Payment required for your booking — {{address}}",
    defaultBody:    "Hi {{clientName}},\n\nA payment of ${{amount}} is due for your booking at {{address}}.\n\nPay here: {{paymentUrl}}\n\nThank you.",
  },
  {
    id:          "payment_overdue",
    label:       "Payment Overdue",
    description: "Sent when a payment is past due.",
    channels:    ["email"],
    defaultSubject: "Payment overdue — {{address}}",
    defaultBody:    "Hi {{clientName}},\n\nA payment of ${{amount}} for your booking at {{address}} is overdue. Please pay as soon as possible to avoid cancellation.\n\nPay here: {{paymentUrl}}",
  },
];

const TEAM_NOTIFICATIONS = [
  {
    id:          "team_order_received",
    label:       "New Order Received",
    description: "Sent to you when a new booking is submitted.",
    channels:    ["email", "sms"],
    defaultSubject: "New booking: {{address}}",
    defaultBody:    "A new booking has been submitted.\n\nClient: {{clientName}}\nAddress: {{address}}\nServices: {{services}}\nPreferred date: {{preferredDate}}\n\nView it in your dashboard.",
  },
  {
    id:          "team_appointment_assigned",
    label:       "Appointment Assigned",
    description: "Sent to a photographer when assigned to a shoot.",
    channels:    ["email", "sms"],
    defaultSubject: "You've been assigned: {{address}} on {{shootDate}}",
    defaultBody:    "Hi {{photographerName}},\n\nYou've been assigned a shoot.\n\n📍 {{address}}\n📅 {{shootDate}}\n⏰ {{shootTime}}\nServices: {{services}}\n\nView in dashboard: {{dashboardUrl}}",
  },
  {
    id:          "team_appointment_unassigned",
    label:       "Appointment Unassigned",
    description: "Sent to a photographer when removed from a shoot.",
    channels:    ["email"],
    defaultSubject: "Unassigned from shoot: {{address}}",
    defaultBody:    "Hi {{photographerName}},\n\nYou have been unassigned from the shoot at {{address}} on {{shootDate}}.",
  },
  {
    id:          "team_appointment_reminder",
    label:       "Team Appointment Reminder",
    description: "Sent to the assigned photographer 24 hours before a shoot.",
    channels:    ["email", "sms"],
    defaultSubject: "Reminder: You have a shoot tomorrow — {{address}}",
    defaultBody:    "Hi {{photographerName}},\n\nReminder: you have a shoot tomorrow.\n\n📍 {{address}}\n⏰ {{shootTime}}\nServices: {{services}}",
  },
  {
    id:          "team_daily_summary",
    label:       "Daily Appointment Summary",
    description: "Sent every morning with today's shoot schedule.",
    channels:    ["email"],
    defaultSubject: "Today's shoots — {{date}}",
    defaultBody:    "Good morning!\n\nHere's your schedule for today ({{date}}):\n\n{{appointmentList}}\n\nHave a great day.",
  },
  {
    id:          "team_payment_processed",
    label:       "Payment Processed",
    description: "Sent to you when a client completes a payment.",
    channels:    ["email"],
    defaultSubject: "Payment received — {{address}}",
    defaultBody:    "A payment of ${{amount}} was received from {{clientName}} for the booking at {{address}}.",
  },
  {
    id:          "team_member_invitation",
    label:       "Team Member Invitation",
    description: "Sent to new photographers when invited to join your team.",
    channels:    ["email"],
    defaultSubject: "You've been invited to join {{businessName}} on ShootFlow",
    defaultBody:    "Hi!\n\n{{businessName}} has invited you to join their team on ShootFlow. Click the link below to set up your account.\n\n{{inviteUrl}}",
  },
];

const AVAILABLE_VARS = [
  "{{clientName}}", "{{businessName}}", "{{address}}", "{{shootDate}}", "{{shootTime}}",
  "{{services}}", "{{galleryUrl}}", "{{paymentUrl}}", "{{amount}}", "{{photographerName}}",
  "{{preferredDate}}", "{{dashboardUrl}}", "{{date}}", "{{appointmentList}}", "{{inviteUrl}}",
];

const SMS_PLANS = ["studio", "pro", "scale"];

// ─── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({ notification, pref, onSave, onClose }) {
  const [subject, setSubject] = useState(pref?.customSubject || notification.defaultSubject);
  const [body,    setBody]    = useState(pref?.customBody    || notification.defaultBody);

  function resetDefaults() {
    setSubject(notification.defaultSubject);
    setBody(notification.defaultBody);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="font-display text-navy text-base">{notification.label}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{notification.description}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4 flex-shrink-0">×</button>
        </div>

        <div className="p-6 space-y-4">
          {notification.channels.includes("email") && (
            <>
              <div>
                <label className="label-field">Email Subject</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                  className="input-field w-full" />
              </div>
              <div>
                <label className="label-field">Email Body</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)}
                  rows={10} className="input-field w-full resize-y font-mono text-xs leading-relaxed" />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Available variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_VARS.filter((v) => {
                    const combined = subject + " " + body;
                    return combined.includes(v) || true;
                  }).map((v) => (
                    <button key={v} type="button"
                      onClick={() => setBody((b) => b + v)}
                      className="text-[11px] font-mono bg-white border border-gray-200 px-2 py-0.5 rounded hover:border-navy/40 hover:text-navy transition-colors">
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between sticky bottom-0 bg-white">
          <button onClick={resetDefaults} className="text-xs text-gray-400 hover:text-gray-600">
            Reset to default
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-outline px-5 py-2 text-sm">Cancel</button>
            <button onClick={() => onSave({ customSubject: subject, customBody: body })} className="btn-primary px-6 py-2 text-sm">
              Save Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────
function NotifRow({ notification, pref, plan, onToggleChannel, onOpenEdit }) {
  const emailEnabled = pref?.channels?.email !== false;
  const smsEnabled   = pref?.channels?.sms !== false;
  const smsAllowed   = SMS_PLANS.includes(plan);
  const isCustomized = !!(pref?.customSubject || pref?.customBody);

  return (
    <div className="flex items-start gap-4 py-4 border-b last:border-b-0 border-gray-100">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-charcoal">{notification.label}</p>
          {isCustomized && (
            <span className="text-[10px] font-semibold text-navy bg-navy/8 px-1.5 py-0.5 rounded">Custom</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{notification.description}</p>
      </div>

      {/* Channel toggles */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {notification.channels.includes("email") && (
          <button
            onClick={() => onToggleChannel("email")}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium transition-colors ${
              emailEnabled
                ? "bg-navy text-white border-navy"
                : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
            }`}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Email
          </button>
        )}

        {notification.channels.includes("sms") && (
          <div className="relative">
            <button
              onClick={() => smsAllowed && onToggleChannel("sms")}
              title={!smsAllowed ? "SMS is available on Studio plan and above" : undefined}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium transition-colors ${
                !smsAllowed
                  ? "opacity-40 cursor-not-allowed bg-white text-gray-400 border-gray-200"
                  : smsEnabled
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
              }`}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              SMS
              {!smsAllowed && <span className="ml-0.5 text-[9px] opacity-60">Studio+</span>}
            </button>
          </div>
        )}

        <button
          onClick={onOpenEdit}
          className="text-xs text-navy hover:underline px-2 py-1.5 flex-shrink-0">
          Edit template
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const toast   = useToast();
  const [prefs,   setPrefs]   = useState({});
  const [plan,    setPlan]    = useState("solo");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(null); // notification definition being edited

  useEffect(() => {
    async function load() {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const [prefsRes, tenantRes] = await Promise.all([
        fetch("/api/dashboard/notifications", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",         { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (prefsRes.ok)  { const d = await prefsRes.json();  setPrefs(d.prefs || {}); }
      if (tenantRes.ok) { const d = await tenantRes.json(); setPlan(d.tenant?.subscriptionPlan || "solo"); }
      setLoading(false);
    }
    load();
  }, []);

  function getPref(id) {
    return prefs[id] || { channels: { email: true, sms: true } };
  }

  function toggleChannel(id, channel) {
    setPrefs((prev) => {
      const existing = prev[id] || { channels: { email: true, sms: true } };
      return {
        ...prev,
        [id]: {
          ...existing,
          channels: {
            ...existing.channels,
            [channel]: !(existing.channels?.[channel] !== false),
          },
        },
      };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/dashboard/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prefs }),
      });
      if (res.ok) toast("Notification preferences saved.");
      else toast("Failed to save.", "error");
    } catch { toast("Something went wrong.", "error"); }
    setSaving(false);
  }

  function saveTemplate(id, templateData) {
    setPrefs((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { channels: { email: true, sms: true } }), ...templateData },
    }));
    setEditing(null);
  }

  if (loading) return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">Notifications</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Control which emails and SMS messages are sent, and customize each template.
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary px-6 py-2 text-sm flex-shrink-0">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {!SMS_PLANS.includes(plan) && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
          <svg width="16" height="16" className="flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span>SMS notifications are available on the <strong>Studio plan and above</strong>. Upgrade your plan to unlock SMS delivery.</span>
        </div>
      )}

      {/* Customer notifications */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-charcoal text-base">Customer Notifications</h2>
          <p className="text-sm text-gray-400 mt-0.5">These are sent to your clients when events happen.</p>
        </div>
        <div className="px-6">
          {CUSTOMER_NOTIFICATIONS.map((notif) => (
            <NotifRow
              key={notif.id}
              notification={notif}
              pref={getPref(notif.id)}
              plan={plan}
              onToggleChannel={(ch) => toggleChannel(notif.id, ch)}
              onOpenEdit={() => setEditing(notif)}
            />
          ))}
        </div>
      </div>

      {/* Team notifications */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-charcoal text-base">Team Notifications</h2>
          <p className="text-sm text-gray-400 mt-0.5">These are sent to you and your team members.</p>
        </div>
        <div className="px-6">
          {TEAM_NOTIFICATIONS.map((notif) => (
            <NotifRow
              key={notif.id}
              notification={notif}
              pref={getPref(notif.id)}
              plan={plan}
              onToggleChannel={(ch) => toggleChannel(notif.id, ch)}
              onOpenEdit={() => setEditing(notif)}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary px-8 py-2.5 text-sm">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      {/* Edit template modal */}
      {editing && (
        <EditModal
          notification={editing}
          pref={prefs[editing.id] || {}}
          onSave={(data) => saveTemplate(editing.id, data)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
