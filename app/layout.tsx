import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cortex — Global Company Context",
  description:
    "Shared real-time AI context across every department. One for all.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
