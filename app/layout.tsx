import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { fallbackLanguage, isSupportedLanguageCode, LANGUAGE_STORAGE_KEY, type SupportedLanguageCode } from "@/lib/i18n/config";
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
  return RootLayoutContent({ children });
}

async function RootLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieLanguage = await readCookieLanguage();

  return (
    <html lang={cookieLanguage} suppressHydrationWarning>
      <body>
        <LanguageProvider initialLanguage={cookieLanguage}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}

async function readCookieLanguage(): Promise<SupportedLanguageCode> {
  const cookieValue = (await cookies()).get(LANGUAGE_STORAGE_KEY)?.value;
  return isSupportedLanguageCode(cookieValue) ? cookieValue : fallbackLanguage;
}
