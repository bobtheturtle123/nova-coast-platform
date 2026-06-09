import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "Team & Scheduling — Photographers, Calendars & Availability | KyoriaOS",
  description:
    "Set up your team in KyoriaOS: invite photographers, control who can be booked, sync Google Calendar to avoid double-booking, and read the schedule views.",
  alternates: { canonical: "https://kyoriaos.com/guides/team-schedule" },
};

const ROLES = [
  { icon: "📷", t: "Photographer", d: "Shoots jobs. Appears in the booking schedule and gets shoot notifications. No dashboard access by default." },
  { icon: "🤝", t: "Assistant", d: "Can be assigned to shoots as on-site help, but isn't offered as the primary photographer on the public booking page." },
  { icon: "📋", t: "Manager", d: "Logs into the dashboard to manage bookings, galleries, and the team. Doesn't shoot unless you enable it." },
  { icon: "🔑", t: "Admin", d: "Full dashboard access like you, minus billing." },
];

const STEPS = [
  { title: "Invite a team member", body: <>Go to <strong>Team &amp; Schedule → Add</strong>, enter their email and pick a role. They get an email invite to set a password and join.</> },
  { title: "Decide who can be booked", body: <>Each member has a <strong>“Show in photographer selection”</strong> toggle. Turn it on for anyone who shoots; admins and managers are off by default so they&apos;re never accidentally assigned.</> },
  { title: "Connect calendars", body: <>Each person can connect their Google Calendar so their personal busy times show as blocks — KyoriaOS then won&apos;t let them be double-booked.</> },
  { title: "Assign shoots", body: <>When booking, you&apos;ll see each photographer&apos;s availability for that date (free, booked, blocked, or travel conflict) and assign accordingly.</> },
];

export default function TeamScheduleGuide() {
  return (
    <GuideShell
      eyebrow="Team & Scheduling"
      title="Team & scheduling"
      intro="Add photographers, control who can be assigned, and keep everyone's availability in sync so you never double-book a shoot."
      currentSlug="team-schedule"
    >
      <GuideH2>The roles</GuideH2>
      <div className="grid sm:grid-cols-2 gap-3">
        {ROLES.map((x) => (
          <div key={x.t} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-2xl mb-2">{x.icon}</div>
            <p className="font-semibold text-[#0F172A] text-sm">{x.t}</p>
            <p className="text-[13px] text-gray-500 mt-1 leading-snug">{x.d}</p>
          </div>
        ))}
      </div>

      <GuideH2>Setting up your team</GuideH2>
      <Steps steps={STEPS} />

      <GuideH2>Calendar sync, explained</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
        <p className="text-[14px] text-gray-600 mb-3">When a photographer connects Google Calendar:</p>
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>🗓️ Their busy times for the next 90 days import as <strong>“Busy” blocks</strong> on the schedule (we only read free/busy — never event details).</li>
          <li>⏱️ Each block shows the <strong>start and finish time</strong> and whose calendar it&apos;s from, so you can fit a shoot accurately.</li>
          <li>🚫 Those blocks stop that person from being assigned during conflicting times.</li>
          <li>🔄 It re-syncs automatically; a <strong>Sync Now</strong> button refreshes immediately.</li>
        </ul>
        <p className="text-[12px] text-gray-400 mt-4">You can also subscribe to your KyoriaOS schedule <em>from</em> Apple Calendar or Outlook using the read-only feed link in the sync panel.</p>
      </div>

      <GuideH2>Reading the schedule</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li><strong>Week / 2-week / Month / Day</strong> views — switch based on how far ahead you&apos;re planning.</li>
          <li>Filter to <strong>one photographer</strong> or see the whole team at once, each in their own color.</li>
          <li>Click any shoot or busy block to see full details in a popup.</li>
          <li>The <strong>“This week&apos;s availability”</strong> recap shows who&apos;s free at a glance.</li>
        </ul>
      </div>
    </GuideShell>
  );
}
