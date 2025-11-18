'use client'

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { StatsCards } from '@/components/dashboard/stats-cards'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { EmailsPerDayChart } from '@/components/dashboard/emails-per-day-chart'
import { TopSenders } from '@/components/dashboard/top-senders'
import { Button } from '@/components/ui/button'

interface Stats {
  total: number
  unread: number
  needsReply: number
  byCategory: Record<string, number>
  byDay: Array<{ date: string; count: number }>
  topSenders: Array<{ email: string; name: string | null; count: number }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/stats?days=30')
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      const data = await response.json()
      setStats(data)
      setError('')
    } catch (err) {
      setError('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <Button onClick={fetchStats} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Stats Cards */}
            <StatsCards
              total={stats.total}
              unread={stats.unread}
              needsReply={stats.needsReply}
            />

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EmailsPerDayChart data={stats.byDay} />
              <CategoryChart data={stats.byCategory} />
            </div>

            {/* Top Senders */}
            <TopSenders data={stats.topSenders} />
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No email data yet
            </h3>
            <p className="text-gray-500 mb-4">
              Connect your Gmail account to start analyzing your inbox
            </p>
            <Button onClick={() => window.location.href = '/settings'}>
              Connect Gmail
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
