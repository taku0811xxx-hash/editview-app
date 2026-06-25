import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, Timestamp, doc, updateDoc
} from 'firebase/firestore'
import { db } from './firebase'
import { Version } from '@/types'

// 古い動画をR2から削除
const deleteOldVideo = async (r2Key: string) => {
  try {
    await fetch('/api/delete-video', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ r2Key }),
    })
  } catch (e) {
    console.error('旧動画削除エラー:', e)
  }
}

export const addVersion = async (
  projectId: string,
  videoUrl: string,
  r2Key: string,
  label: string,
  versionNumber: number,
) => {
  // 既存バージョンを取得して古い動画を削除
  if (versionNumber > 1) {
    const existing = await getVersions(projectId)
    for (const v of existing) {
      if (v.r2Key) {
        await deleteOldVideo(v.r2Key)
        console.log(`旧バージョン削除: ${v.r2Key}`)
      }
    }
  }

  const ref = await addDoc(collection(db, 'projects', projectId, 'versions'), {
    versionNumber,
    label,
    videoUrl,
    r2Key,
    uploadedAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'projects', projectId), {
    currentVersionId: ref.id,
    status: 'reviewing',
    revisionCount: versionNumber - 1,
  })
  return ref.id
}

export const getVersions = async (projectId: string) => {
  const q = query(
    collection(db, 'projects', projectId, 'versions'),
    orderBy('versionNumber', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      uploadedAt: (data.uploadedAt as Timestamp)?.toDate(),
    } as Version
  })
}
