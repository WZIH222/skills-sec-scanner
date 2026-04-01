'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'

export function HomePageHeader() {
  const locale = useLocale()

  const toggleLanguage = () => {
    const newLocale = locale === 'en' ? 'zh' : 'en'
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S³</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Skills Security Scanner</h1>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            {locale === 'zh' ? '登录' : 'Login'}
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {locale === 'zh' ? '注册' : 'Sign Up'}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="flex items-center gap-1"
          >
            {locale === 'en' ? 'EN' : '中'}
          </Button>
        </nav>
      </div>
    </header>
  )
}