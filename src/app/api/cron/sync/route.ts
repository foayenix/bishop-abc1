import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncEmailAccount } from '@/services/email-sync'

// This endpoint can be called by a cron service (Vercel Cron, Railway, etc.)
// or a simple setInterval in production
// Recommended: Call every 5-10 minutes

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find all email accounts that need syncing
    // - Last sync was more than 5 minutes ago
    // - Not currently syncing
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const accountsToSync = await prisma.emailAccount.findMany({
      where: {
        syncStatus: { not: 'syncing' },
        OR: [
          { lastSyncAt: null },
          { lastSyncAt: { lt: fiveMinutesAgo } },
        ],
      },
      orderBy: { lastSyncAt: 'asc' },
      take: 10, // Process up to 10 accounts per run
    })

    const results = []

    for (const account of accountsToSync) {
      try {
        const result = await syncEmailAccount(account.id)
        results.push({
          accountId: account.id,
          email: account.email,
          ...result,
        })
      } catch (error) {
        results.push({
          accountId: account.id,
          email: account.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      synced: results.length,
      results,
    })
  } catch (error) {
    console.error('Cron sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    )
  }
}

// For Vercel Cron
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes
