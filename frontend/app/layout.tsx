import "./globals.css";
import type {Metadata} from "next";
import {ReactNode} from "react";

import {AppQueryProvider} from "@/components/query-provider";

export const metadata: Metadata = {
  title: "Portfolio Analytics",
  description: "Real-time portfolio analytics dashboard",
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body>
        <AppQueryProvider>{children}</AppQueryProvider>
      </body>
    </html>
  );
}
