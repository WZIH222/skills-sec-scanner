import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { HomePageHeader } from '@/components/layout/HomePageHeader'

export default async function HomePage() {
  const t = await getTranslations('Home')

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <HomePageHeader />

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
            {t('tagline')}
          </div>

          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            {t('heroTitle')}
          </h2>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            {t('heroDesc')}
          </p>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Link
              href="/register"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-medium"
            >
              {t('startScanning')}
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 bg-white text-gray-900 rounded-lg hover:bg-gray-50 transition-colors text-lg font-medium border"
            >
              {t('learnMore')}
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mb-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">&lt;5%</div>
              <div className="text-sm text-gray-600">{t('falsePositiveRate')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">&lt;30s</div>
              <div className="text-sm text-gray-600">{t('avgScanTime')}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">AI+</div>
              <div className="text-sm text-gray-600">{t('aiEnhanced')}</div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div id="features" className="max-w-5xl mx-auto">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            {t('featuresTitle')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white rounded-xl border shadow-sm">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('staticAnalysis')}</h4>
              <p className="text-gray-600">
                {t('staticAnalysisDesc')}
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border shadow-sm">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('aiDetection')}</h4>
              <p className="text-gray-600">
                {t('aiDetectionDesc')}
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">{t('dataFlow')}</h4>
              <p className="text-gray-600">
                {t('dataFlowDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="max-w-4xl mx-auto mt-16 text-center">
          <div className="p-8 bg-blue-600 rounded-2xl text-white">
            <h3 className="text-2xl font-bold mb-4">{t('ctaTitle')}</h3>
            <p className="text-blue-100 mb-6">
              {t('ctaDesc')}
            </p>
            <Link
              href="/register"
              className="inline-block px-8 py-4 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-lg font-medium"
            >
              {t('getStarted')}
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p>&copy; 2025 {t('copyright')}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}