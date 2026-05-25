"use client";

import { createContext, useContext } from "react";

export const TenantSettingsContext = createContext({
  tempUnit: "F",
  locale:   "en-US",
  currency: "USD",
  refresh:  () => {},
});

export function useTenantSettings() {
  return useContext(TenantSettingsContext);
}

export function formatCurrency(amount, currency = "USD", locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount ?? 0);
  } catch {
    return `$${(amount ?? 0).toLocaleString()}`;
  }
}
