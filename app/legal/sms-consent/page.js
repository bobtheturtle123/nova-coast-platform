import { permanentRedirect } from "next/navigation";

// Canonical SMS consent policy now lives at /sms-consent. This legacy path 308-redirects there.
export default function LegalSmsConsentRedirect() {
  permanentRedirect("/sms-consent");
}
