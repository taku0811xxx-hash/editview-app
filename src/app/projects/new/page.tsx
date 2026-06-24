'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { createProject } from '@/lib/projects'
import AppHeader from '@/components/ui/AppHeader'

export default function NewProjectPage() {
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [revisionLimit, setRevisionLimit] = useState(3)
  const [loading, setLoading] = useState(false)
  const [editorId, setEditorId] = useState<string | null>(null)
  const [editorEmail, setEditorEmail] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) { router.push('/login'); return }
      setEditorId(user.uid)
      setEditorEmail(user.email ?? '')
    })
    return () => unsub()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editorId) return
    setLoading(true)
    try {
      const { id } = await createProject(editorId, editorEmail, title, clientName, revisionLimit)
      router.push(`/projects/${id}`)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-lg font-medium text-gray-900">新規案件作成</h1>
          <p className="text-sm text-gray-400 mt-1">案件情報を入力してください</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">案件名</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="例: 株式会社○○ VP動画"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">クライアント名</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="例: 株式会社○○ 田中様"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">修正回数（契約上限）</label>
              <div className="flex items-center gap-3">
                <select
                  value={revisionLimit}
                  onChange={e => setRevisionLimit(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                >
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <option key={n} value={n}>{n}回</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400">上限を超えた修正は追加料金の対象となります</p>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-4">作成後、パスワードが自動生成されます。クライアントへの共有リンクと一緒に伝えてください。</p>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {loading ? '作成中...' : '案件を作成する'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
