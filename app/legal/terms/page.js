import { permanentRedirect } from "next/navigation";

// Canonical terms of service now lives at /terms. This legacy path 308-redirects there.
export default function LegalTermsRedirect() {
  permanentRedirect("/terms");
}
