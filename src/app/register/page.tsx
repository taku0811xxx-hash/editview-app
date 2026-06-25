'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import Link from 'next/link'

type Phase = 'register' | 'verify'

export default function RegisterPage() {
  const [phase, setPhase] = useState<Phase>('register')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== passwordConfirm) {
      setError('パスワードが一致しません')
      return
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)

      // メール認証を送信
      await sendEmailVerification(user)

      // Firestoreにeditorデータを保存
      await setDoc(doc(db, 'editors', user.uid), {
        displayName,
        email,
        createdAt: serverTimestamp(),
      })

      setPhase('verify')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setError('このメールアドレスはすでに登録されています')
      } else if (code === 'auth/invalid-email') {
        setError('メールアドレスの形式が正しくありません')
      } else {
        setError('登録に失敗しました。もう一度お試しください')
      }
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-blue-600 text-xl">✉</span>
          </div>
          <h1 className="text-base font-medium text-gray-900 mb-2">確認メールを送信しました</h1>
          <p className="text-sm text-gray-500 mb-6">
            <span className="font-medium text-gray-700">{email}</span> に確認メールを送りました。メール内のリンクをクリックして登録を完了してください。
          </p>
          <Link
            href="/login"
            className="block w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            ログイン画面へ
          </Link>
          <p className="text-xs text-gray-400 mt-4">メールが届かない場合はスパムフォルダをご確認ください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <svg width="80" height="22" viewBox="0 0 110 32" fill="none">
              <rect width="28" height="28" x="0" y="2" rx="6" fill="#111"/>
              <rect x="3" y="6" width="4" height="5" rx="1.2" fill="white"/>
              <rect x="3" y="15" width="4" height="5" rx="1.2" fill="white"/>
              <rect x="3" y="23" width="4" height="3" rx="1.2" fill="white"/>
              <rect x="21" y="6" width="4" height="5" rx="1.2" fill="white"/>
              <rect x="21" y="15" width="4" height="5" rx="1.2" fill="white"/>
              <rect x="21" y="23" width="4" height="3" rx="1.2" fill="white"/>
              <rect x="9" y="7" width="10" height="18" rx="2" fill="white"/>
              <text x="34" y="22" fontFamily="Georgia,serif" fontSize="18" fontWeight="700" fill="#111" letterSpacing="-0.5">edit</text>
              <text x="66" y="22" fontFamily="Georgia,serif" fontSize="18" fontWeight="400" fill="#999" letterSpacing="-0.5">view</text>
            </svg>
          </div>
          <h1 className="text-base font-medium text-gray-900">アカウント作成</h1>
          <p className="text-xs text-gray-400 mt-1">動画編集者向けクライアント確認ツール</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">表示名</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="例: 編集者名を入力"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">パスワード（6文字以上）</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">パスワード（確認）</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              required
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-950 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? '登録中...' : 'アカウントを作成する'}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-5">
          すでにアカウントをお持ちの方は
          <Link href="/login" className="text-gray-700 underline underline-offset-2 ml-1">ログイン</Link>
        </p>
      </div>
    </div>
  )
}
