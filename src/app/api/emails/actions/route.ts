import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { batchModifyMessages } from '@/services/gmail'
import { z } from 'zod'

const actionSchema = z.object({
  action: z.enum(['archive', 'markRead', 'markUnread', 'star', 'unstar', 'trash', 'setCategory']),
  emailIds: z.array(z.string()).min(1),
  category: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, emailIds, category } = actionSchema.parse(body)

    // Get emails with their provider IDs, grouped by account
    const emails = await prisma.email.findMany({
      where: {
        id: { in: emailIds },
        emailAccount: {
          userId: session.user.id,
        },
      },
      select: {
        id: true,
        providerId: true,
        emailAccountId: true,
      },
    })

    if (emails.length === 0) {
      return NextResponse.json({ error: 'No emails found' }, { status: 404 })
    }

    // Group by email account
    type EmailItem = typeof emails[number]
    const byAccount: Record<string, EmailItem[]> = {}
    for (const email of emails) {
      if (!byAccount[email.emailAccountId]) {
        byAccount[email.emailAccountId] = []
      }
      byAccount[email.emailAccountId].push(email)
    }

    // Determine database update and Gmail modifications
    let dbUpdate: Record<string, unknown> = {}
    let addLabels: string[] = []
    let removeLabels: string[] = []

    switch (action) {
      case 'archive':
        dbUpdate = { isArchived: true }
        removeLabels = ['INBOX']
        break
      case 'markRead':
        dbUpdate = { isRead: true }
        removeLabels = ['UNREAD']
        break
      case 'markUnread':
        dbUpdate = { isRead: false }
        addLabels = ['UNREAD']
        break
      case 'star':
        dbUpdate = { isStarred: true }
        addLabels = ['STARRED']
        break
      case 'unstar':
        dbUpdate = { isStarred: false }
        removeLabels = ['STARRED']
        break
      case 'trash':
        dbUpdate = { isTrashed: true }
        addLabels = ['TRASH']
        break
      case 'setCategory':
        if (!category) {
          return NextResponse.json({ error: 'Category required' }, { status: 400 })
        }
        dbUpdate = { category }
        break
    }

    // Update database
    await prisma.email.updateMany({
      where: { id: { in: emailIds } },
      data: dbUpdate,
    })

    // Sync to Gmail
    if (addLabels.length > 0 || removeLabels.length > 0) {
      for (const [accountId, accountEmails] of Object.entries(byAccount)) {
        try {
          await batchModifyMessages(
            accountId,
            accountEmails.map((e: EmailItem) => e.providerId),
            {
              addLabelIds: addLabels.length > 0 ? addLabels : undefined,
              removeLabelIds: removeLabels.length > 0 ? removeLabels : undefined,
            }
          )
        } catch (error) {
          console.error(`Failed to sync to Gmail for account ${accountId}:`, error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      affected: emails.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error('Bulk action error:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}
