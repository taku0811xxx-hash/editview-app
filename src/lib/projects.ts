import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { Project } from '@/types'

const generatePassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${block()}-${block()}`
}

export const createProject = async (
  editorId: string,
  editorEmail: string,
  title: string,
  clientName: string,
  revisionLimit: number = 3,
) => {
  const password = generatePassword()
  const ref = await addDoc(collection(db, 'projects'), {
    title,
    editorId,
    editorEmail,
    clientName,
    status: 'draft',
    password,
    currentVersionId: null,
    revisionLimit,
    revisionCount: 0,
    createdAt: serverTimestamp(),
    approvedAt: null,
    deleteVideoAt: null,
  })
  return { id: ref.id, password }
}

export const getProject = async (projectId: string) => {
  const snap = await getDoc(doc(db, 'projects', projectId))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    id: snap.id,
    ...data,
    createdAt: (data.createdAt as Timestamp)?.toDate(),
    approvedAt: (data.approvedAt as Timestamp)?.toDate() ?? null,
    deleteVideoAt: (data.deleteVideoAt as Timestamp)?.toDate() ?? null,
  } as Project
}

export const getEditorProjects = async (editorId: string) => {
  const q = query(
    collection(db, 'projects'),
    where('editorId', '==', editorId),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      ...data,
      createdAt: (data.createdAt as Timestamp)?.toDate(),
      approvedAt: (data.approvedAt as Timestamp)?.toDate() ?? null,
      deleteVideoAt: (data.deleteVideoAt as Timestamp)?.toDate() ?? null,
    } as Project
  })
}

export const updateProjectStatus = async (projectId: string, status: Project['status']) => {
  await updateDoc(doc(db, 'projects', projectId), { status })
}

export const approveProject = async (projectId: string) => {
  const deleteVideoAt = new Date()
  deleteVideoAt.setDate(deleteVideoAt.getDate() + 14)
  await updateDoc(doc(db, 'projects', projectId), {
    status: 'approved',
    approvedAt: serverTimestamp(),
    deleteVideoAt: Timestamp.fromDate(deleteVideoAt),
  })
}

export const sendRevision = async (projectId: string, revisionCount: number) => {
  await updateDoc(doc(db, 'projects', projectId), {
    revisionCount,
    status: 'reviewing',
  })
}

export const verifyProjectPassword = async (projectId: string, password: string) => {
  const project = await getProject(projectId)
  if (!project) return false
  return project.password === password
}

export const getEditorEmail = async (editorId: string): Promise<string | null> => {
  const snap = await getDoc(doc(db, 'editors', editorId))
  if (!snap.exists()) return null
  return snap.data().email ?? null
}
