'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { CategoryBadge } from '@/components/ui/badge'

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

interface EmailListProps {
  emails: Email[]
  selectedIds: Set<string>
  onSelect: (id: string) => void
  onSelectAll: (selected: boolean) => void
  onEmailClick: (id: string) => void
}

export function EmailList({
  emails,
  selectedIds,
  onSelect,
  onSelectAll,
  onEmailClick,
}: EmailListProps) {
  const allSelected = emails.length > 0 && emails.every(e => selectedIds.has(e.id))

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded border-gray-300"
        />
        <span className="ml-3 text-sm text-gray-500">
          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
        </span>
      </div>

      {/* Email rows */}
      <div className="divide-y divide-gray-200">
        {emails.map(email => (
          <EmailRow
            key={email.id}
            email={email}
            selected={selectedIds.has(email.id)}
            onSelect={() => onSelect(email.id)}
            onClick={() => onEmailClick(email.id)}
          />
        ))}
      </div>

      {emails.length === 0 && (
        <div className="px-4 py-12 text-center text-gray-500">
          No emails found
        </div>
      )}
    </div>
  )
}

function EmailRow({
  email,
  selected,
  onSelect,
  onClick,
}: {
  email: Email
  selected: boolean
  onSelect: () => void
  onClick: () => void
}) {
  return (
    <div
      className={`
        flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer
        ${!email.isRead ? 'bg-blue-50/50' : ''}
        ${selected ? 'bg-blue-100' : ''}
      `}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        className="h-4 w-4 text-blue-600 rounded border-gray-300"
      />

      <div className="ml-3 flex-1 min-w-0" onClick={onClick}>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${!email.isRead ? 'font-semibold' : ''} text-gray-900 truncate`}>
            {email.fromName || email.from}
          </span>
          {email.needsReply && (
            <span className="text-xs text-orange-600 font-medium">Reply</span>
          )}
          {email.isStarred && (
            <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          )}
          <CategoryBadge category={email.category} />
        </div>
        <div className={`text-sm ${!email.isRead ? 'font-medium' : ''} text-gray-900 truncate`}>
          {email.subject}
        </div>
        <div className="text-sm text-gray-500 truncate">
          {email.snippet}
        </div>
      </div>

      <div className="ml-4 text-xs text-gray-500 whitespace-nowrap">
        {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
      </div>
    </div>
  )
}
