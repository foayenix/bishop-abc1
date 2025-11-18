import type { EmailClassification, EmailCategory } from '@/types'

interface EmailData {
  from: string
  fromName: string | null
  subject: string
  body: string
  labels: string[]
}

/**
 * AI Email Classification Service
 *
 * This is the abstraction layer for email classification.
 * Currently stubbed with rule-based logic, but designed to be easily
 * replaced with actual AI (OpenAI, Claude, etc.) in the future.
 */

// Keyword patterns for classification
const CATEGORY_PATTERNS: Record<EmailCategory, RegExp[]> = {
  finance: [
    /invoice/i,
    /payment/i,
    /receipt/i,
    /transaction/i,
    /bank/i,
    /credit card/i,
    /statement/i,
    /billing/i,
    /subscription/i,
    /paypal/i,
    /stripe/i,
    /venmo/i,
  ],
  promo: [
    /unsubscribe/i,
    /sale/i,
    /discount/i,
    /offer/i,
    /deal/i,
    /% off/i,
    /limited time/i,
    /exclusive/i,
    /promo/i,
    /free shipping/i,
    /coupon/i,
  ],
  social: [
    /facebook/i,
    /twitter/i,
    /linkedin/i,
    /instagram/i,
    /youtube/i,
    /notification/i,
    /comment/i,
    /follow/i,
    /like/i,
    /mention/i,
    /tagged/i,
  ],
  important: [
    /urgent/i,
    /asap/i,
    /deadline/i,
    /critical/i,
    /important/i,
    /action required/i,
    /immediate/i,
    /priority/i,
  ],
  personal: [
    /personal/i,
    /family/i,
    /friend/i,
    /birthday/i,
    /wedding/i,
    /invitation/i,
  ],
  other: [],
}

// Domains that typically send promotional emails
const PROMO_DOMAINS = [
  'mail.shopify.com',
  'email.mailchimp.com',
  'mail.google.com',
  'marketing',
  'promo',
  'newsletter',
  'noreply',
  'no-reply',
]

// Patterns that suggest a reply is needed
const NEEDS_REPLY_PATTERNS = [
  /\?/,
  /can you/i,
  /could you/i,
  /would you/i,
  /please (let|confirm|send|reply|respond)/i,
  /let me know/i,
  /get back to/i,
  /looking forward to hearing/i,
  /awaiting your/i,
  /your response/i,
  /rsvp/i,
]

export async function classifyEmail(email: EmailData): Promise<EmailClassification> {
  // In the future, this will call an AI model
  // For now, use rule-based classification

  const category = determineCategory(email)
  const priorityScore = calculatePriority(email, category)
  const needsReply = checkNeedsReply(email)

  return {
    category,
    priorityScore,
    needsReply,
  }
}

function determineCategory(email: EmailData): EmailCategory {
  const text = `${email.subject} ${email.body}`.toLowerCase()
  const fromLower = email.from.toLowerCase()

  // Check Gmail labels first
  if (email.labels.includes('CATEGORY_PROMOTIONS')) return 'promo'
  if (email.labels.includes('CATEGORY_SOCIAL')) return 'social'
  if (email.labels.includes('CATEGORY_UPDATES')) return 'other'
  if (email.labels.includes('CATEGORY_FORUMS')) return 'social'

  // Check if from a promotional domain
  if (PROMO_DOMAINS.some(domain => fromLower.includes(domain))) {
    return 'promo'
  }

  // Check patterns by category (in order of priority)
  const categoryOrder: EmailCategory[] = [
    'important',
    'finance',
    'promo',
    'social',
    'personal',
  ]

  for (const category of categoryOrder) {
    const patterns = CATEGORY_PATTERNS[category]
    if (patterns.some(pattern => pattern.test(text))) {
      return category
    }
  }

  return 'other'
}

function calculatePriority(email: EmailData, category: EmailCategory): number {
  let score = 0.5 // Base score

  // Category-based adjustments
  switch (category) {
    case 'important':
      score += 0.3
      break
    case 'finance':
      score += 0.2
      break
    case 'personal':
      score += 0.1
      break
    case 'promo':
      score -= 0.3
      break
    case 'social':
      score -= 0.2
      break
  }

  // Gmail labels adjustments
  if (email.labels.includes('IMPORTANT')) {
    score += 0.2
  }
  if (email.labels.includes('STARRED')) {
    score += 0.15
  }
  if (email.labels.includes('CATEGORY_PROMOTIONS')) {
    score -= 0.2
  }

  // Keyword adjustments
  const text = `${email.subject} ${email.body}`.toLowerCase()
  if (/urgent|asap|deadline|critical/i.test(text)) {
    score += 0.15
  }

  // Normalize score between 0 and 1
  return Math.max(0, Math.min(1, score))
}

function checkNeedsReply(email: EmailData): boolean {
  const text = `${email.subject} ${email.body}`

  // Check for reply patterns
  return NEEDS_REPLY_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * Future AI Integration Point
 *
 * To integrate with an AI model like OpenAI or Claude:
 *
 * export async function classifyEmailWithAI(email: EmailData): Promise<EmailClassification> {
 *   const response = await openai.chat.completions.create({
 *     model: 'gpt-4',
 *     messages: [
 *       {
 *         role: 'system',
 *         content: 'You are an email classification assistant...'
 *       },
 *       {
 *         role: 'user',
 *         content: `Classify this email:\nFrom: ${email.from}\nSubject: ${email.subject}\nBody: ${email.body}`
 *       }
 *     ],
 *     response_format: { type: 'json_object' }
 *   })
 *
 *   return JSON.parse(response.choices[0].message.content)
 * }
 */

/**
 * Batch classification for bulk operations
 */
export async function classifyEmails(
  emails: EmailData[]
): Promise<EmailClassification[]> {
  // In the future, this could batch API calls
  return Promise.all(emails.map(classifyEmail))
}

/**
 * Re-classify all emails for an account
 * Useful when improving the classification algorithm
 */
export async function reclassifyAllEmails(emailAccountId: string): Promise<number> {
  const { prisma } = await import('@/lib/prisma')

  const emails = await prisma.email.findMany({
    where: { emailAccountId },
    select: {
      id: true,
      from: true,
      fromName: true,
      subject: true,
      body: true,
      labels: true,
    },
  })

  let updated = 0

  for (const email of emails) {
    const classification = await classifyEmail({
      from: email.from,
      fromName: email.fromName,
      subject: email.subject,
      body: email.body,
      labels: email.labels,
    })

    await prisma.email.update({
      where: { id: email.id },
      data: {
        category: classification.category,
        priorityScore: classification.priorityScore,
        needsReply: classification.needsReply,
        classifiedAt: new Date(),
      },
    })

    updated++
  }

  return updated
}
