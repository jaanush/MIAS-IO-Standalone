import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import TrpcProvider from "./_trpc/TrpcProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/app-header";
import { CommandPalette } from "@/components/command-palette";
import { VersionCheck } from "@/components/version-check";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { getSession } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MIAS-IO",
  description: "PLC I/O Configuration Editor",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NuqsAdapter>
            <TrpcProvider>
              <div className="aurora-bg dark:block hidden" aria-hidden="true" />
              <div className="relative z-10 flex h-screen flex-col overflow-hidden">
                {session && <AppHeader user={session} />}
                {session && <CommandPalette />}
                <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
              </div>
            </TrpcProvider>
          </NuqsAdapter>
          <Toaster richColors closeButton position="bottom-right" />
          <VersionCheck />
        </ThemeProvider>
      </body>
    </html>
  );
}
