'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getEditorProjects } from '@/lib/projects'
import { Project } from '@/types'
import Link from 'next/link'
import AppHeader from '@/components/ui/AppHeader'

const statusLabel: Record<string, string> = {
  draft: '下書き', reviewing: '確認待ち', approved: '承認済み', completed: '完了',
}
const statusColor: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  reviewing: 'bg-amber-50 text-amber-600',
  approved: 'bg-green-50 text-green-600',
  completed: 'bg-blue-50 text-blue-600',
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      const data = await getEditorProjects(user.uid)
      setProjects(data)
      setLoading(false)
    })
    return () => unsub()
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-base font-medium text-gray-900">案件一覧</h1>
            <p className="text-xs text-gray-400 mt-0.5">{projects.length}件</p>
          </div>
          <Link
            href="/projects/new"
            className="bg-gray-900 text-white text-xs px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            + 新規案件
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
            <p className="text-gray-400 text-sm mb-3">案件がまだありません</p>
            <Link href="/projects/new" className="text-xs text-gray-900 underline underline-offset-2">
              最初の案件を作成する
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-5 py-4 hover:border-gray-200 hover:bg-gray-50/50 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{project.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor[project.status]}`}>
                        {statusLabel[project.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{project.clientName}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xs text-gray-400">{project.createdAt?.toLocaleDateString('ja-JP')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">修正 {project.revisionCount}/{project.revisionLimit}回</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
