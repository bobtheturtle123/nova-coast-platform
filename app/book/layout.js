import StepProgress from "@/components/booking/StepProgress";

// Each booking page passes its step number via searchParams or we detect from pathname
export default function BookingLayout({ children }) {
  return (
    <div className="min-h-screen bg-cream">
      {/* Top nav */}
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="https://novacoastmedia.com" className="flex items-center gap-2">
            <span className="font-display text-navy text-lg tracking-wide">
              NOVA COAST
            </span>
            <span className="text-gold text-xs font-body tracking-[0.2em] uppercase hidden sm:inline">
              Media
            </span>
          </a>
          <span className="text-xs text-gray-400 font-body">Secure booking</span>
        </div>
      </header>

      {children}
    </div>
  );
}
