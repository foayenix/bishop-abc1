import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncEmailAccount, getSyncStatus } from '@/services/email-sync'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    // Get user's email accounts
    const where = accountId
      ? { id: accountId, userId: session.user.id }
      : { userId: session.user.id }

    const emailAccounts = await prisma.emailAccount.findMany({
      where,
      select: {
        id: true,
        email: true,
        provider: true,
        syncStatus: true,
        lastSyncAt: true,
      },
    })

    // Get sync status for each account
    type AccountType = typeof emailAccounts[number]
    const statuses = await Promise.all(
      emailAccounts.map(async (account: AccountType) => {
        const status = await getSyncStatus(account.id)
        return {
          ...account,
          ...status,
        }
      })
    )

    return NextResponse.json(statuses)
  } catch (error) {
    console.error('Sync status error:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { accountId } = body

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    // Verify ownership
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    })

    if (!emailAccount) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 })
    }

    // Check if already syncing
    if (emailAccount.syncStatus === 'syncing') {
      return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 })
    }

    // Start sync
    const result = await syncEmailAccount(accountId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync emails' },
      { status: 500 }
    )
  }
}
