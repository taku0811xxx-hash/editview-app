import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '動画レビューツール',
  description: '動画編集者とクライアントの確認ツール',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
