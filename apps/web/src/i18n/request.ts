import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { cookies } from 'next/headers';
import routing from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // Get locale from cookie first, then from request, then default to 'en'
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

  let locale = await requestLocale;

  // Validate locale - use cookie if valid, otherwise use request, otherwise default
  if (cookieLocale && hasLocale(routing.locales, cookieLocale)) {
    locale = cookieLocale;
  } else if (locale && hasLocale(routing.locales, locale)) {
    // locale is already valid from requestLocale
  } else {
    locale = 'en';
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});