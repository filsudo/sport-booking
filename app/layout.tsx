import type { Metadata } from 'next'
import './globals.css'
import { Header, Footer } from '@/components/layout/Navigation'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'SportBook - Rezervačný systém športového centra',
  description: 'Rezervujte si kurt, stôl alebo tréning online.',
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
    <html lang="sk">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <Header />
        <main className="animate-page-enter min-h-[calc(100vh-64px)]">{children}</main>
        <Footer />
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
