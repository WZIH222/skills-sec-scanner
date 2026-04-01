'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'

const navLinks = [
  { href: '/dashboard', labelKey: 'nav.dashboard' },
  { href: '/scan', labelKey: 'nav.scan' },
  { href: '/scans', labelKey: 'nav.history' },
  { href: '/settings', labelKey: 'nav.settings' },
]

export function AppHeader() {
  const pathname = usePathname()
  const locale = useLocale()
  const t = useTranslations('AppHeader')

  const toggleLanguage = async () => {
    const newLocale = locale === 'en' ? 'zh' : 'en'
    // Set cookie and reload page to apply new locale
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-gray-900">Skills Security Scanner</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-gray-900",
                  pathname === link.href
                    ? "text-primary"
                    : "text-gray-600"
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}

            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="flex items-center gap-1"
              title={t('language')}
            >
              {locale === 'en' ? 'EN' : '中'}
            </Button>

            {/* Logout - POST form for security */}
            <form action="/api/auth/logout" method="POST">
              <Button type="submit" variant="ghost" size="sm" className="flex items-center gap-1">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{t('logout')}</span>
              </Button>
            </form>
          </nav>
        </div>
      </div>
    </header>
  )
}