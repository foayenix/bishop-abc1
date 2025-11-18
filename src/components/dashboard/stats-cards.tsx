'use client'

import { Card, CardContent } from '@/components/ui/card'

interface StatsCardsProps {
  total: number
  unread: number
  needsReply: number
}

export function StatsCards({ total, unread, needsReply }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-gray-900">{total.toLocaleString()}</div>
          <p className="text-sm text-gray-500 mt-1">Total Emails</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-blue-600">{unread.toLocaleString()}</div>
          <p className="text-sm text-gray-500 mt-1">Unread</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-2xl font-bold text-orange-600">{needsReply.toLocaleString()}</div>
          <p className="text-sm text-gray-500 mt-1">Needs Reply</p>
        </CardContent>
      </Card>
    </div>
  )
}
