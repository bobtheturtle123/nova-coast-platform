import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const INITIAL_STATE = {
  // Tenant context
  tenantSlug:   null,
  tenantId:     null,
  tenantName:   null,

  // Step 1
  packageId:  null,
  serviceIds: [],

  // Step 2
  addonIds: [],

  // Step 3 — Property
  address:       "",
  city:          "",
  state:         "CA",
  zip:           "",
  lat:           null,
  lng:           null,
  squareFootage: "",
  propertyType:  "residential",
  notes:         "",

  // Step 4 — Pricing
  travelFee:  0,
  pricing:    null,

  // Step 5 — Schedule
  preferredDate:         "",
  preferredTime:         "morning",
  preferredTimeSpecific: null,
  twilightTime:          null,
  photographerId:        null,

  // Custom fields (from admin config)
  customFields: {},

  // Step 6 — Client info
  clientName:  "",
  clientEmail: "",
  clientPhone: "",

  // Service area
  serviceZonePhotographers: [], // memberIds assigned to the matched zone
  serviceZoneName: null,

  // Promo code
  promoCode:  "",
  promoId:    null,
  discount:   0,

  // Post-payment
  bookingId:   null,
  depositPaid: false,
  paidInFull:  false,
};

export const useBookingStore = create(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      // ─── Tenant ──────────────────────────────────────────────────
      setTenant: (tenantSlug, tenantId, tenantName) =>
        set({ tenantSlug, tenantId, tenantName }),

      // ─── Setters ──────────────────────────────────────────────
      setPackage: (packageId) =>
        set({ packageId, serviceIds: [] }),

      toggleService: (serviceId) =>
        set((state) => ({
          packageId: null,
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

      setSquareFootage: (squareFootage) => set({ squareFootage }),
      setProperty:      (fields) => set(fields),
      setPricing:       (pricing) => set({ pricing }),
      setTravelFee:     (travelFee) => set({ travelFee }),
      setSchedule:      (fields) => set(fields),
      setClientInfo:    (fields) => set(fields),
      setCustomFields:  (customFields) => set({ customFields }),
      setServiceZone:   (photographers, zoneName) =>
        set({ serviceZonePhotographers: photographers, serviceZoneName: zoneName }),
      setPromo:         (promoCode, promoId, discount) => set({ promoCode, promoId, discount }),
      clearPromo:       () => set({ promoCode: "", promoId: null, discount: 0 }),

      setBookingResult: (bookingId, paidInFull = false) =>
        set({ bookingId, depositPaid: true, paidInFull }),

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

      // Helper: base URL for this tenant's booking flow
      bookPath: (path = "") => {
        const { tenantSlug } = get();
        return `/${tenantSlug}/book${path}`;
      },

      // Helper: API base for this tenant
      apiPath: (path) => {
        const { tenantSlug } = get();
        return `/api/${tenantSlug}${path}`;
      },
    }),
    {
      name: "novaos-booking",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : {
          getItem: () => null, setItem: () => {}, removeItem: () => {},
        }
      ),
    }
  )
);
