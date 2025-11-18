import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { EmailCategory } from '@/types'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const category = searchParams.get('category') as EmailCategory | null
    const isRead = searchParams.get('isRead')
    const needsReply = searchParams.get('needsReply')
    const search = searchParams.get('search')
    const accountId = searchParams.get('accountId')

    // Get user's email accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (emailAccounts.length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      })
    }

    const accountIds = accountId
      ? [accountId]
      : emailAccounts.map((a: { id: string }) => a.id)

    // Build where clause
    const where: Record<string, unknown> = {
      emailAccountId: { in: accountIds },
      isTrashed: false,
    }

    if (category) {
      where.category = category
    }

    if (isRead !== null) {
      where.isRead = isRead === 'true'
    }

    if (needsReply === 'true') {
      where.needsReply = true
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { from: { contains: search, mode: 'insensitive' } },
        { fromName: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get total count
    const total = await prisma.email.count({ where })

    // Get emails
    const emails = await prisma.email.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        providerId: true,
        from: true,
        fromName: true,
        subject: true,
        snippet: true,
        isRead: true,
        isStarred: true,
        receivedAt: true,
        category: true,
        priorityScore: true,
        needsReply: true,
        labels: true,
      },
    })

    return NextResponse.json({
      items: emails,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Emails fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch emails' },
      { status: 500 }
    )
  }
}
