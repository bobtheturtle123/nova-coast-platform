import StepProgress from "@/components/booking/StepProgress";

// Each booking page passes its step number via searchParams or we detect from pathname
export default function BookingLayout({ children }) {
  return (
    <div className="min-h-screen bg-cream">
      {/* Top nav */}
      <header className="bg-white" style={{ borderBottom: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.04)" }}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="https://novacoastmedia.com" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #C9A96E, #9a7535)" }}>
              <span className="text-white font-bold text-[11px]">N</span>
            </div>
            <span className="font-semibold text-[#0F172A] text-[15px] tracking-tight">
              Nova Coast
            </span>
            <span className="text-gold text-[10px] font-semibold tracking-[0.18em] uppercase hidden sm:inline opacity-80">
              Media
            </span>
          </a>
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
