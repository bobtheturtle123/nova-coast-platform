import { NextResponse } from "next/server";
import { getTenantByReferralCode } from "@/lib/referral";
import { getAppUrl } from "@/lib/appUrl";

export async function GET(req, { params }) {
  const { code } = params;
  const registerUrl = new URL(`${getAppUrl()}/auth/register`);

  // Validate code exists before setting cookie (prevents junk cookies)
  const referrer = await getTenantByReferralCode(code).catch(() => null);
  if (!referrer) {
    return NextResponse.redirect(registerUrl);
  }

  const response = NextResponse.redirect(registerUrl);
  response.cookies.set("shootflow_ref", code, {
    maxAge:   30 * 24 * 60 * 60,
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    secure:   process.env.NODE_ENV === "production",
  });
  return response;
}
