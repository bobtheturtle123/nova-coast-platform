import { permanentRedirect } from "next/navigation";

// Canonical cookie policy now lives at /cookies. This legacy path 308-redirects there.
export default function LegalCookiesRedirect() {
  permanentRedirect("/cookies");
}
