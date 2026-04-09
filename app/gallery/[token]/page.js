import { adminDb } from "@/lib/firebase-admin";
import GalleryClient from "./GalleryClient";
import { notFound } from "next/navigation";

// Server component: fetch gallery by token
export default async function GalleryPage({ params }) {
  const { token } = params;

  // Find gallery by access token
  const snap = await adminDb
    .collection("galleries")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) notFound();

  const galleryData = snap.docs[0].data();

  // Fetch booking for balance payment
  const bookingSnap = await adminDb
    .collection("bookings")
    .doc(galleryData.bookingId)
    .get();

  const booking = bookingSnap.exists ? bookingSnap.data() : null;

  // Pass serializable data to client component
  return (
    <GalleryClient
      gallery={JSON.parse(JSON.stringify(galleryData))}
      booking={booking ? JSON.parse(JSON.stringify(booking)) : null}
    />
  );
}
