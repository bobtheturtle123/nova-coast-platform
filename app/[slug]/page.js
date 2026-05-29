import { permanentRedirect } from "next/navigation";

export default function TenantRootPage({ params }) {
  permanentRedirect(`/${params.slug}/book`);
}
