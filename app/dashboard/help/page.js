"use client";

// Help & Guides inside the dashboard: the full guides hub renders in an embedded
// frame so the tenant keeps the dashboard sidebar and chrome while browsing.
// The guide pages detect they're embedded and hide their own back/CTA chrome.
export default function DashboardHelpPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-3.25rem)]">
      <div className="px-6 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">Help &amp; Guides</h1>
        <p className="text-sm text-gray-500 mt-1">
          Step-by-step guides for everything in KyoriaOS.{" "}
          <a href="/guides" target="_blank" rel="noopener noreferrer" className="text-[#3486cf] hover:underline">Open in a new tab ↗</a>
        </p>
      </div>
      <iframe
        src="/guides?embed=1"
        title="KyoriaOS Guides"
        className="flex-1 w-full border-0"
      />
    </div>
  );
}
