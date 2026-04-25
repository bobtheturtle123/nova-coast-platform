export async function GET() {
  return Response.json({ error: "QuickBooks integration has been removed." }, { status: 410 });
}
