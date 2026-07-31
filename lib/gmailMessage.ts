export type GmailMessage = {
  to: string
  subject: string
  body: string
}

function encodeSubject(subject: string) {
  const cleanSubject = subject.replace(/[\r\n]+/g, ' ').trim()
  return `=?UTF-8?B?${Buffer.from(cleanSubject, 'utf8').toString('base64')}?=`
}

export function encodeGmailMessage({ to, subject, body }: GmailMessage) {
  const cleanRecipient = to.replace(/[\r\n]+/g, '').trim()
  const cleanBody = body.trim()
  if (!cleanRecipient || !cleanRecipient.includes('@') || !subject.trim() || !cleanBody) {
    throw new Error('GMAIL_DRAFT_INVALID')
  }

  const mime = [
    `To: ${cleanRecipient}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    cleanBody,
  ].join('\r\n')

  return Buffer.from(mime, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}
