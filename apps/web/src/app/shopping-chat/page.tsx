import { redirect } from "next/navigation";

export default async function ShoppingChatPage({ searchParams }: { searchParams: Promise<{ listing?: string }> }) {
  const { listing } = await searchParams;
  const query = new URLSearchParams({ chat: "open" });
  if (typeof listing === "string" && listing.length <= 80) query.set("listing", listing);
  redirect(`/?${query}`);
}
