import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MederPay - Agent Management Platform",
  description: "Enterprise-grade platform for managing phone sales with tamper-proof enforcement and payment tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
