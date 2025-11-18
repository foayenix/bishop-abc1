import { prisma } from '@/lib/prisma'
import type { GmailMessage } from '@/types'

interface UnsubscribeInfo {
  link: string | null
  type: 'link' | 'mailto' | 'one-click' | null
}

interface UnsubscribeCandidate {
  senderEmail: string
  senderName: string | null
  totalEmails: number
  readEmails: number
  readRate: number
  lastEmailAt: Date | null
  lastReadAt: Date | null
  daysSinceLastRead: number | null
  unsubscribeLink: string | null
  unsubscribeType: string | null
}

/**
 * Extract unsubscribe link from email headers and body
 */
export function extractUnsubscribeLink(
  headers: Array<{ name: string; value: string }>,
  body: string
): UnsubscribeInfo {
  // Check List-Unsubscribe header first (most reliable)
  const listUnsubscribe = headers.find(
    h => h.name.toLowerCase() === 'list-unsubscribe'
  )?.value

  if (listUnsubscribe) {
    // Extract URL from header (can contain multiple URLs)
    const urlMatch = listUnsubscribe.match(/<(https?:\/\/[^>]+)>/)
    if (urlMatch) {
      // Check for one-click unsubscribe
      const listUnsubscribePost = headers.find(
        h => h.name.toLowerCase() === 'list-unsubscribe-post'
      )?.value

      return {
        link: urlMatch[1],
        type: listUnsubscribePost ? 'one-click' : 'link',
      }
    }

    // Check for mailto link
    const mailtoMatch = listUnsubscribe.match(/<(mailto:[^>]+)>/)
    if (mailtoMatch) {
      return {
        link: mailtoMatch[1],
        type: 'mailto',
      }
    }
  }

  // Fallback: search body for unsubscribe links
  const unsubscribePatterns = [
    /href=["'](https?:\/\/[^"']*unsubscribe[^"']*)["']/i,
    /href=["'](https?:\/\/[^"']*optout[^"']*)["']/i,
    /href=["'](https?:\/\/[^"']*opt-out[^"']*)["']/i,
    /href=["'](https?:\/\/[^"']*remove[^"']*)["']/i,
    /(https?:\/\/[^\s<>"']*unsubscribe[^\s<>"']*)/i,
  ]

  for (const pattern of unsubscribePatterns) {
    const match = body.match(pattern)
    if (match) {
      return {
        link: match[1],
        type: 'link',
      }
    }
  }

  return { link: null, type: null }
}

/**
 * Parse unsubscribe info from Gmail message
 */
export function parseUnsubscribeFromMessage(message: GmailMessage): UnsubscribeInfo {
  const headers = message.payload.headers

  // Get body text
  let body = ''
  if (message.payload.body?.data) {
    body = Buffer.from(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
  } else if (message.payload.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        body = Buffer.from(part.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
        break
      }
    }
  }

  return extractUnsubscribeLink(headers, body)
}

/**
 * Update sender statistics after syncing emails
 */
export async function updateSenderStats(emailAccountId: string): Promise<void> {
  // Get all unique senders with their stats
  const senderData = await prisma.email.groupBy({
    by: ['from', 'fromName'],
    where: {
      emailAccountId,
      isTrashed: false,
    },
    _count: true,
    _max: {
      receivedAt: true,
    },
  })

  for (const sender of senderData) {
    // Get read count for this sender
    const readCount = await prisma.email.count({
      where: {
        emailAccountId,
        from: sender.from,
        isRead: true,
        isTrashed: false,
      },
    })

    // Get last read date
    const lastRead = await prisma.email.findFirst({
      where: {
        emailAccountId,
        from: sender.from,
        isRead: true,
        isTrashed: false,
      },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    })

    // Get unsubscribe link from most recent email
    const latestEmail = await prisma.email.findFirst({
      where: {
        emailAccountId,
        from: sender.from,
        isTrashed: false,
        unsubscribeLink: { not: null },
      },
      orderBy: { receivedAt: 'desc' },
      select: { unsubscribeLink: true, unsubscribeType: true },
    })

    // Upsert sender stats
    await prisma.senderStats.upsert({
      where: {
        emailAccountId_senderEmail: {
          emailAccountId,
          senderEmail: sender.from,
        },
      },
      create: {
        emailAccountId,
        senderEmail: sender.from,
        senderName: sender.fromName,
        totalEmails: sender._count,
        readEmails: readCount,
        lastEmailAt: sender._max.receivedAt,
        lastReadAt: lastRead?.receivedAt || null,
        unsubscribeLink: latestEmail?.unsubscribeLink || null,
        unsubscribeType: latestEmail?.unsubscribeType || null,
      },
      update: {
        senderName: sender.fromName,
        totalEmails: sender._count,
        readEmails: readCount,
        lastEmailAt: sender._max.receivedAt,
        lastReadAt: lastRead?.receivedAt || null,
        unsubscribeLink: latestEmail?.unsubscribeLink || null,
        unsubscribeType: latestEmail?.unsubscribeType || null,
      },
    })
  }
}

/**
 * Get unsubscribe recommendations based on engagement
 */
export async function getUnsubscribeRecommendations(
  emailAccountId: string,
  options: {
    minEmails?: number
    maxReadRate?: number
    minDaysSinceRead?: number
  } = {}
): Promise<UnsubscribeCandidate[]> {
  const {
    minEmails = 3,
    maxReadRate = 0.1, // 10%
    minDaysSinceRead = 30,
  } = options

  const now = new Date()

  // Get sender stats
  const senders = await prisma.senderStats.findMany({
    where: {
      emailAccountId,
      isUnsubscribed: false,
      totalEmails: { gte: minEmails },
      unsubscribeLink: { not: null },
    },
    orderBy: { totalEmails: 'desc' },
  })

  const candidates: UnsubscribeCandidate[] = []

  for (const sender of senders) {
    const readRate = sender.totalEmails > 0
      ? sender.readEmails / sender.totalEmails
      : 0

    // Calculate days since last read
    let daysSinceLastRead: number | null = null
    if (sender.lastReadAt) {
      daysSinceLastRead = Math.floor(
        (now.getTime() - sender.lastReadAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    } else if (sender.lastEmailAt) {
      // Never read - use days since first email
      daysSinceLastRead = Math.floor(
        (now.getTime() - sender.lastEmailAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    }

    // Check if meets criteria
    const isLowEngagement = readRate <= maxReadRate
    const isStale = daysSinceLastRead !== null && daysSinceLastRead >= minDaysSinceRead

    if (isLowEngagement || isStale) {
      candidates.push({
        senderEmail: sender.senderEmail,
        senderName: sender.senderName,
        totalEmails: sender.totalEmails,
        readEmails: sender.readEmails,
        readRate,
        lastEmailAt: sender.lastEmailAt,
        lastReadAt: sender.lastReadAt,
        daysSinceLastRead,
        unsubscribeLink: sender.unsubscribeLink,
        unsubscribeType: sender.unsubscribeType,
      })
    }
  }

  // Sort by total emails (most clutter first)
  return candidates.sort((a, b) => b.totalEmails - a.totalEmails)
}

/**
 * Mark sender as unsubscribed
 */
export async function markAsUnsubscribed(
  emailAccountId: string,
  senderEmail: string
): Promise<void> {
  await prisma.senderStats.update({
    where: {
      emailAccountId_senderEmail: {
        emailAccountId,
        senderEmail,
      },
    },
    data: {
      isUnsubscribed: true,
      unsubscribedAt: new Date(),
    },
  })

  // Also mark all emails from this sender
  await prisma.email.updateMany({
    where: {
      emailAccountId,
      from: senderEmail,
    },
    data: {
      isUnsubscribed: true,
    },
  })
}

/**
 * Archive all emails from a sender
 */
export async function archiveSenderEmails(
  emailAccountId: string,
  senderEmail: string
): Promise<number> {
  const result = await prisma.email.updateMany({
    where: {
      emailAccountId,
      from: senderEmail,
      isArchived: false,
      isTrashed: false,
    },
    data: {
      isArchived: true,
    },
  })

  return result.count
}
