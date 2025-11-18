import { prisma } from '@/lib/prisma'
import {
  fetchMessageList,
  fetchMessage,
  getHistoryList,
  parseEmailHeaders,
  extractTextBody,
} from './gmail'
import { classifyEmail } from './ai-classifier'
import { parseUnsubscribeFromMessage, updateSenderStats } from './unsubscribe'

const SYNC_DAYS = 90
const BATCH_SIZE = 50

export async function syncEmailAccount(emailAccountId: string): Promise<{
  success: boolean
  emailsSynced: number
  error?: string
}> {
  const emailAccount = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
  })

  if (!emailAccount) {
    return { success: false, emailsSynced: 0, error: 'Email account not found' }
  }

  // Update sync status
  await prisma.emailAccount.update({
    where: { id: emailAccountId },
    data: { syncStatus: 'syncing' },
  })

  // Create sync job
  const syncJob = await prisma.syncJob.create({
    data: {
      emailAccountId,
      status: 'running',
      startedAt: new Date(),
    },
  })

  try {
    let emailsSynced = 0

    // Check if we should do incremental sync
    if (emailAccount.historyId && emailAccount.lastSyncAt) {
      emailsSynced = await incrementalSync(emailAccountId, emailAccount.historyId)
    } else {
      emailsSynced = await fullSync(emailAccountId)
    }

    // Update email account
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: {
        syncStatus: 'synced',
        lastSyncAt: new Date(),
      },
    })

    // Update sync job
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        emailsSynced,
      },
    })

    // Update sender statistics for unsubscribe recommendations
    await updateSenderStats(emailAccountId).catch(console.error)

    return { success: true, emailsSynced }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Update email account
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { syncStatus: 'error' },
    })

    // Update sync job
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      },
    })

    console.error('Sync error:', error)
    return { success: false, emailsSynced: 0, error: errorMessage }
  }
}

async function fullSync(emailAccountId: string): Promise<number> {
  let emailsSynced = 0
  let pageToken: string | undefined

  // Calculate date filter for last 90 days
  const afterDate = new Date()
  afterDate.setDate(afterDate.getDate() - SYNC_DAYS)
  const query = `after:${Math.floor(afterDate.getTime() / 1000)}`

  do {
    const { messages, nextPageToken } = await fetchMessageList(emailAccountId, {
      maxResults: BATCH_SIZE,
      pageToken,
      query,
    })

    if (messages.length === 0) break

    // Fetch and store messages
    for (const msg of messages) {
      const stored = await fetchAndStoreMessage(emailAccountId, msg.id!)
      if (stored) emailsSynced++
    }

    pageToken = nextPageToken || undefined
  } while (pageToken)

  // Get latest history ID
  const latestMessage = await fetchMessageList(emailAccountId, { maxResults: 1 })
  if (latestMessage.messages.length > 0) {
    const fullMsg = await fetchMessage(emailAccountId, latestMessage.messages[0].id!)
    // Update history ID from the profile
    const profile = await getGmailProfile(emailAccountId)
    if (profile?.historyId) {
      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: { historyId: profile.historyId },
      })
    }
  }

  return emailsSynced
}

async function incrementalSync(
  emailAccountId: string,
  startHistoryId: string
): Promise<number> {
  let emailsSynced = 0

  try {
    const { history, historyId } = await getHistoryList(emailAccountId, startHistoryId)

    for (const entry of history) {
      // Handle added messages
      if (entry.messagesAdded) {
        for (const added of entry.messagesAdded) {
          const stored = await fetchAndStoreMessage(emailAccountId, added.message!.id!)
          if (stored) emailsSynced++
        }
      }

      // Handle label changes
      if (entry.labelsAdded || entry.labelsRemoved) {
        const messages = [
          ...(entry.labelsAdded || []),
          ...(entry.labelsRemoved || []),
        ]
        for (const change of messages) {
          await updateMessageLabels(emailAccountId, change.message!.id!)
        }
      }

      // Handle deleted messages
      if (entry.messagesDeleted) {
        for (const deleted of entry.messagesDeleted) {
          await prisma.email.updateMany({
            where: {
              emailAccountId,
              providerId: deleted.message!.id!,
            },
            data: { isTrashed: true },
          })
        }
      }
    }

    // Update history ID
    if (historyId) {
      await prisma.emailAccount.update({
        where: { id: emailAccountId },
        data: { historyId },
      })
    }

    return emailsSynced
  } catch (error) {
    // If history ID is invalid, do a full sync
    if ((error as { code?: number })?.code === 404) {
      console.log('History ID expired, performing full sync')
      return fullSync(emailAccountId)
    }
    throw error
  }
}

async function fetchAndStoreMessage(
  emailAccountId: string,
  messageId: string
): Promise<boolean> {
  // Check if message already exists
  const existing = await prisma.email.findUnique({
    where: {
      emailAccountId_providerId: {
        emailAccountId,
        providerId: messageId,
      },
    },
  })

  if (existing) return false

  try {
    const message = await fetchMessage(emailAccountId, messageId)
    const headers = parseEmailHeaders(message.payload.headers)
    const body = extractTextBody(message.payload)

    // Extract unsubscribe link
    const unsubscribeInfo = parseUnsubscribeFromMessage(message)

    // Store the email
    const email = await prisma.email.create({
      data: {
        emailAccountId,
        providerId: message.id,
        threadId: message.threadId,
        from: headers.from,
        fromName: headers.fromName,
        to: headers.to,
        cc: headers.cc,
        bcc: headers.bcc,
        subject: headers.subject,
        snippet: message.snippet,
        body: body || message.snippet,
        isRead: !message.labelIds.includes('UNREAD'),
        isStarred: message.labelIds.includes('STARRED'),
        isArchived: !message.labelIds.includes('INBOX'),
        isTrashed: message.labelIds.includes('TRASH'),
        labels: message.labelIds,
        receivedAt: headers.date,
        internalDate: new Date(parseInt(message.internalDate)),
        unsubscribeLink: unsubscribeInfo.link,
        unsubscribeType: unsubscribeInfo.type,
      },
    })

    // Classify the email asynchronously
    classifyAndUpdateEmail(email.id).catch(console.error)

    return true
  } catch (error) {
    console.error(`Failed to fetch message ${messageId}:`, error)
    return false
  }
}

async function updateMessageLabels(
  emailAccountId: string,
  messageId: string
): Promise<void> {
  try {
    const message = await fetchMessage(emailAccountId, messageId)

    await prisma.email.updateMany({
      where: {
        emailAccountId,
        providerId: messageId,
      },
      data: {
        isRead: !message.labelIds.includes('UNREAD'),
        isStarred: message.labelIds.includes('STARRED'),
        isArchived: !message.labelIds.includes('INBOX'),
        isTrashed: message.labelIds.includes('TRASH'),
        labels: message.labelIds,
      },
    })
  } catch (error) {
    console.error(`Failed to update labels for ${messageId}:`, error)
  }
}

async function classifyAndUpdateEmail(emailId: string): Promise<void> {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
  })

  if (!email) return

  const classification = await classifyEmail({
    from: email.from,
    fromName: email.fromName,
    subject: email.subject,
    body: email.body,
    labels: email.labels,
  })

  await prisma.email.update({
    where: { id: emailId },
    data: {
      category: classification.category,
      priorityScore: classification.priorityScore,
      needsReply: classification.needsReply,
      classifiedAt: new Date(),
    },
  })
}

async function getGmailProfile(emailAccountId: string) {
  const { getGmailClient } = await import('./gmail')
  const gmail = await getGmailClient(emailAccountId)
  const profile = await gmail.users.getProfile({ userId: 'me' })
  return profile.data
}

export async function getSyncStatus(emailAccountId: string) {
  const emailAccount = await prisma.emailAccount.findUnique({
    where: { id: emailAccountId },
  })

  if (!emailAccount) return null

  const totalEmails = await prisma.email.count({
    where: { emailAccountId },
  })

  const latestJob = await prisma.syncJob.findFirst({
    where: { emailAccountId },
    orderBy: { createdAt: 'desc' },
  })

  return {
    status: emailAccount.syncStatus,
    lastSyncAt: emailAccount.lastSyncAt,
    totalEmails,
    lastJobStatus: latestJob?.status,
    emailsSynced: latestJob?.emailsSynced || 0,
  }
}
