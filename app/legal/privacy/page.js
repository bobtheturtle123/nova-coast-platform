import { permanentRedirect } from "next/navigation";

// Canonical privacy policy now lives at /privacy. This legacy path 308-redirects there.
export default function LegalPrivacyRedirect() {
  permanentRedirect("/privacy");
}
