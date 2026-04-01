import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { cookies } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skills Security Scanner (S3)',
  description: 'Detect security threats in AI Skills files',
};

export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get locale from cookie (default to 'en')
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en';

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="font-sans">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}