'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import PolicySelector from '@/components/settings/PolicySelector'
import FalsePositivesList from '@/components/settings/FalsePositivesList'
import RulesList from '@/components/rules/RulesList'
import AIConfigForm from '@/components/settings/AIConfigForm'
import PasswordChangeForm from '@/components/settings/PasswordChangeForm'
import { LanguageSelector } from '@/components/settings/LanguageSelector'
import { Loader2 } from 'lucide-react'
import { AppHeader } from '@/components/layout'
import { useTranslations } from 'next-intl'

interface User {
  userId: string
  email: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const t = useTranslations('Settings')

  useEffect(() => {
    // Check auth status
    fetch('/api/auth/session')
      .then(res => {
        if (!res.ok) {
          router.push('/login')
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data && data.user) {
          setUser({
            userId: data.user.id,
            email: data.user.email,
          })
        }
        setLoading(false)
      })
      .catch(() => {
        router.push('/login')
        setLoading(false)
      })
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      <AppHeader />
      <div className="container mx-auto py-8 max-w-5xl">
        {/* Breadcrumb - now secondary navigation */}
        <nav className="flex mb-6 text-sm text-muted-foreground">
        <ol className="flex items-center space-x-2">
          <li><a href="/" className="hover:text-foreground">{t('home')}</a></li>
          <li>/</li>
          <li className="text-foreground font-medium">{t('title')}</li>
        </ol>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <Tabs defaultValue="policy" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="policy">{t('tabs.policy')}</TabsTrigger>
          <TabsTrigger value="false-positives">{t('tabs.falsePositives')}</TabsTrigger>
          <TabsTrigger value="rules">{t('tabs.rules')}</TabsTrigger>
          <TabsTrigger value="account">{t('tabs.account')}</TabsTrigger>
        </TabsList>

        {/* Security Policy Tab */}
        <TabsContent value="policy" className="space-y-6">
          <PolicySelector onSuccess={() => {
            // Optionally refresh page or show success message
          }} />

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">{t('systemStatus')}</h3>
              <div className="space-y-3">
                <AIConfigForm />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('scanRetention')}</span>
                  <span className="text-sm font-medium">90 {t('days')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* False Positives Tab */}
        <TabsContent value="false-positives" className="space-y-6">
          <FalsePositivesList userId={user.userId} />

          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-2">{t('addNewExclusion')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('addNewExclusionDesc')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-6">
          <RulesList userId={user.userId} />
        </TabsContent>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">{t('profileInformation')}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('profileInfoDesc')}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('email')}</label>
                  <p className="text-sm">{user.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('userId')}</label>
                  <p className="text-sm font-mono">{user.userId}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">{t('language')}</h3>
              <LanguageSelector />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h3 className="text-lg font-semibold">{t('accountActions')}</h3>
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md text-sm font-medium transition-colors"
              >
                {t('logout')}
              </button>
            </CardContent>
          </Card>

          <PasswordChangeForm />
        </TabsContent>
      </Tabs>
      </div>
    </>
  )
}
