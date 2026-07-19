import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Personal Daily",
  description: "A private, daily edition made for one reader.",
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
