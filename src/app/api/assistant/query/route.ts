import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// AI Assistant Query Endpoint
// This is a stub that provides structured access to email data
// Will be enhanced with actual AI (OpenAI/Claude) in the future

const querySchema = z.object({
  query: z.string().min(1),
  filters: z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    category: z.string().optional(),
    from: z.string().optional(),
  }).optional(),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, filters } = querySchema.parse(body)

    // Get user's email accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    })

    if (emailAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        response: 'No email accounts connected. Please connect your Gmail account first.',
        results: [],
      })
    }

    const accountIds = emailAccounts.map((a: { id: string }) => a.id)

    // Parse the query to determine intent
    // In the future, this will use AI to understand natural language
    const intent = parseQueryIntent(query)

    // Build where clause based on intent and filters
    const where: Record<string, unknown> = {
      emailAccountId: { in: accountIds },
      isTrashed: false,
    }

    if (filters?.dateFrom) {
      where.receivedAt = {
        ...(where.receivedAt as object || {}),
        gte: new Date(filters.dateFrom),
      }
    }
    if (filters?.dateTo) {
      where.receivedAt = {
        ...(where.receivedAt as object || {}),
        lte: new Date(filters.dateTo),
      }
    }
    if (filters?.category) {
      where.category = filters.category
    }
    if (filters?.from) {
      where.from = { contains: filters.from, mode: 'insensitive' }
    }

    // Apply intent-based filters
    if (intent.category) {
      where.category = intent.category
    }
    if (intent.needsReply !== undefined) {
      where.needsReply = intent.needsReply
    }
    if (intent.isUnread !== undefined) {
      where.isRead = !intent.isUnread
    }

    // Fetch results
    const emails = await prisma.email.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: intent.limit || 20,
      select: {
        id: true,
        from: true,
        fromName: true,
        subject: true,
        snippet: true,
        receivedAt: true,
        category: true,
        needsReply: true,
        isRead: true,
      },
    })

    // Generate response based on results
    const response = generateResponse(query, emails, intent)

    return NextResponse.json({
      success: true,
      response,
      results: emails,
      intent,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error('Assistant query error:', error)
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    )
  }
}

interface QueryIntent {
  category?: string
  needsReply?: boolean
  isUnread?: boolean
  limit?: number
  action?: string
}

function parseQueryIntent(query: string): QueryIntent {
  const intent: QueryIntent = {}
  const lowerQuery = query.toLowerCase()

  // Category detection
  if (/invoice|payment|receipt|bank|transaction/i.test(lowerQuery)) {
    intent.category = 'finance'
  } else if (/promo|sale|discount|unsubscribe/i.test(lowerQuery)) {
    intent.category = 'promo'
  } else if (/social|facebook|twitter|linkedin/i.test(lowerQuery)) {
    intent.category = 'social'
  } else if (/important|urgent|critical/i.test(lowerQuery)) {
    intent.category = 'important'
  }

  // Status detection
  if (/needs? reply|respond|answer/i.test(lowerQuery)) {
    intent.needsReply = true
  }
  if (/unread|haven't read/i.test(lowerQuery)) {
    intent.isUnread = true
  }

  // Limit detection
  const limitMatch = lowerQuery.match(/last (\d+)|top (\d+)|(\d+) emails?/)
  if (limitMatch) {
    intent.limit = parseInt(limitMatch[1] || limitMatch[2] || limitMatch[3])
  }

  return intent
}

function generateResponse(
  query: string,
  emails: Array<{ id: string; subject: string }>,
  intent: QueryIntent
): string {
  if (emails.length === 0) {
    return `No emails found matching "${query}".`
  }

  let response = `Found ${emails.length} email${emails.length !== 1 ? 's' : ''}`

  if (intent.category) {
    response += ` in ${intent.category} category`
  }
  if (intent.needsReply) {
    response += ' that need a reply'
  }
  if (intent.isUnread) {
    response += ' (unread)'
  }

  response += '.'

  // In the future, AI will generate natural language summaries
  // For now, just return the count

  return response
}

/**
 * Future AI Integration Example:
 *
 * async function processWithAI(query: string, context: EmailContext) {
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [
 *       {
 *         role: 'system',
 *         content: `You are an email assistant. Based on the user's query,
 *                   analyze their emails and provide helpful responses.
 *                   Available categories: important, finance, promo, social, personal, other`
 *       },
 *       {
 *         role: 'user',
 *         content: query
 *       }
 *     ],
 *     functions: [
 *       {
 *         name: 'search_emails',
 *         description: 'Search through user emails',
 *         parameters: { ... }
 *       }
 *     ]
 *   })
 *
 *   return response
 * }
 */
