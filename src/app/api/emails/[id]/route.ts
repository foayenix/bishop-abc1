import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const email = await prisma.email.findFirst({
      where: {
        id,
        emailAccount: {
          userId: session.user.id,
        },
      },
    })

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    return NextResponse.json(email)
  } catch (error) {
    console.error('Email fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Verify ownership
    const email = await prisma.email.findFirst({
      where: {
        id,
        emailAccount: {
          userId: session.user.id,
        },
      },
      include: {
        emailAccount: true,
      },
    })

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    // Update email in database
    const updated = await prisma.email.update({
      where: { id },
      data: {
        isRead: body.isRead ?? email.isRead,
        isStarred: body.isStarred ?? email.isStarred,
        isArchived: body.isArchived ?? email.isArchived,
        category: body.category ?? email.category,
        needsReply: body.needsReply ?? email.needsReply,
      },
    })

    // Sync changes to Gmail
    if (body.isRead !== undefined || body.isStarred !== undefined || body.isArchived !== undefined) {
      const { modifyMessage } = await import('@/services/gmail')

      const addLabels: string[] = []
      const removeLabels: string[] = []

      if (body.isRead === false) addLabels.push('UNREAD')
      if (body.isRead === true) removeLabels.push('UNREAD')
      if (body.isStarred === true) addLabels.push('STARRED')
      if (body.isStarred === false) removeLabels.push('STARRED')
      if (body.isArchived === true) removeLabels.push('INBOX')
      if (body.isArchived === false) addLabels.push('INBOX')

      try {
        await modifyMessage(email.emailAccountId, email.providerId, {
          addLabelIds: addLabels.length > 0 ? addLabels : undefined,
          removeLabelIds: removeLabels.length > 0 ? removeLabels : undefined,
        })
      } catch (error) {
        console.error('Failed to sync to Gmail:', error)
      }
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Email update error:', error)
    return NextResponse.json(
      { error: 'Failed to update email' },
      { status: 500 }
    )
  }
}
