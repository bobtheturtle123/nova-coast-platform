"use client";
import { createContext, useContext } from "react";

export const DashboardPermissionsContext = createContext({ permissions: {}, userRole: "owner" });

export function useDashboardPermissions() {
  return useContext(DashboardPermissionsContext);
}
