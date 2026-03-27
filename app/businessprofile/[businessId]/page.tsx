import { redirect } from "next/navigation";

export default async function BusinessProfileRedirect({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businessprofile-v2/${businessId}`);
}
