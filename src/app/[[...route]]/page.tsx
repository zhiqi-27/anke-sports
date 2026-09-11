import { Dashboard } from "@/components/dashboard";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return [
    [],
    ["calendar"],
    ["following"],
    ["creators"],
    ["subscription"],
    ["settings"],
    ["maintenance"],
  ].map((route) => ({ route }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ route?: string[] }>;
}) {
  const route = (await params).route?.join("/") || "calendar";
  if (
    ![
      "calendar",
      "following",
      "creators",
      "subscription",
      "settings",
      "maintenance",
    ].includes(route)
  )
    notFound();
  return <Dashboard page={route} />;
}
