import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAuthUrl } from '@/services/gmail'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create state with user ID for security
    const state = Buffer.from(
      JSON.stringify({ userId: session.user.id })
    ).toString('base64')

    const authUrl = getAuthUrl(state)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Gmail connect error:', error)
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    )
  }
}
