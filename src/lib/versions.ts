import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, Timestamp, doc, updateDoc
} from 'firebase/firestore'
import { db } from './firebase'
import { Version } from '@/types'

export const addVersion = async (
  projectId: string,
  videoUrl: string,
  r2Key: string,
  label: string,
  versionNumber: number,
) => {
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
