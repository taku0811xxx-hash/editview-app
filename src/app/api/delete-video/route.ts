import { NextRequest, NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
})

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET!
const MAX_BYTES = 500 * 1024 * 1024 * 1024 // 500GB

// R2の使用容量を計算
async function getBucketSize(): Promise<number> {
  let totalSize = 0
  let continuationToken: string | undefined

  do {
    const res = await r2.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) {
      totalSize += obj.Size ?? 0
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  return totalSize
}

// 動画削除
export async function DELETE(req: NextRequest) {
  try {
    const { r2Key } = await req.json()
    if (!r2Key) return NextResponse.json({ error: 'r2Key is required' }, { status: 400 })

    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r2Key }))
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Delete error:', e)
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 })
  }
}

// 容量チェック
export async function GET() {
  try {
    const totalBytes = await getBucketSize()
    const limitReached = totalBytes >= MAX_BYTES
    return NextResponse.json({
      totalBytes,
      totalGB: (totalBytes / (1024 ** 3)).toFixed(2),
      limitReached,
      limitGB: 500,
    })
  } catch (e) {
    console.error('Storage check error:', e)
    return NextResponse.json({ error: 'Failed to check storage' }, { status: 500 })
  }
}
