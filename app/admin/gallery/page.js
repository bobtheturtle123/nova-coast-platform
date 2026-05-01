"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import Link from "next/link";

export default function AdminGalleriesPage() {
  const [galleries, setGalleries] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getDocs(collection(db, "galleries"))
      .then((snap) =>
        setGalleries(
          snap.docs
            .map((d) => d.data())
            .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl text-[#3486cf] mb-6">Galleries</h1>

      {loading ? (
        <p className="text-gray-400 font-body">Loading...</p>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm font-body">
            <thead className="border-b border-gray-100 bg-cream">
              <tr>
                {["Property", "Photos", "Status", "Email Sent", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {galleries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No galleries yet. Create one from a booking's detail page.
                  </td>
                </tr>
              )}
              {galleries.map((g) => (
                <tr key={g.id} className="border-b border-gray-50 hover:bg-cream/50">
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">
                    {g.propertyAddress}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {g.photos?.length ?? 0} photos
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium
                      ${g.unlocked
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"}`}>
                      {g.unlocked ? "Unlocked" : "Locked"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {g.emailSentAt
                      ? new Date(g.emailSentAt?.seconds * 1000 || g.emailSentAt).toLocaleDateString()
                      : "Not sent"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/gallery/${g.bookingId}`}
                      className="text-[#3486cf] text-xs underline underline-offset-2 font-medium"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
