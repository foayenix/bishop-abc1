import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subDays, format } from 'date-fns'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    // Get user's email accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (emailAccounts.length === 0) {
      return NextResponse.json({
        total: 0,
        unread: 0,
        needsReply: 0,
        byCategory: {},
        byDay: [],
        topSenders: [],
      })
    }

    const accountIds = emailAccounts.map((a: { id: string }) => a.id)
    const startDate = subDays(new Date(), days)

    // Get basic counts
    const [total, unread, needsReply] = await Promise.all([
      prisma.email.count({
        where: {
          emailAccountId: { in: accountIds },
          isTrashed: false,
        },
      }),
      prisma.email.count({
        where: {
          emailAccountId: { in: accountIds },
          isTrashed: false,
          isRead: false,
        },
      }),
      prisma.email.count({
        where: {
          emailAccountId: { in: accountIds },
          isTrashed: false,
          needsReply: true,
        },
      }),
    ])

    // Get counts by category
    const categoryGroups = await prisma.email.groupBy({
      by: ['category'],
      where: {
        emailAccountId: { in: accountIds },
        isTrashed: false,
        category: { not: null },
      },
      _count: true,
    })

    const byCategory: Record<string, number> = {}
    for (const group of categoryGroups) {
      if (group.category) {
        byCategory[group.category] = group._count
      }
    }

    // Get emails per day for the last N days
    const emails = await prisma.email.findMany({
      where: {
        emailAccountId: { in: accountIds },
        isTrashed: false,
        receivedAt: { gte: startDate },
      },
      select: { receivedAt: true },
    })

    // Group by day
    const dayMap = new Map<string, number>()
    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      dayMap.set(date, 0)
    }

    for (const email of emails) {
      const date = format(email.receivedAt, 'yyyy-MM-dd')
      const count = dayMap.get(date) || 0
      dayMap.set(date, count + 1)
    }

    const byDay = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Get top senders
    const senderGroups = await prisma.email.groupBy({
      by: ['from', 'fromName'],
      where: {
        emailAccountId: { in: accountIds },
        isTrashed: false,
        receivedAt: { gte: startDate },
      },
      _count: true,
      orderBy: {
        _count: {
          from: 'desc',
        },
      },
      take: 10,
    })

    const topSenders = senderGroups.map((group: { from: string; fromName: string | null; _count: number }) => ({
      email: group.from,
      name: group.fromName,
      count: group._count,
    }))

    // Get unread trend (last 7 days)
    const unreadTrend = await getUnreadTrend(accountIds)

    return NextResponse.json({
      total,
      unread,
      needsReply,
      byCategory,
      byDay,
      topSenders,
      unreadTrend,
    })
  } catch (error) {
    console.error('Stats fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

async function getUnreadTrend(accountIds: string[]) {
  const trend = []

  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i)
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const count = await prisma.email.count({
      where: {
        emailAccountId: { in: accountIds },
        isTrashed: false,
        isRead: false,
        receivedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    trend.push({
      date: format(date, 'yyyy-MM-dd'),
      unread: count,
    })
  }

  return trend
}
