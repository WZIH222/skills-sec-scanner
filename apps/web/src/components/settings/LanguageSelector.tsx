'use client'

import { useLocale } from 'next-intl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslations } from 'next-intl'

export function LanguageSelector() {
  const locale = useLocale()
  const t = useTranslations('Settings')

  const handleLanguageChange = (newLocale: string) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="text-sm font-medium text-muted-foreground">{t('language')}</label>
        <p className="text-sm text-muted-foreground">
          {locale === 'en' ? 'Select your preferred language' : '选择您的首选语言'}
        </p>
      </div>
      <Select value={locale} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={locale === 'en' ? 'English' : '中文'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
          <SelectItem value="zh">中文</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}