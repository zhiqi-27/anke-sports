import type { Metadata } from "next";
import { ConnectionConsent } from "@/components/connections";

export const metadata: Metadata = {
  title: "连接应用 · Anke Sports",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConnectPage() {
  return <ConnectionConsent />;
}
