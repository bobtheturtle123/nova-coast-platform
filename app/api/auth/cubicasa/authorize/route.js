// CubiCasa OAuth is no longer used. Credentials are collected via API key form.
// See /api/dashboard/cubicasa/connect for the current implementation.
export async function GET() {
  return new Response("Not found", { status: 404 });
}
