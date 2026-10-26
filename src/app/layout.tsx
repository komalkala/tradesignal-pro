import "./globals.css";
import type { Metadata } from "next";
import AppNavigation from "@/components/AppNavigation";

export const metadata: Metadata = {
  title: "TradeSignal Pro | Trading Research",
  description: "Crypto futures trading research, market context and paper signals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
