export type ProjectStatus = 'draft' | 'reviewing' | 'approved' | 'completed'
export type CommentRole = 'client' | 'editor'

export interface Project {
  id: string
  title: string
  editorId: string
  editorEmail: string
  clientName: string
  status: ProjectStatus
  password: string
  currentVersionId: string | null
  revisionLimit: number
  revisionCount: number
  createdAt: Date
  approvedAt: Date | null
  deleteVideoAt: Date | null
}

export interface Version {
  id: string
  versionNumber: number
  label: string
  videoUrl: string
  r2Key: string
  uploadedAt: Date
}

export interface Comment {
  id: string
  versionId: string
  timecode: number
  text: string
  authorName: string
  role: CommentRole
  parentId: string | null
  revisionRound: number | null
  resolved: boolean
  resolvedAt: Date | null
  createdAt: Date
}
