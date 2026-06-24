'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getProject } from '@/lib/projects'
import { getVersions, addVersion } from '@/lib/versions'
import { getComments, toggleResolve, addComment, formatTimecode } from '@/lib/comments'
import { Project, Version, Comment } from '@/types'
import AppHeader from '@/components/ui/AppHeader'

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [project, setProject] = useState<Project | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'assets' | 'versions'>('assets')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<'url' | 'pass' | null>(null)
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)

  const loadData = async () => {
    const [p, v, c] = await Promise.all([
      getProject(projectId),
      getVersions(projectId),
      getComments(projectId),
    ])
    setProject(p)
    setVersions(v)
    setComments(c)
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return }
      await loadData()
      setLoading(false)
    })
    return () => unsub()
  }, [projectId, router])

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const t = Math.floor(videoRef.current.currentTime)
    const topLevel = comments.filter(c => !c.parentId)
    const nearby = topLevel.find(c => Math.abs(c.timecode - t) <= 2)
    if (nearby) {
      if (nearby.id !== activeCommentId) {
        setActiveCommentId(nearby.id)
        const el = commentRefs.current[nearby.id]
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    } else {
      setActiveCommentId(null)
    }
  }

  const currentVersion = versions.find(v => v.id === project?.currentVersionId) ?? versions[0]

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !project) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const key = `videos/${projectId}/${Date.now()}_${file.name}`
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, contentType: file.type }),
      })
      const { url } = await res.json()
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => resolve()
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.open('PUT', url)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
      const videoUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`
      const versionNumber = versions.length + 1
      const label = versionNumber === 1 ? '初稿' : `修正版${versionNumber - 1}`
      await addVersion(projectId, videoUrl, key, label, versionNumber)
      await loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleToggleResolve = async (comment: Comment) => {
    await toggleResolve(projectId, comment.id, !comment.resolved)
    await loadData()
  }

  const handleReply = async (parentComment: Comment) => {
    const text = replyText[parentComment.id]
    if (!text?.trim()) return
    await addComment(projectId, parentComment.versionId, parentComment.timecode, text, '編集者', 'editor', parentComment.id)
    setReplyText(prev => ({ ...prev, [parentComment.id]: '' }))
    setReplyOpen(prev => ({ ...prev, [parentComment.id]: false }))
    await loadData()
  }

  const copyToClipboard = async (text: string, type: 'url' | 'pass') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const reviewUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/review/${projectId}`
    : `/review/${projectId}`

  const statusLabel: Record<string, string> = {
    draft: '下書き', reviewing: '確認待ち', approved: '承認済み', completed: '完了',
  }
  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500',
    reviewing: 'bg-amber-50 text-amber-600',
    approved: 'bg-green-50 text-green-600',
    completed: 'bg-blue-50 text-blue-600',
  }

  const topLevelComments = comments.filter(c => !c.parentId)
  const getReplies = (commentId: string) => comments.filter(c => c.parentId === commentId)
  const unresolvedCount = topLevelComments.filter(c => !c.resolved).length
  const sentRounds = Array.from(
    new Set(topLevelComments.filter(c => c.revisionRound !== null).map(c => c.revisionRound!))
  ).sort((a, b) => a - b)
  const unsentComments = topLevelComments.filter(c => c.role === 'client' && c.revisionRound === null)

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    </div>
  )

  if (!project) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">案件が見つかりません</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppHeader />

      {/* サブヘッダー */}
      <div className="bg-white border-b border-gray-100 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">{project.title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[project.status]}`}>
            {statusLabel[project.status]}
          </span>
          <span className="text-xs text-gray-400">
            {project.clientName} · Ver.{currentVersion?.versionNumber ?? '-'} · 修正 {project.revisionCount}/{project.revisionLimit}回
          </span>
        </div>
        <label className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-700'}`}>
          {uploading ? (
            <>
              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {uploadProgress > 0 ? `${uploadProgress}%` : 'アップロード中'}
            </>
          ) : '+ 動画をアップロード'}
          <input type="file" accept="video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {uploading && uploadProgress > 0 && (
        <div className="h-0.5 bg-gray-100">
          <div className="h-full bg-gray-900 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      <div className="flex flex-1" style={{ minHeight: 0 }}>
        {/* 左：動画エリア */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
          <div className="bg-gray-100 p-3" style={{ minHeight: '55vh' }}>
            <div className="bg-black rounded-lg overflow-hidden" style={{ height: '55vh' }}>
              {currentVersion ? (
                <video
                  ref={videoRef}
                  src={currentVersion.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  onTimeUpdate={handleTimeUpdate}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-gray-500 text-sm mb-3">動画がまだアップロードされていません</p>
                    <label className="cursor-pointer text-xs text-white border border-white/40 px-3 py-1.5 rounded-lg hover:bg-white/10">
                      動画を選択
                      <input type="file" accept="video/*" className="hidden" onChange={handleUpload} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex border-b border-gray-100 bg-white">
            <button
              onClick={() => setActiveTab('assets')}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === 'assets' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              素材・指示
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 transition-colors ${activeTab === 'versions' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              バージョン履歴
            </button>
          </div>

          <div className="flex-1 p-5 bg-white overflow-y-auto">
            {activeTab === 'assets' && (
              <div>
                <p className="text-xs text-gray-400 mb-3">素材・指示ファイル</p>
                <label className="flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-gray-300 transition-colors">
                  <p className="text-xs text-gray-400">クリックしてファイルを追加</p>
                  <input type="file" className="hidden" />
                </label>
              </div>
            )}
            {activeTab === 'versions' && (
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl bg-gray-50/50">
                    <div>
                      <span className="text-xs font-medium text-gray-800">Ver.{v.versionNumber} {v.label}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{v.uploadedAt?.toLocaleDateString('ja-JP')}</p>
                    </div>
                    {v.id === project.currentVersionId && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">最新</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右：コメントサイドバー */}
        <div className="w-96 bg-white flex flex-col overflow-hidden">
          {/* コメントヘッダー */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">コメント</span>
              <span className="text-xs text-gray-400">{topLevelComments.length}件</span>
            </div>
            {unresolvedCount > 0 && (
              <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">未対応 {unresolvedCount}</span>
            )}
          </div>

          {/* コメントリスト */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4" style={{ minHeight: 0 }}>
            {topLevelComments.length === 0 && (
              <div className="flex items-center justify-center h-20">
                <p className="text-xs text-gray-300">コメントはまだありません</p>
              </div>
            )}

            {sentRounds.map(round => {
              const roundComments = topLevelComments.filter(c => c.revisionRound === round)
              return (
                <div key={round} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">第{round}回修正</span>
                    <div className="flex-1 border-t border-gray-100" />
                    <span className="text-xs text-gray-300">{roundComments.length}件</span>
                  </div>
                  {roundComments.map(comment => {
                    const replies = getReplies(comment.id)
                    const isActive = comment.id === activeCommentId
                    return (
                      <div key={comment.id} ref={el => { commentRefs.current[comment.id] = el }}>
                  <div className={`rounded-xl p-3 transition-all duration-200 border ${
                    isActive
                      ? 'border-purple-300 bg-purple-50/60'
                      : comment.resolved
                        ? 'border-gray-100 bg-gray-50/50 opacity-50'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <button
                        onClick={() => { videoRef.current && (videoRef.current.currentTime = comment.timecode) }}
                        className={`font-mono text-xs rounded-md px-2 py-0.5 transition-colors ${
                          isActive ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                        }`}
                      >
                        {formatTimecode(comment.timecode)}
                      </button>
                      <span className="text-xs text-gray-400 flex-1 truncate">{comment.authorName}</span>
                      {isActive && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">再生中</span>}
                      {comment.resolved && !isActive && <span className="text-xs bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full">完了</span>}
                    </div>
                    <p className={`text-xs leading-relaxed mb-2 ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                      {comment.text}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleToggleResolve(comment)}
                        className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${
                          comment.resolved
                            ? 'border-orange-200 text-orange-500 hover:bg-orange-50'
                            : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                      >
                        {comment.resolved ? '未完に戻す' : '完了にする'}
                      </button>
                      <button
                        onClick={() => setReplyOpen(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
                        className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                      >
                        返信
                      </button>
                    </div>
                    {replyOpen[comment.id] && (
                      <div className="mt-2 flex gap-1.5">
                        <input
                          value={replyText[comment.id] ?? ''}
                          onChange={e => setReplyText(prev => ({ ...prev, [comment.id]: e.target.value }))}
                          placeholder="返信を入力..."
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400"
                          onKeyDown={e => { if (e.key === 'Enter') handleReply(comment) }}
                        />
                        <button
                          onClick={() => handleReply(comment)}
                          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                          送信
                        </button>
                      </div>
                    )}
                  </div>

                  {replies.length > 0 && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-100 pl-3">
                      {replies.map(reply => (
                        <div key={reply.id} className="rounded-lg p-2.5 bg-gray-50 border border-gray-100">
                          <span className={`text-xs font-medium ${reply.role === 'editor' ? 'text-blue-500' : 'text-gray-400'}`}>
                            {reply.authorName}{reply.role === 'editor' ? '（編集者）' : ''}
                          </span>
                          <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{reply.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                    )
                  })}
                </div>
              )
            })}

            {unsentComments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">未送信</span>
                  <div className="flex-1 border-t border-gray-100" />
                  <span className="text-xs text-gray-300">{unsentComments.length}件</span>
                </div>
                {unsentComments.map(comment => {
                  const replies = getReplies(comment.id)
                  const isActive = comment.id === activeCommentId
                  return (
                    <div key={comment.id} ref={el => { commentRefs.current[comment.id] = el }}>
                      <div className={`rounded-xl p-3 transition-all duration-200 border ${isActive ? 'border-purple-300 bg-purple-50/60' : comment.resolved ? 'border-gray-100 bg-gray-50/50 opacity-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <button onClick={() => { videoRef.current && (videoRef.current.currentTime = comment.timecode) }} className={`font-mono text-xs rounded-md px-2 py-0.5 transition-colors ${isActive ? 'bg-purple-500 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}>{formatTimecode(comment.timecode)}</button>
                          <span className="text-xs text-gray-400 flex-1 truncate">{comment.authorName}</span>
                          {isActive && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">再生中</span>}
                          {comment.resolved && !isActive && <span className="text-xs bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full">完了</span>}
                        </div>
                        <p className={`text-xs leading-relaxed mb-2 ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>{comment.text}</p>
                        <div className="flex gap-1.5">
                          <button onClick={() => handleToggleResolve(comment)} className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors ${comment.resolved ? 'border-orange-200 text-orange-500 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>{comment.resolved ? '未完に戻す' : '完了にする'}</button>
                          <button onClick={() => setReplyOpen(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))} className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">返信</button>
                        </div>
                        {replyOpen[comment.id] && (
                          <div className="mt-2 flex gap-1.5">
                            <input value={replyText[comment.id] ?? ''} onChange={e => setReplyText(prev => ({ ...prev, [comment.id]: e.target.value }))} placeholder="返信を入力..." className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-400" onKeyDown={e => { if (e.key === 'Enter') handleReply(comment) }} />
                            <button onClick={() => handleReply(comment)} className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors">送信</button>
                          </div>
                        )}
                      </div>
                      {replies.length > 0 && (
                        <div className="ml-4 mt-1.5 space-y-1.5 border-l-2 border-gray-100 pl-3">
                          {replies.map(reply => (
                            <div key={reply.id} className="rounded-lg p-2.5 bg-gray-50 border border-gray-100">
                              <span className={`text-xs font-medium ${reply.role === 'editor' ? 'text-blue-500' : 'text-gray-400'}`}>{reply.authorName}{reply.role === 'editor' ? '（編集者）' : ''}</span>
                              <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 共有情報フッター */}
          <div className="border-t border-gray-100 p-4 space-y-2.5 bg-gray-50/50">
            <p className="text-xs font-medium text-gray-500">クライアント共有</p>
            <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-gray-400 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{reviewUrl}</span>
              <button
                onClick={() => copyToClipboard(reviewUrl, 'url')}
                className={`text-xs font-medium px-2 py-0.5 rounded transition-colors whitespace-nowrap ${copied === 'url' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {copied === 'url' ? '✓ コピー済み' : 'コピー'}
              </button>
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-300">🔒</span>
              <span className="font-mono text-xs text-gray-700 tracking-widest flex-1">{project.password}</span>
              <button
                onClick={() => copyToClipboard(project.password, 'pass')}
                className={`text-xs font-medium px-2 py-0.5 rounded transition-colors whitespace-nowrap ${copied === 'pass' ? 'text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                {copied === 'pass' ? '✓ コピー済み' : 'コピー'}
              </button>
            </div>
            <p className="text-xs text-gray-400">✉ 承認時にメール通知が届きます</p>
          </div>
        </div>
      </div>
    </div>
  )
}
