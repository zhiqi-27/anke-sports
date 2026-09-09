import type { Metadata } from "next";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anke Sports · 你的体育日历",
  description: "关注你热爱的球队，把比赛与原始观看链接带进日历。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
