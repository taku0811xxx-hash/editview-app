'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import AppHeader from '@/components/ui/AppHeader'

export default function SettingsPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      setUid(user.uid)
      setEmail(user.email ?? '')
      const snap = await getDoc(doc(db, 'editors', user.uid))
      if (snap.exists()) setDisplayName(snap.data().displayName ?? '')
    })
    return () => unsub()
  }, [router])

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uid) return
    setSaving(true)
    setMessage(null)
    try {
      await updateDoc(doc(db, 'editors', uid), { displayName })
      setMessage({ type: 'success', text: '表示名を保存しました' })
    } catch {
      setMessage({ type: 'error', text: '保存に失敗しました' })
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const user = auth.currentUser
    if (!user || !user.email) return
    setSaving(true)
    setMessage(null)
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setMessage({ type: 'success', text: 'パスワードを変更しました' })
    } catch {
      setMessage({ type: 'error', text: '現在のパスワードが正しくありません' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-lg font-medium text-gray-900 mb-8">プロフィール設定</h1>
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-900 mb-5">基本情報</h2>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">メールアドレス</label>
                <input type="text" value={email} disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">表示名</label>
                <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="例: 編集者名を入力" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
                <p className="text-xs text-gray-400 mt-1.5">コメント返信時に表示される名前です</p>
              </div>
              <button type="submit" disabled={saving} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存する'}
              </button>
            </form>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-900 mb-5">パスワード変更</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">現在のパスワード</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">新しいパスワード</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" minLength={6} required />
              </div>
              <button type="submit" disabled={saving} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                {saving ? '変更中...' : 'パスワードを変更する'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
