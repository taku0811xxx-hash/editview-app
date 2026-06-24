'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'

function EditviewLogo() {
  return (
    <svg width="100" height="28" viewBox="0 0 110 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Editview">
      <rect width="28" height="28" x="0" y="2" rx="6" fill="#111"/>
      <rect x="3" y="6"  width="4" height="5" rx="1.2" fill="white"/>
      <rect x="3" y="15" width="4" height="5" rx="1.2" fill="white"/>
      <rect x="3" y="23" width="4" height="3" rx="1.2" fill="white"/>
      <rect x="21" y="6"  width="4" height="5" rx="1.2" fill="white"/>
      <rect x="21" y="15" width="4" height="5" rx="1.2" fill="white"/>
      <rect x="21" y="23" width="4" height="3" rx="1.2" fill="white"/>
      <rect x="9" y="7" width="10" height="18" rx="2" fill="white"/>
      <text x="34" y="22" fontFamily="Georgia,serif" fontSize="18" fontWeight="700" fill="#111" letterSpacing="-0.5">edit</text>
      <text x="66" y="22" fontFamily="Georgia,serif" fontSize="18" fontWeight="400" fill="#999" letterSpacing="-0.5">view</text>
    </svg>
  )
}

export default function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/login')
  }

  const navItems = [
    { label: 'ダッシュボード', href: '/dashboard' },
    { label: '新規案件', href: '/projects/new' },
    { label: '設定', href: '/settings' },
  ]

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/projects/new') return pathname === '/projects/new'
    if (href === '/settings') return pathname === '/settings'
    return false
  }

  return (
    <header className="bg-white border-b border-gray-100 h-12 flex items-center px-6">
      <div className="flex items-center gap-6 flex-1">
        <Link href="/dashboard" className="shrink-0">
          <EditviewLogo />
        </Link>
        <div className="w-px h-4 bg-gray-200" />
        <nav className="flex items-center gap-0.5">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActive(item.href)
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <button
        onClick={handleLogout}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        ログアウト
      </button>
    </header>
  )
}
