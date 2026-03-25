import "./globals.css";
import type {Metadata} from "next";
import {ReactNode} from "react";

import QueryProvider from "@/components/query-provider";

export const metadata: Metadata = {
  title: "Portfolio Analytics",
  description: "Real-time portfolio analytics dashboard",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({children}: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
