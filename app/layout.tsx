import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/i18n/language-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaseFlow AI",
  description: "CaseFlow AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
