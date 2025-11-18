'use client'

import { useEffect, useState, useCallback } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { EmailList } from '@/components/email/email-list'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { EmailCategory } from '@/types'

interface Email {
  id: string
  from: string
  fromName: string | null
  subject: string
  snippet: string
  isRead: boolean
  isStarred: boolean
  receivedAt: string
  category: string | null
  priorityScore: number | null
  needsReply: boolean
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState<{
    category?: EmailCategory
    needsReply?: boolean
    isRead?: boolean
  }>({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: page.toString() })
      if (filter.category) params.set('category', filter.category)
      if (filter.needsReply) params.set('needsReply', 'true')
      if (filter.isRead !== undefined) params.set('isRead', String(filter.isRead))
      if (search) params.set('search', search)

      const response = await fetch(`/api/emails?${params}`)
      if (!response.ok) throw new Error('Failed to fetch emails')

      const data = await response.json()
      setEmails(data.items)
      setTotalPages(data.totalPages)
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    } finally {
      setLoading(false)
    }
  }, [filter, page, search])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const handleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(emails.map(e => e.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const performAction = async (action: string, category?: string) => {
    if (selectedIds.size === 0) return

    try {
      setActionLoading(true)
      const response = await fetch('/api/emails/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          emailIds: Array.from(selectedIds),
          category,
        }),
      })

      if (!response.ok) throw new Error('Action failed')

      setSelectedIds(new Set())
      fetchEmails()
    } catch (error) {
      console.error('Action failed:', error)
    } finally {
      setActionLoading(false)
    }
  }

  const handleEmailClick = (id: string) => {
    // In a full implementation, this would open email detail
    console.log('Open email:', id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Emails</h1>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <select
              value={filter.category || ''}
              onChange={(e) => setFilter(f => ({ ...f, category: e.target.value as EmailCategory || undefined }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="important">Important</option>
              <option value="finance">Finance</option>
              <option value="promo">Promo</option>
              <option value="social">Social</option>
              <option value="personal">Personal</option>
              <option value="other">Other</option>
            </select>

            <Button
              variant={filter.needsReply ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter(f => ({ ...f, needsReply: !f.needsReply }))}
            >
              Needs Reply
            </Button>

            <Button
              variant={filter.isRead === false ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter(f => ({
                ...f,
                isRead: f.isRead === false ? undefined : false
              }))}
            >
              Unread
            </Button>
          </div>
        </Card>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <Card className="p-4 mb-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size} selected:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => performAction('archive')}
                disabled={actionLoading}
              >
                Archive
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => performAction('markRead')}
                disabled={actionLoading}
              >
                Mark Read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => performAction('markUnread')}
                disabled={actionLoading}
              >
                Mark Unread
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => performAction('star')}
                disabled={actionLoading}
              >
                Star
              </Button>

              <div className="border-l border-gray-300 h-6 mx-2" />

              <select
                onChange={(e) => {
                  if (e.target.value) {
                    performAction('setCategory', e.target.value)
                    e.target.value = ''
                  }
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
                disabled={actionLoading}
              >
                <option value="">Set Category...</option>
                <option value="important">Important</option>
                <option value="finance">Finance</option>
                <option value="promo">Promo</option>
                <option value="social">Social</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>
          </Card>
        )}

        {/* Email List */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <>
            <EmailList
              emails={emails}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onEmailClick={handleEmailClick}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
