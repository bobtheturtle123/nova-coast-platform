// This legacy route has been disabled — bookings are created via /api/[slug]/booking/create
export async function POST() {
  return Response.json({ error: "This endpoint is no longer active." }, { status: 410 });
}
