"use client";

import { useEffect, useState, useRef } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function GalleriesPage() {
  const [galleries, setGalleries] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/galleries", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGalleries(data.galleries);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-8">
      <h1 className="page-title mb-6">Galleries</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
        </div>
      ) : galleries.length === 0 ? (
        <div className="card p-12 text-center text-gray-400 text-sm">
          <p className="text-2xl mb-2">🖼️</p>
          <p>No galleries yet. Create one from a completed booking.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {galleries.map((g) => (
            <Link key={g.id} href={`/dashboard/galleries/${g.id}`}
              className="card p-5 card-hover block">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-navy truncate">{g.bookingAddress || "Gallery"}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2
                  ${g.unlocked ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                  {g.unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
              <p className="text-xs text-gray-400">{g.mediaCount || 0} items</p>
              <p className="text-xs text-gray-400">
                Created {new Date(g.createdAt?.seconds ? g.createdAt.seconds * 1000 : g.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
