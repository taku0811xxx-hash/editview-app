'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { getProject, approveProject, sendRevision } from '@/lib/projects'
import { sendRevisionNotification, sendApprovalNotification } from '@/lib/notify'
import { getVersions } from '@/lib/versions'
import { getComments, addComment, markCommentsAsSent, formatTimecode } from '@/lib/comments'
import { Project, Version, Comment } from '@/types'

type Phase = 'password' | 'watch' | 'thankyou'
const SESSION_KEY = (id: string) => `review-auth-${id}`
const NAME_KEY = (id: string) => `reviewer-name-${id}`
const SESSION_TIMEOUT_MS = 60 * 60 * 1000

export default function ReviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const videoRef = useRef<HTMLVideoElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [phase, setPhase] = useState<Phase>('password')
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [authorName, setAuthorName] = useState('')
  const [nameSet, setNameSet] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [currentTimecode, setCurrentTimecode] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [sendingRevision, setSendingRevision] = useState(false)
  const [approving, setApproving] = useState(false)
  const [wasPlayingBeforeFocus, setWasPlayingBeforeFocus] = useState(false)

  const expireSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY(projectId))
    setPhase('password')
    setPasswordInput('')
    setPasswordError('')
  }, [projectId])

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(expireSession, SESSION_TIMEOUT_MS)
  }, [expireSession])

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY(projectId))
    if (stored) {
      const { expires } = JSON.parse(stored)
      if (Date.now() < expires) {
        const init = async () => {
          const p = await getProject(projectId)
          if (!p) return
          setProject(p)
          const v = await getVersions(projectId)
          setVersions(v)
          const c = await getComments(projectId)
          setComments(c)
          const savedName = sessionStorage.getItem(NAME_KEY(projectId))
          if (savedName) { setAuthorName(savedName); setNameSet(true) }
          setPhase('watch')
          resetTimeout()
        }
        init()
      } else {
        sessionStorage.removeItem(SESSION_KEY(projectId))
      }
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [projectId, resetTimeout])

  useEffect(() => {
    if (phase !== 'watch') return
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    const handler = () => resetTimeout()
    events.forEach(e => window.addEventListener(e, handler))
    return () => events.forEach(e => window.removeEventListener(e, handler))
  }, [phase, resetTimeout])

  const loadData = async () => {
    const c = await getComments(projectId)
    setComments(c)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = await getProject(projectId)
    if (!p) { setPasswordError('案件が見つかりません'); return }
    if (p.password !== passwordInput) { setPasswordError('パスワードが正しくありません'); return }
    setProject(p)
    const v = await getVersions(projectId)
    setVersions(v)
    await loadData()
    const savedName = sessionStorage.getItem(NAME_KEY(projectId))
    if (savedName) { setAuthorName(savedName); setNameSet(true) }
    sessionStorage.setItem(SESSION_KEY(projectId), JSON.stringify({ expires: Date.now() + SESSION_TIMEOUT_MS }))
    setPhase('watch')
    resetTimeout()
  }

  const handleSetName = (e: React.FormEvent) => {
    e.preventDefault()
    if (!authorName.trim()) return
    sessionStorage.setItem(NAME_KEY(projectId), authorName)
    setNameSet(true)
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTimecode(Math.floor(videoRef.current.currentTime))
  }

  const handleCommentFocus = () => {
    if (videoRef.current) {
      const playing = !videoRef.current.paused
      setWasPlayingBeforeFocus(playing)
      if (playing) videoRef.current.pause()
    }
  }

  const handleCommentBlur = () => {
    if (wasPlayingBeforeFocus && videoRef.current) {
      videoRef.current.play()
      setWasPlayingBeforeFocus(false)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || !project) return
    const currentVersion = versions.find(v => v.id === project.currentVersionId) ?? versions[0]
    if (!currentVersion) return
    setSubmitting(true)
    try {
      await addComment(projectId, currentVersion.id, currentTimecode, commentText, authorName, 'client')
      setCommentText('')
      await loadData()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendRevision = async () => {
    if (!project) return
    const nextCount = project.revisionCount + 1
    const isOver = nextCount > project.revisionLimit
    const overMessage = isOver
      ? `\n\n⚠️ 契約上の修正回数（${project.revisionLimit}回）を超えています。追加料金が発生する可能性があります。`
      : ''
    const unsent = topLevelComments.filter(c => c.role === 'client' && c.revisionRound === null)
    const confirmed = confirm(
      `第${nextCount}回修正として送りますか？\n\nコメント ${unsent.length}件を編集者に送信します。${overMessage}`
    )
    if (!confirmed) return
    setSendingRevision(true)
    try {
      await markCommentsAsSent(projectId, nextCount)
      await sendRevision(projectId, nextCount)
      const updated = await getProject(projectId)
      if (updated) {
        setProject(updated)
        if (updated.editorEmail) {
          await sendRevisionNotification(projectId, updated.title, updated.clientName, updated.editorEmail)
        }
      }
      await loadData()
    } finally {
      setSendingRevision(false)
    }
  }

  const handleApprove = async () => {
    if (!confirm('この内容で確認済み・納品OKとして送信しますか？')) return
    setApproving(true)
    try {
      await approveProject(projectId)
      if (project?.editorEmail) {
        await sendApprovalNotification(projectId, project.title, project.clientName, project.editorEmail)
      }
      sessionStorage.removeItem(SESSION_KEY(projectId))
      setPhase('thankyou')
    } finally {
      setApproving(false)
    }
  }

  const currentVersion = project
    ? (versions.find(v => v.id === project.currentVersionId) ?? versions[0])
    : null

  const topLevelComments = comments.filter(c => !c.parentId)
  const getReplies = (commentId: string) => comments.filter(c => c.parentId === commentId)

  // 回数ごとにグループ化（送信済み）＋未送信グループ
  const sentRounds = Array.from(
    new Set(topLevelComments.filter(c => c.revisionRound !== null).map(c => c.revisionRound!))
  ).sort((a, b) => a - b)
  const unsentComments = topLevelComments.filter(c => c.role === 'client' && c.revisionRound === null)
  const nextRevisionCount = project ? project.revisionCount + 1 : 1
  const isOverLimit = project ? nextRevisionCount > project.revisionLimit : false

  if (phase === 'thankyou') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl p-10 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-xl">✓</span>
          </div>
          <h1 className="text-base font-medium text-gray-900 mb-2">納品確認ありがとうございました</h1>
          <p className="text-sm text-gray-500">編集者に納品完了の通知を送りました。ご依頼ありがとうございました。</p>
        </div>
      </div>
    )
  }

  if (phase === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm">
          <h1 className="text-base font-medium text-gray-900 mb-1">動画確認</h1>
          <p className="text-sm text-gray-400 mb-6">編集者から届いたパスワードを入力してください</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="text"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="例: aBcD-1234"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:border-gray-400 text-center"
              required
            />
            {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
            <button type="submit" className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700">
              確認する
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 h-12 flex items-center px-6 justify-between">
        <div className="flex items-center gap-4">
          <svg width="100" height="28" viewBox="0 0 110 32" fill="none" aria-label="Editview">
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
          <div className="w-px h-4 bg-gray-200" />
          <div>
            <p className="text-sm font-medium text-gray-900">{project?.title}</p>
            <p className="text-xs text-gray-400">Ver.{currentVersion?.versionNumber ?? '-'} · {project?.clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">修正 {project?.revisionCount ?? 0}/{project?.revisionLimit ?? '-'}回</span>
          <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">確認中</span>
        </div>
      </header>

      {!nameSet && (
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center gap-3">
          <p className="text-xs text-blue-700">お名前を入力してください（コメントに表示されます）</p>
          <form onSubmit={handleSetName} className="flex gap-2">
            <input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="例: 田中" className="border border-blue-200 rounded px-2 py-1 text-xs focus:outline-none" required />
            <button type="submit" className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">設定</button>
          </form>
        </div>
      )}

      <div className="flex flex-1" style={{ minHeight: 0 }}>
        <div className="flex-1 border-r border-gray-200 flex flex-col">
          <div className="bg-gray-100 p-3" style={{ minHeight: '55vh' }}>
            <div className="bg-black rounded-lg overflow-hidden" style={{ height: '55vh' }}>
              {currentVersion ? (
                <video ref={videoRef} src={currentVersion.videoUrl} controls className="w-full h-full object-contain" onTimeUpdate={handleTimeUpdate} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-gray-500 text-sm">動画がまだアップロードされていません</p>
                </div>
              )}
            </div>
          </div>
          <div className="p-3 bg-white flex-1">
            <p className="text-xs text-gray-400">ℹ 気になる箇所で動画を止めてコメント欄に入力してください。コメント欄から離れると再生が再開します。</p>
          </div>
        </div>

        <div className="w-96 bg-white flex flex-col">
          <div className="px-3 py-2.5 border-b border-gray-200">
            <p className="text-xs font-medium text-gray-900">コメントを残す</p>
            <p className="text-xs text-gray-400 mt-0.5">現在位置: <span className="font-mono text-gray-700">{formatTimecode(currentTimecode)}</span></p>
          </div>

          <div className="overflow-y-auto p-3 space-y-4" style={{ flex: 1 }}>

            {/* 送信済みコメント（回数ごとにグループ） */}
            {sentRounds.map(round => {
              const roundComments = topLevelComments.filter(c => c.revisionRound === round)
              return (
                <div key={round}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-400">第{round}回修正（送信済み）</span>
                    <div className="flex-1 border-t border-gray-100" />
                    <span className="text-xs text-gray-300">{roundComments.length}件</span>
                  </div>
                  <div className="space-y-2 opacity-50">
                    {roundComments.map(comment => {
                      const replies = getReplies(comment.id)
                      return (
                        <div key={comment.id}>
                          <div className="border border-gray-100 bg-gray-50 rounded-md p-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <button
                                onClick={() => { if (videoRef.current) videoRef.current.currentTime = comment.timecode }}
                                className="font-mono text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5"
                              >
                                {formatTimecode(comment.timecode)}
                              </button>
                              <span className="text-xs text-gray-400">{comment.authorName}</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">{comment.text}</p>
                          </div>
                          {replies.length > 0 && (
                            <div className="ml-3 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
                              {replies.map(reply => (
                                <div key={reply.id} className="border border-gray-100 bg-gray-50 rounded-md p-2">
                                  <span className="text-xs font-medium text-gray-400">{reply.authorName}</span>
                                  <p className="text-xs text-gray-400 leading-relaxed mt-0.5">{reply.text}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* 未送信コメント */}
            {unsentComments.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-700">第{nextRevisionCount}回修正（未送信）</span>
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs text-gray-400">{unsentComments.length}件</span>
                </div>
                <div className="space-y-2">
                  {unsentComments.map(comment => {
                    const replies = getReplies(comment.id)
                    return (
                      <div key={comment.id}>
                        <div className="border border-purple-100 bg-purple-50/30 rounded-md p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <button
                              onClick={() => { if (videoRef.current) videoRef.current.currentTime = comment.timecode }}
                              className="font-mono text-xs bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 hover:bg-purple-200"
                            >
                              {formatTimecode(comment.timecode)}
                            </button>
                            <span className="text-xs text-gray-400">{comment.authorName}</span>
                          </div>
                          <p className="text-xs text-gray-800 leading-relaxed">{comment.text}</p>
                        </div>
                        {replies.length > 0 && (
                          <div className="ml-3 mt-1 space-y-1 border-l-2 border-blue-100 pl-2">
                            {replies.map(reply => (
                              <div key={reply.id} className="border border-blue-100 bg-blue-50/30 rounded-md p-2">
                                <span className="text-xs font-medium text-blue-600">{reply.authorName}</span>
                                <p className="text-xs text-gray-700 leading-relaxed mt-0.5">{reply.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {topLevelComments.length === 0 && (
              <p className="text-xs text-gray-300 text-center mt-6">コメントはまだありません</p>
            )}
          </div>

          <div className="p-3 border-t border-gray-200 space-y-2">
            <form onSubmit={handleAddComment} className="space-y-2">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onFocus={handleCommentFocus}
                onBlur={handleCommentBlur}
                placeholder={`${formatTimecode(currentTimecode)} の箇所についてコメント...`}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs resize-none focus:outline-none focus:border-gray-400"
                rows={3}
                disabled={!nameSet}
              />
              <button
                type="submit"
                disabled={submitting || !nameSet || !commentText.trim()}
                className="w-full border border-gray-200 rounded-lg py-2 text-xs hover:bg-gray-50 disabled:opacity-40"
              >
                {submitting ? '保存中...' : 'コメントを保存'}
              </button>
            </form>

            <div className="border-t border-gray-100 pt-2 space-y-2">
              {isOverLimit && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-amber-700">⚠️ 契約上の修正回数（{project?.revisionLimit}回）を超えています。送信すると追加料金が発生する可能性があります。</p>
                </div>
              )}
              <button
                onClick={handleSendRevision}
                disabled={sendingRevision || !nameSet || unsentComments.length === 0}
                className={`w-full rounded-lg py-2.5 text-xs font-medium disabled:opacity-40 ${
                  isOverLimit
                    ? 'border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                    : 'border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
                }`}
              >
                {sendingRevision ? '送信中...' : `第${nextRevisionCount}回修正として送る（${unsentComments.length}件）`}
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="w-full border border-green-200 rounded-lg py-2.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
              >
                {approving ? '送信中...' : '✓ 確認済み・納品OKとして送信する'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
