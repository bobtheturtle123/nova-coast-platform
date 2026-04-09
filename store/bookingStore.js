import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const INITIAL_STATE = {
  // Step 1
  packageId:  null,     // "core" | "growth" | "signature" | null
  serviceIds: [],       // ["photography", "drone", ...]

  // Step 2
  addonIds: [],         // ["twilight", "reels", ...]

  // Step 3 — Property
  address:       "",
  city:          "",
  state:         "CA",
  zip:           "",
  squareFootage: "",
  propertyType:  "residential",
  notes:         "",

  // Step 4 — Pricing
  travelFee:  0,
  pricing:    null,     // { base, addonTotal, travelFee, subtotal, deposit, balance }

  // Step 5 — Schedule
  preferredDate: "",    // ISO date string
  preferredTime: "morning", // "morning" | "afternoon"
  photographerId: null, // assigned in Phase 2

  // Step 6 — Client info
  clientName:  "",
  clientEmail: "",
  clientPhone: "",

  // Step 7 — Post-payment
  bookingId: null,
  depositPaid: false,
};

export const useBookingStore = create(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ─── Setters ──────────────────────────────────────────────
      setPackage: (packageId) =>
        set({ packageId, serviceIds: [] }),

      toggleService: (serviceId) =>
        set((state) => ({
          packageId: null, // deselect package if picking custom
          serviceIds: state.serviceIds.includes(serviceId)
            ? state.serviceIds.filter((id) => id !== serviceId)
            : [...state.serviceIds, serviceId],
        })),

      toggleAddon: (addonId) =>
        set((state) => ({
          addonIds: state.addonIds.includes(addonId)
            ? state.addonIds.filter((id) => id !== addonId)
            : [...state.addonIds, addonId],
        })),

      setProperty: (fields) => set(fields),

      setPricing: (pricing) => set({ pricing }),
      setTravelFee: (travelFee) => set({ travelFee }),

      setSchedule: (fields) => set(fields),
      setClientInfo: (fields) => set(fields),

      setBookingResult: (bookingId) =>
        set({ bookingId, depositPaid: true }),

      // ─── Reset ────────────────────────────────────────────────
      resetBooking: () => set(INITIAL_STATE),

      // ─── Computed helpers ─────────────────────────────────────
      getFullAddress: () => {
        const { address, city, state, zip } = get();
        return [address, city, state, zip].filter(Boolean).join(", ");
      },

      hasSelections: () => {
        const { packageId, serviceIds } = get();
        return !!packageId || serviceIds.length > 0;
      },
    }),
    {
      name: "nova-coast-booking",
      storage: createJSONStorage(() => sessionStorage), // cleared when tab closes
    }
  )
);
