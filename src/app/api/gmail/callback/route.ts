import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokensFromCode, getUserEmail } from '@/services/gmail'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/settings?error=Missing authorization code', request.url)
      )
    }

    // Decode state to get user ID
    let userId: string
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = decoded.userId
    } catch {
      return NextResponse.redirect(
        new URL('/settings?error=Invalid state', request.url)
      )
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code)

    // Get user's email address from Google
    const email = await getUserEmail(tokens.access_token)

    // Create or update email account
    await prisma.emailAccount.upsert({
      where: {
        userId_email: {
          userId,
          email,
        },
      },
      create: {
        userId,
        email,
        provider: 'gmail',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date),
        syncStatus: 'pending',
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expiry_date),
        syncStatus: 'pending',
      },
    })

    return NextResponse.redirect(
      new URL('/settings?success=Gmail connected successfully', request.url)
    )
  } catch (error) {
    console.error('Gmail callback error:', error)
    return NextResponse.redirect(
      new URL('/settings?error=Failed to connect Gmail', request.url)
    )
  }
}
