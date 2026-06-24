import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { type, projectTitle, clientName, editorEmail, projectId } = await req.json()

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://editview-app.vercel.app'
    const projectUrl = `${baseUrl}/projects/${projectId}`

    let subject = ''
    let html = ''

    if (type === 'revision') {
      subject = `【Editview】修正依頼が届きました - ${projectTitle}`
      html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 18px; font-weight: 700; color: #111;">edit</span><span style="font-size: 18px; color: #999;">view</span>
          </div>
          <h2 style="font-size: 16px; font-weight: 600; color: #111; margin-bottom: 8px;">修正依頼が届きました</h2>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 24px;">
            <strong>${clientName}</strong> 様から修正コメントが送信されました。<br>
            案件「${projectTitle}」の内容を確認してください。
          </p>
          <a href="${projectUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;">
            案件を確認する →
          </a>
          <p style="font-size: 12px; color: #aaa; margin-top: 32px;">このメールはEditviewから自動送信されています。</p>
        </div>
      `
    } else if (type === 'approved') {
      subject = `【Editview】納品承認されました - ${projectTitle}`
      html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <div style="margin-bottom: 24px;">
            <span style="font-size: 18px; font-weight: 700; color: #111;">edit</span><span style="font-size: 18px; color: #999;">view</span>
          </div>
          <h2 style="font-size: 16px; font-weight: 600; color: #111; margin-bottom: 8px;">🎉 納品が承認されました</h2>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin-bottom: 24px;">
            <strong>${clientName}</strong> 様が「${projectTitle}」の納品をOKしました。<br>
            お疲れ様でした！
          </p>
          <a href="${projectUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;">
            案件を確認する →
          </a>
          <p style="font-size: 12px; color: #aaa; margin-top: 32px;">このメールはEditviewから自動送信されています。</p>
        </div>
      `
    }

    const { data, error } = await resend.emails.send({
      from: 'Editview <onboarding@resend.dev>',
      to: [editorEmail],
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
