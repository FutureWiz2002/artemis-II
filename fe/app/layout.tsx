import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artemis II Lunar Passage",
  description: "A 3D Artemis II mission experience with Earth, Moon, and Orion context.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
