"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import BookingForm from "@/components/dashboard/BookingForm";
import Link from "next/link";

export default function EditBookingPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error,   setError]   = useState("");

  useEffect(() => {
    async function load() {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/dashboard/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setError("Booking not found."); return; }
      const data = await res.json();
      setBooking(data.booking || data);
    }
    load();
  }, [id]);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">{error}</p>
        <Link href="/dashboard/bookings" className="text-sm text-[#3486cf] mt-2 inline-block">← Back to bookings</Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-8 flex justify-center h-64 items-center">
        <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  return <BookingForm mode="edit" bookingId={id} initialValues={booking} />;
}
