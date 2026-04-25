export async function POST() {
  return Response.json({ error: "QuickBooks integration has been removed." }, { status: 410 });
}
