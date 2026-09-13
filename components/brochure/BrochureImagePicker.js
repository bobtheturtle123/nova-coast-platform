"use client";

// Ordered picker for the print brochure's photos. The brochure lays out the
// first selected photo as the large cover and the next four in a grid, so the
// selection is ORDERED, not just a set. Clicking an unselected photo appends it;
// clicking a selected one removes it (and everything renumbers). When nothing is
// selected the brochure falls back to the first photos in gallery order.
//
// Shared by the studio (listings editor) and the agent portal. It's fully
// controlled: it stores an ordered array of media keys and calls onChange with
// the new array — the parent owns persistence.
export default function BrochureImagePicker({ photos = [], selectedKeys = [], onChange, accent = "#3486cf" }) {
  const selected = Array.isArray(selectedKeys) ? selectedKeys : [];

  function toggle(key) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  const usable = photos.filter((p) => p.key && p.url);

  if (!usable.length) {
    return (
      <p className="text-xs text-gray-400">
        No photos available yet — the brochure will use gallery photos once they're uploaded.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs text-gray-500 leading-snug">
          {selected.length > 0
            ? `${selected.length} photo${selected.length === 1 ? "" : "s"} chosen — first is the cover, next four fill the grid.`
            : "Using the first photos automatically. Click to hand-pick and order them."}
        </p>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 flex-shrink-0">
            Reset to default
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {usable.map((p) => {
          const idx = selected.indexOf(p.key);
          const isSel = idx !== -1;
          return (
            <button
              type="button"
              key={p.key}
              onClick={() => toggle(p.key)}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                isSel ? "ring-2 ring-offset-1" : "border-transparent hover:opacity-90"
              }`}
              style={isSel ? { borderColor: accent, boxShadow: `0 0 0 2px ${accent}` } : { borderColor: "#e5e7eb" }}>
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              {isSel && (
                <>
                  <span className="absolute inset-0 bg-black/25" />
                  <span
                    className="absolute top-1 left-1 w-5 h-5 rounded-full text-white text-[11px] font-bold flex items-center justify-center"
                    style={{ background: accent }}>
                    {idx + 1}
                  </span>
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-semibold text-center py-0.5">
                      COVER
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
