import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
})

const r2Check = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
})

const MAX_BYTES = 500 * 1024 * 1024 * 1024 // 500GB

async function getBucketSize(): Promise<number> {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
  let totalSize = 0
  let continuationToken: string | undefined
  do {
    const res = await r2Check.send(new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
      ContinuationToken: continuationToken,
    }))
    for (const obj of res.Contents ?? []) totalSize += obj.Size ?? 0
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)
  return totalSize
}

export async function POST(req: NextRequest) {
  try {
    const { key, contentType } = await req.json()
    if (!key || !contentType) {
      return NextResponse.json({ error: 'key and contentType are required' }, { status: 400 })
    }

    // 容量チェック
    const totalBytes = await getBucketSize()
    if (totalBytes >= MAX_BYTES) {
      console.error(`R2容量上限超過: ${(totalBytes / (1024 ** 3)).toFixed(2)}GB`)
      return NextResponse.json({
        error: 'storage_limit_exceeded',
        message: '現在ストレージ容量の上限に達しているため、アップロードできません。管理者にお問い合わせください。'
      }, { status: 507 })
    }
    const url = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 3600 }
    )
    return NextResponse.json({ url })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
