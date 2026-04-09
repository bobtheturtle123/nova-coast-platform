import { redirect } from "next/navigation";

export default function TenantRootPage({ params }) {
  redirect(`/${params.slug}/book`);
}
