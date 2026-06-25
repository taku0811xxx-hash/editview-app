import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, orderBy, serverTimestamp, Timestamp, where, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { Comment } from '@/types'

export const addComment = async (
  projectId: string,
  versionId: string,
  timecode: number,
  text: string,
  authorName: string,
  role: 'client' | 'editor',
  parentId?: string,
) => {
  const ref = await addDoc(collection(db, 'projects', projectId, 'comments'), {
    versionId,
    timecode,
    text,
    authorName,
    role,
    parentId: parentId ?? null,
    revisionRound: null, // 送信時にセットされる
    resolved: false,
    resolvedAt: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// 未送信のクライアントコメントにrevisionRoundをセット
export const markCommentsAsSent = async (projectId: string, revisionRound: number) => {
  const q = query(
    collection(db, 'projects', projectId, 'comments'),
    where('role', '==', 'client'),
    where('revisionRound', '==', null),
  )
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach(d => {
    batch.update(d.ref, { revisionRound })
  })
  await batch.commit()
}

export const getComments = async (projectId: string) => {
  const q = query(
    collection(db, 'projects', projectId, 'comments'),
    orderBy('timecode', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      parentId: data.parentId ?? null,
      revisionRound: data.revisionRound ?? null,
      createdAt: (data.createdAt as Timestamp)?.toDate(),
      resolvedAt: (data.resolvedAt as Timestamp)?.toDate() ?? null,
    } as Comment
  })
}

export const toggleResolve = async (
  projectId: string,
  commentId: string,
  resolved: boolean
) => {
  await updateDoc(doc(db, 'projects', projectId, 'comments', commentId), {
    resolved,
    resolvedAt: resolved ? serverTimestamp() : null,
  })
}

export const formatTimecode = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const deleteComment = async (projectId: string, commentId: string) => {
  const { deleteDoc, doc } = await import('firebase/firestore')
  await deleteDoc(doc(db, 'projects', projectId, 'comments', commentId))
}
