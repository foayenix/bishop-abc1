// Bishop - Type Definitions

export type EmailCategory = 'important' | 'finance' | 'promo' | 'social' | 'personal' | 'other'

export interface EmailClassification {
  category: EmailCategory
  priorityScore: number // 0-1
  needsReply: boolean
}

export interface EmailFilters {
  category?: EmailCategory
  isRead?: boolean
  isStarred?: boolean
  needsReply?: boolean
  from?: string
  dateFrom?: Date
  dateTo?: Date
  search?: string
}

export interface EmailStats {
  total: number
  unread: number
  needsReply: number
  byCategory: Record<EmailCategory, number>
  byDay: Array<{ date: string; count: number }>
  topSenders: Array<{ email: string; name: string | null; count: number }>
}

export interface SyncProgress {
  status: 'idle' | 'syncing' | 'completed' | 'error'
  emailsSynced: number
  totalEmails: number
  lastSyncAt: Date | null
  errorMessage?: string
}

export interface BulkActionResult {
  success: boolean
  affected: number
  errors?: string[]
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Gmail API types
export interface GmailTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
  token_type: string
  scope: string
}

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    body?: { data?: string }
    parts?: Array<{
      mimeType: string
      body?: { data?: string }
      parts?: Array<{
        mimeType: string
        body?: { data?: string }
      }>
    }>
  }
  internalDate: string
}
