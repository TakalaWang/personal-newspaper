import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codex Reporter",
  description: "Codex Reporter is a private daily newspaper researched and edited for one reader.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
