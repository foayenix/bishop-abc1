import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'
import type { GmailTokens, GmailMessage } from '@/types'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  )
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = getOAuth2Client()

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state,
  })
}

export async function getTokensFromCode(code: string): Promise<GmailTokens> {
  const oauth2Client = getOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)

  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token!,
    expiry_date: tokens.expiry_date!,
    token_type: tokens.token_type!,
    scope: tokens.scope!,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<GmailTokens> {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })

  const { credentials } = await oauth2Client.refreshAccessToken()

  return {
    access_token: credentials.access_token!,
    refresh_token: refreshToken, // Keep original refresh token
    expiry_date: credentials.expiry_date!,
    token_type: credentials.token_type!,
    scope: credentials.scope!,
  }
}

export async function getGmailClient(emailAccountId: string) {
  const emailAccount = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
  })

  if (!emailAccount) {
    throw new Error('Email account not found')
  }

  const oauth2Client = getOAuth2Client()

  // Check if token needs refresh
  if (new Date(emailAccount.expiresAt) <= new Date()) {
    const newTokens = await refreshAccessToken(emailAccount.refreshToken)

    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: {
        accessToken: newTokens.access_token,
        expiresAt: new Date(newTokens.expiry_date),
      },
    })

    oauth2Client.setCredentials({
      access_token: newTokens.access_token,
      refresh_token: emailAccount.refreshToken,
    })
  } else {
    oauth2Client.setCredentials({
      access_token: emailAccount.accessToken,
      refresh_token: emailAccount.refreshToken,
    })
  }

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const oauth2Client = getOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data } = await oauth2.userinfo.get()

  return data.email!
}

export async function fetchMessageList(
  emailAccountId: string,
  options: {
    maxResults?: number
    pageToken?: string
    query?: string
  } = {}
) {
  const gmail = await getGmailClient(emailAccountId)

  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: options.maxResults || 100,
    pageToken: options.pageToken,
    q: options.query,
  })

  return {
    messages: response.data.messages || [],
    nextPageToken: response.data.nextPageToken,
    resultSizeEstimate: response.data.resultSizeEstimate,
  }
}

export async function fetchMessage(
  emailAccountId: string,
  messageId: string
): Promise<GmailMessage> {
  const gmail = await getGmailClient(emailAccountId)

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  })

  return response.data as GmailMessage
}

export async function getHistoryList(
  emailAccountId: string,
  startHistoryId: string
) {
  const gmail = await getGmailClient(emailAccountId)

  const response = await gmail.users.history.list({
    userId: 'me',
    startHistoryId,
    historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved'],
  })

  return {
    history: response.data.history || [],
    historyId: response.data.historyId,
    nextPageToken: response.data.nextPageToken,
  }
}

export function parseEmailHeaders(headers: Array<{ name: string; value: string }>) {
  const getHeader = (name: string) => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase())
    return header?.value || ''
  }

  const parseEmailAddress = (value: string) => {
    const match = value.match(/<(.+)>/)
    return match ? match[1] : value
  }

  const parseEmailName = (value: string) => {
    const match = value.match(/^(.+)\s*</)
    return match ? match[1].trim().replace(/"/g, '') : null
  }

  const from = getHeader('From')
  const to = getHeader('To')
  const cc = getHeader('Cc')
  const bcc = getHeader('Bcc')

  return {
    from: parseEmailAddress(from),
    fromName: parseEmailName(from),
    to: to ? to.split(',').map(e => parseEmailAddress(e.trim())) : [],
    cc: cc ? cc.split(',').map(e => parseEmailAddress(e.trim())) : [],
    bcc: bcc ? bcc.split(',').map(e => parseEmailAddress(e.trim())) : [],
    subject: getHeader('Subject') || '(no subject)',
    date: new Date(getHeader('Date')),
    messageId: getHeader('Message-ID'),
  }
}

export function extractTextBody(payload: GmailMessage['payload']): string {
  // Helper to decode base64url
  const decodeBase64 = (data: string) => {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  }

  // Try to get plain text body directly
  if (payload.body?.data) {
    return decodeBase64(payload.body.data)
  }

  // Search through parts
  const findTextPart = (parts: GmailMessage['payload']['parts']): string => {
    if (!parts) return ''

    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data)
      }
      if (part.parts) {
        const text = findTextPart(part.parts)
        if (text) return text
      }
    }

    // Fallback to HTML if no plain text
    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        // Strip HTML tags
        const html = decodeBase64(part.body.data)
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }

    return ''
  }

  return findTextPart(payload.parts)
}

export async function modifyMessage(
  emailAccountId: string,
  messageId: string,
  modifications: {
    addLabelIds?: string[]
    removeLabelIds?: string[]
  }
) {
  const gmail = await getGmailClient(emailAccountId)

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: modifications,
  })
}

export async function batchModifyMessages(
  emailAccountId: string,
  messageIds: string[],
  modifications: {
    addLabelIds?: string[]
    removeLabelIds?: string[]
  }
) {
  const gmail = await getGmailClient(emailAccountId)

  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: {
      ids: messageIds,
      ...modifications,
    },
  })
}
