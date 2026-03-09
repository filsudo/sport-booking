import type { Metadata } from 'next'
import { JetBrains_Mono, Manrope } from 'next/font/google'
import './globals.css'
import { Header, Footer } from '@/components/layout/Navigation'
import { LanguageProvider } from '@/components/layout/LanguageProvider'
import { Toaster } from 'react-hot-toast'
import { siteConfig } from '@/lib/config/site'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: siteConfig.brand.title,
  description: siteConfig.brand.description,
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%232563eb" width="100" height="100" rx="20"/><text x="50" y="70" font-size="60" font-weight="bold" fill="white" text-anchor="middle">SB</text></svg>',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${jetbrainsMono.variable} min-h-screen overflow-x-hidden bg-gray-50 text-gray-900 antialiased`}>
        <LanguageProvider>
          <Header />
          <main className="animate-page-enter min-h-[calc(100vh-64px)] overflow-x-hidden">{children}</main>
          <Footer />
          <Toaster position="top-center" />
        </LanguageProvider>
      </body>
    </html>
  )
}
