"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function BookingDetailPage() {
  const { id } = useParams();
  const router  = useRouter();

  useEffect(() => {
    if (id) router.replace(`/dashboard/listings/${id}`);
  }, [id, router]);

  return (
    <div className="p-8 flex justify-center h-64 items-center">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );
}
