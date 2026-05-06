"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RevisionsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/listings"); }, [router]);
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );
}
