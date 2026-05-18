// One-time init route has been permanently disabled.
export async function GET() {
  return Response.json({ error: "Not found" }, { status: 404 });
}
