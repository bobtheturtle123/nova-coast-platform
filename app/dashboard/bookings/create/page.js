"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import BookingForm from "@/components/dashboard/BookingForm";
import { useDashboardPermissions } from "@/lib/dashboardPermissions";

export default function CreateBookingPage() {
  const { permissions, userRole } = useDashboardPermissions();
  const router = useRouter();

  const canCreate = userRole === "owner" || userRole === "admin" || !!permissions?.canCreateBookings;

  useEffect(() => {
    if (userRole && !canCreate) {
      router.replace("/dashboard/bookings");
    }
  }, [canCreate, userRole, router]);

  if (!canCreate) return null;

  return <BookingForm mode="create" />;
}
