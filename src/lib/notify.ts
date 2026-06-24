export const sendRevisionNotification = async (
  projectId: string,
  projectTitle: string,
  clientName: string,
  editorEmail: string,
) => {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'revision', projectId, projectTitle, clientName, editorEmail }),
    })
    const data = await res.json()
    console.log('revision notify result:', data)
  } catch (e) {
    console.error('通知送信エラー:', e)
  }
}

export const sendApprovalNotification = async (
  projectId: string,
  projectTitle: string,
  clientName: string,
  editorEmail: string,
) => {
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'approved', projectId, projectTitle, clientName, editorEmail }),
    })
    const data = await res.json()
    console.log('approval notify result:', data)
  } catch (e) {
    console.error('通知送信エラー:', e)
  }
}
