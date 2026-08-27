import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bosch Baking Outreach",
  description: "Prospect research, drafting, and outreach for Bosch Baking wholesale sales.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-[#1a1a1a]">{children}</body>
    </html>
  );
}
