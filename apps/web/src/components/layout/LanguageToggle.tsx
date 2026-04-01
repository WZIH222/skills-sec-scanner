'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export function LanguageToggle() {
  const locale = useLocale()
  const t = useTranslations('AppHeader')

  const toggleLanguage = () => {
    const newLocale = locale === 'en' ? 'zh' : 'en'
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="flex items-center gap-1"
      title={t('language')}
    >
      {locale === 'en' ? 'EN' : '中'}
    </Button>
  )
}