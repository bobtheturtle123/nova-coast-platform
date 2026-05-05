import StepProgress from "@/components/booking/StepProgress";

// Each booking page passes its step number via searchParams or we detect from pathname
export default function BookingLayout({ children }) {
  return (
    <div className="min-h-screen bg-cream">
      {/* Top nav */}
      <header className="bg-white" style={{ borderBottom: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #3486cf, #1e6091)" }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs text-gray-400">Secure booking</span>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
