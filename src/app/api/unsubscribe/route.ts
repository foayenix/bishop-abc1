import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getUnsubscribeRecommendations,
  markAsUnsubscribed,
  archiveSenderEmails,
} from '@/services/unsubscribe'
import { batchModifyMessages } from '@/services/gmail'

// GET - Get unsubscribe recommendations
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const minEmails = parseInt(searchParams.get('minEmails') || '3')
    const maxReadRate = parseFloat(searchParams.get('maxReadRate') || '0.1')
    const minDaysSinceRead = parseInt(searchParams.get('minDaysSinceRead') || '30')

    // Get user's email accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (emailAccounts.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    // Get recommendations for all accounts
    const allRecommendations = []

    for (const account of emailAccounts) {
      const recommendations = await getUnsubscribeRecommendations(account.id, {
        minEmails,
        maxReadRate,
        minDaysSinceRead,
      })

      allRecommendations.push(
        ...recommendations.map(r => ({
          ...r,
          emailAccountId: account.id,
        }))
      )
    }

    // Sort by total emails
    allRecommendations.sort((a, b) => b.totalEmails - a.totalEmails)

    return NextResponse.json({
      recommendations: allRecommendations,
      total: allRecommendations.length,
    })
  } catch (error) {
    console.error('Unsubscribe recommendations error:', error)
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    )
  }
}

// POST - Perform unsubscribe action
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { emailAccountId, senderEmail, action } = body

    if (!emailAccountId || !senderEmail || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify ownership
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        id: emailAccountId,
        userId: session.user.id,
      },
    })

    if (!emailAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      )
    }

    let result: { success: boolean; message: string; unsubscribeLink?: string; archived?: number } = {
      success: true,
      message: '',
    }

    switch (action) {
      case 'getLink': {
        // Get the unsubscribe link for user to click
        const senderStats = await prisma.senderStats.findUnique({
          where: {
            emailAccountId_senderEmail: {
              emailAccountId,
              senderEmail,
            },
          },
        })

        if (!senderStats?.unsubscribeLink) {
          return NextResponse.json(
            { error: 'No unsubscribe link found' },
            { status: 404 }
          )
        }

        result = {
          success: true,
          message: 'Unsubscribe link retrieved',
          unsubscribeLink: senderStats.unsubscribeLink,
        }
        break
      }

      case 'markUnsubscribed': {
        // Mark as unsubscribed in our system
        await markAsUnsubscribed(emailAccountId, senderEmail)
        result = {
          success: true,
          message: 'Marked as unsubscribed',
        }
        break
      }

      case 'archiveAll': {
        // Archive all emails from this sender
        const archived = await archiveSenderEmails(emailAccountId, senderEmail)

        // Sync to Gmail
        const emailsToArchive = await prisma.email.findMany({
          where: {
            emailAccountId,
            from: senderEmail,
            isArchived: true,
          },
          select: { providerId: true },
        })

        if (emailsToArchive.length > 0) {
          try {
            await batchModifyMessages(
              emailAccountId,
              emailsToArchive.map((e: { providerId: string }) => e.providerId),
              { removeLabelIds: ['INBOX'] }
            )
          } catch (error) {
            console.error('Failed to sync archive to Gmail:', error)
          }
        }

        result = {
          success: true,
          message: `Archived ${archived} emails`,
          archived,
        }
        break
      }

      case 'unsubscribeAndArchive': {
        // Mark as unsubscribed and archive all
        await markAsUnsubscribed(emailAccountId, senderEmail)
        const archived = await archiveSenderEmails(emailAccountId, senderEmail)

        // Get unsubscribe link
        const senderStats = await prisma.senderStats.findUnique({
          where: {
            emailAccountId_senderEmail: {
              emailAccountId,
              senderEmail,
            },
          },
        })

        // Sync to Gmail
        const emailsToArchive = await prisma.email.findMany({
          where: {
            emailAccountId,
            from: senderEmail,
            isArchived: true,
          },
          select: { providerId: true },
        })

        if (emailsToArchive.length > 0) {
          try {
            await batchModifyMessages(
              emailAccountId,
              emailsToArchive.map((e: { providerId: string }) => e.providerId),
              { removeLabelIds: ['INBOX'] }
            )
          } catch (error) {
            console.error('Failed to sync archive to Gmail:', error)
          }
        }

        result = {
          success: true,
          message: `Unsubscribed and archived ${archived} emails`,
          unsubscribeLink: senderStats?.unsubscribeLink || undefined,
          archived,
        }
        break
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Unsubscribe action error:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}
