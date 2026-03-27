import './globals.css';
import type {Metadata} from 'next';
import {ReactNode} from 'react';

import GitHubRepoLink from '@/components/GitHubRepoLink';
import QueryProvider from '@/components/QueryProvider';

export const metadata: Metadata = {
  title: 'Portfolio Analytics',
  description: 'Real-time portfolio analytics dashboard',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({children}: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <GitHubRepoLink />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
