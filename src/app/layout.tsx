import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppLogo } from '@/components/shared/AppLogo';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Telemed Consult',
  description: 'Secure telehealth video consultation platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans flex flex-col min-h-screen`}>
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 max-w-screen-2xl items-center">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <AppLogo className="h-6 w-6" />
              <span className="font-bold sm:inline-block">
                Telemed Consult
              </span>
            </Link>
            {/* Add navigation items here if needed */}
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
