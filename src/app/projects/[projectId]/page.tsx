'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getProject, updateProjectStatus } from '@/lib/projects'
import { getVersions, addVersion } from '@/lib/versions'
import { getComments, toggleResolve, addComment, formatTimecode } from '@/lib/comments'
import { Project, Version, Comment } from '@/types'
import AppHeader from '@/components/ui/AppHeader'

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const commentRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [project, setProject] = useState<Project | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<'url' | 'pass' | null>(null)
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [commentFilter, setCommentFilter] = useState<'all' | 'unresolved' | 'resolved'>('all')
  const [commentSearch, setCommentSearch] = useState('')
  const [isJumpPlaying, setIsJumpPlaying] = useState(false)

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

    // 案内アラート
    const confirmed = window.confirm(
      '【アップロードの注意事項】\n\n' +
      '・確認用動画（720p推奨）をアップロードしてください\n' +
      '・ファイルサイズの上限は5GBです\n' +
      '・新しいバージョンをアップロードすると旧バージョンの動画は削除されます\n\n' +
      'このままアップロードしますか？'
    )
    if (!confirmed) {
      e.target.value = ''
      return
    }

    // ① ファイルサイズチェック（5GB上限）
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('ファイルサイズが5GBを超えています。確認用動画（720p推奨）をアップロードしてください。')
      return
    }

    // ② 1日あたりのアップロード回数チェック（10回/日）
    const uploadCountKey = `upload_count_${projectId}_${new Date().toDateString()}`
    const currentCount = parseInt(localStorage.getItem(uploadCountKey) ?? '0')
    if (currentCount >= 10) {
      setUploadError('1日のアップロード上限（10回）に達しました。翌日以降にお試しください。')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    try {
      const key = `videos/${projectId}/${Date.now()}_${file.name}`
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, contentType: file.type }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (data.error === 'storage_limit_exceeded') {
          setUploadError('現在ストレージ容量の上限に達しているため、アップロードできません。')
        } else {
          setUploadError('アップロードに失敗しました。')
        }
        return
      }
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
      // アップロード回数カウントを増やす
      const countKey = `upload_count_${projectId}_${new Date().toDateString()}`
      const count = parseInt(localStorage.getItem(countKey) ?? '0')
      localStorage.setItem(countKey, String(count + 1))
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

  const handleJumpPlay = () => {
    if (!videoRef.current) return
    const timecodes = topLevelComments
      .filter(c => c.role === 'client')
      .map(c => c.timecode)
      .sort((a, b) => a - b)
    if (timecodes.length === 0) return
    setIsJumpPlaying(true)
    let index = 0
    const jumpNext = () => {
      if (index >= timecodes.length) { setIsJumpPlaying(false); return }
      if (videoRef.current) {
        videoRef.current.currentTime = timecodes[index]
        videoRef.current.play()
        index++
        jumpTimerRef.current = setTimeout(() => {
          if (videoRef.current) videoRef.current.pause()
          setTimeout(jumpNext, 500)
        }, 3000)
      }
    }
    jumpNext()
  }

  const handleStopJumpPlay = () => {
    setIsJumpPlaying(false)
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
    if (videoRef.current) videoRef.current.pause()
  }

  const copyToClipboard = async (text: string, type: 'url' | 'pass') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const reviewUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/review/${projectId}`
    : `/review/${projectId}`

  const handleStatusChange = async (status: string) => {
    await updateProjectStatus(projectId, status as Project['status'])
    await loadData()
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    draft:     { label: '初稿',    color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400' },
    reviewing: { label: '確認待ち', color: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-500' },
    approved:  { label: '承認済み', color: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
    completed: { label: '納品完了', color: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-500' },
  }

  const topLevelComments = comments.filter(c => !c.parentId)
  const getReplies = (commentId: string) => comments.filter(c => c.parentId === commentId)
  const unresolvedCount = topLevelComments.filter(c => !c.resolved).length
  const resolvedCount = topLevelComments.filter(c => c.resolved).length

  const filteredTopLevel = topLevelComments.filter(c => {
    const matchesFilter = commentFilter === 'all' ? true : commentFilter === 'unresolved' ? !c.resolved : c.resolved
    const matchesSearch = commentSearch === '' ? true : c.text.includes(commentSearch) || c.authorName.includes(commentSearch)
    return matchesFilter && matchesSearch
  })
  const sentRounds = Array.from(
    new Set(filteredTopLevel.filter(c => c.revisionRound !== null).map(c => c.revisionRound!))
  ).sort((a, b) => a - b)
  const unsentComments = filteredTopLevel.filter(c => c.role === 'client' && c.revisionRound === null)

  if (loading) return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <AppHeader />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">読み込み中...</p>
      </div>
    </div>
  )

  if (!project) return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <AppHeader />
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">案件が見つかりません</p>
      </div>
    </div>
  )

  const sc = statusConfig[project.status] ?? statusConfig.draft

  // コメントカードコンポーネント（共通化）
  const CommentCard = ({ comment }: { comment: Comment }) => {
    const replies = getReplies(comment.id)
    const isActive = comment.id === activeCommentId
    return (
      <div ref={el => { commentRefs.current[comment.id] = el }} className="space-y-1">
        <div
          onClick={() => { if (videoRef.current) videoRef.current.currentTime = comment.timecode }}
          className={`rounded-xl p-4 border cursor-pointer transition-all duration-200 ${
            isActive
              ? 'border-purple-300 bg-purple-50/60 shadow-sm'
              : comment.resolved
                ? 'border-gray-100 bg-gray-50 opacity-50'
                : 'border-gray-200 bg-slate-50/80 hover:border-purple-200 hover:shadow-sm'
          }`}
        >
          {/* タイムコード＋名前＋日時 */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-mono text-xs font-bold rounded-lg px-2.5 py-1 transition-colors ${
              isActive ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700'
            }`}>
              {formatTimecode(comment.timecode)}
            </span>
            <span className="text-xs font-medium text-gray-600">{comment.authorName}</span>
            <span className="text-xs text-gray-400 ml-auto">
              {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
            {comment.resolved && !isActive && (
              <span className="text-xs bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full font-medium">対応済み</span>
            )}
            {isActive && (
              <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-medium">再生中</span>
            )}
          </div>

          {/* コメント本文 */}
          <p className={`text-sm leading-relaxed mb-3 ${isActive ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
            {comment.text}
          </p>

          {/* アクションボタン */}
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => handleToggleResolve(comment)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                comment.resolved
                  ? 'border-orange-200 text-orange-500 hover:bg-orange-50'
                  : 'border-green-200 text-green-600 hover:bg-green-50'
              }`}
            >
              {comment.resolved ? '未完に戻す' : '完了にする'}
            </button>
            <button
              onClick={() => setReplyOpen(prev => ({ ...prev, [comment.id]: !prev[comment.id] }))}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              返信
            </button>
          </div>

          {/* テンプレ返信＋入力 */}
          {replyOpen[comment.id] && (
            <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
              <div className="flex flex-wrap gap-1">
                {['承知しました', '対応済みです', '本日中に修正します', '確認しました'].map(t => (
                  <button
                    key={t}
                    onClick={() => setReplyText(prev => ({ ...prev, [comment.id]: t }))}
                    className="text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  value={replyText[comment.id] ?? ''}
                  onChange={e => setReplyText(prev => ({ ...prev, [comment.id]: e.target.value }))}
                  placeholder="返信を入力..."
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                  onKeyDown={e => { if (e.key === 'Enter') handleReply(comment) }}
                />
                <button onClick={() => handleReply(comment)} className="text-xs border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors font-medium">
                  送信
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 返信スレッド */}
        {replies.length > 0 && (
          <div className="ml-4 space-y-1 border-l-2 border-gray-100 pl-3">
            {replies.map(reply => (
              <div key={reply.id} className="rounded-lg p-3 bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium ${reply.role === 'editor' ? 'text-blue-600' : 'text-gray-500'}`}>
                    {reply.authorName}{reply.role === 'editor' ? '（編集者）' : ''}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {reply.createdAt ? new Date(reply.createdAt).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{reply.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <AppHeader />

      {/* 共有バー */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex items-center justify-end gap-2">
        <span className="text-xs font-medium text-gray-400 shrink-0">クライアントへ送る →</span>
        <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
          <span className="text-xs text-gray-500 shrink-0">URL</span>
          <span className="font-mono text-xs text-gray-300 max-w-48 overflow-hidden text-ellipsis whitespace-nowrap">{reviewUrl}</span>
          <button
            onClick={() => copyToClipboard(reviewUrl, 'url')}
            className={`text-xs font-medium ml-1 transition-colors whitespace-nowrap ${copied === 'url' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {copied === 'url' ? '✓' : 'コピー'}
          </button>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
          <span className="text-xs text-gray-500 shrink-0">🔒</span>
          <span className="font-mono text-xs text-gray-200 tracking-widest">{project.password}</span>
          <button
            onClick={() => copyToClipboard(project.password, 'pass')}
            className={`text-xs font-medium ml-1 transition-colors whitespace-nowrap ${copied === 'pass' ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {copied === 'pass' ? '✓' : 'コピー'}
          </button>
        </div>
      </div>

      {uploading && uploadProgress > 0 && (
        <div className="h-0.5 bg-gray-100">
          <div className="h-full bg-gray-900 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}
      {uploadError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between">
          <p className="text-xs text-red-600">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="text-xs text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* 左：動画＋案件情報 */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100 overflow-y-auto">

          {/* 動画エリア */}
          <div className="bg-gray-100 p-3">
            <div className="bg-black rounded-xl overflow-hidden" style={{ height: '52vh' }}>
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

          {/* 案件情報カード */}
          <div className="p-4 space-y-3">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-base font-semibold text-gray-900 mb-1">{project.title}</h1>
                  <p className="text-xs text-gray-400">{project.clientName}</p>
                </div>
                <label className={`cursor-pointer text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium transition-colors shrink-0 ${
                  uploading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-950 text-white hover:bg-gray-800'
                }`}>
                  {uploading ? (
                    <>
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      {uploadProgress > 0 ? `${uploadProgress}%` : 'アップロード中'}
                    </>
                  ) : '+ 新バージョン'}
                  <input type="file" accept="video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">ステータス</p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                    <select
                      value={project.status}
                      onChange={e => handleStatusChange(e.target.value)}
                      className="text-xs font-medium text-gray-700 bg-transparent border-0 cursor-pointer focus:outline-none p-0"
                    >
                      {Object.entries(statusConfig).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">修正回数</p>
                  <p className="text-xs font-medium text-gray-700">{project.revisionCount} / {project.revisionLimit} 回</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">現在のバージョン</p>
                  <p className="text-xs font-medium text-gray-700">Ver.{currentVersion?.versionNumber ?? '-'} {currentVersion?.label ?? ''}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">作成日</p>
                  <p className="text-xs font-medium text-gray-700">{project.createdAt?.toLocaleDateString('ja-JP')}</p>
                </div>
              </div>
            </div>

            {/* タブエリア */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100">
                <span className="px-5 py-3 text-xs font-medium border-b-2 border-gray-900 text-gray-900">バージョン履歴</span>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  {versions.length === 0 && <p className="text-xs text-gray-400 text-center py-4">バージョンがありません</p>}
                  {versions.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3.5 border border-gray-100 rounded-xl">
                      <div>
                        <span className="text-xs font-medium text-gray-800">Ver.{v.versionNumber} {v.label}</span>
                        <p className="text-xs text-gray-400 mt-0.5">{v.uploadedAt?.toLocaleDateString('ja-JP')}</p>
                      </div>
                      {v.id === project.currentVersionId
                        ? <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>最新</span>
                        : <span className="text-xs text-gray-300 px-2.5 py-1">過去</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 右：コメントサイドバー（35%） */}
        <div className="bg-white flex flex-col overflow-hidden" style={{ width: '35%' }}>

          {/* コメントヘッダー */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-3">
            {/* タイトル＋カウント */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">コメント</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"/>
                    未対応 {unresolvedCount}件
                  </span>
                  <span className="text-gray-200">|</span>
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"/>
                    対応済み {resolvedCount}件
                  </span>
                </div>
              </div>
              <button
                onClick={isJumpPlaying ? handleStopJumpPlay : handleJumpPlay}
                disabled={topLevelComments.filter(c => c.role === 'client').length === 0}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                  isJumpPlaying
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                {isJumpPlaying ? '⏹ 停止' : '▶ 修正箇所再生'}
              </button>
            </div>

            {/* フィルタータブ */}
            <div className="flex gap-1">
              {(['all', 'unresolved', 'resolved'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setCommentFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    commentFilter === f ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f === 'all' ? 'すべて' : f === 'unresolved' ? '未対応' : '対応済み'}
                </button>
              ))}
            </div>

            {/* キーワード検索 */}
            <input
              value={commentSearch}
              onChange={e => setCommentSearch(e.target.value)}
              placeholder="コメントを検索..."
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* コメントリスト */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {filteredTopLevel.length === 0 && (
              <div className="flex items-center justify-center h-24">
                <p className="text-xs text-gray-300">
                  {commentSearch ? '検索結果がありません' : 'コメントはまだありません'}
                </p>
              </div>
            )}

            {sentRounds.map(round => {
              const roundComments = filteredTopLevel.filter(c => c.revisionRound === round)
              if (roundComments.length === 0) return null
              return (
                <div key={round} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">第{round}回修正</span>
                    <div className="flex-1 border-t border-gray-100" />
                    <span className="text-xs text-gray-300">{roundComments.length}件</span>
                  </div>
                  {roundComments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
                </div>
              )
            })}

            {unsentComments.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">未送信</span>
                  <div className="flex-1 border-t border-gray-100" />
                  <span className="text-xs text-gray-300">{unsentComments.length}件</span>
                </div>
                {unsentComments.map(comment => <CommentCard key={comment.id} comment={comment} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
