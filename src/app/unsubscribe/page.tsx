'use client'

import { useEffect, useState } from 'react'
import { Navbar } from '@/components/layout/navbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface UnsubscribeCandidate {
  emailAccountId: string
  senderEmail: string
  senderName: string | null
  totalEmails: number
  readEmails: number
  readRate: number
  lastEmailAt: string | null
  lastReadAt: string | null
  daysSinceLastRead: number | null
  unsubscribeLink: string | null
  unsubscribeType: string | null
}

export default function UnsubscribePage() {
  const [recommendations, setRecommendations] = useState<UnsubscribeCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  const fetchRecommendations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/unsubscribe')
      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setRecommendations(data.recommendations || [])
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
      setMessage({ type: 'error', text: 'Failed to load recommendations' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const handleAction = async (
    candidate: UnsubscribeCandidate,
    action: 'getLink' | 'markUnsubscribed' | 'archiveAll' | 'unsubscribeAndArchive'
  ) => {
    const key = `${candidate.emailAccountId}-${candidate.senderEmail}`
    setActionLoading(key)
    setMessage({ type: '', text: '' })

    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailAccountId: candidate.emailAccountId,
          senderEmail: candidate.senderEmail,
          action,
        }),
      })

      if (!response.ok) throw new Error('Action failed')

      const result = await response.json()

      if (action === 'getLink' || action === 'unsubscribeAndArchive') {
        // Open unsubscribe link in new tab
        if (result.unsubscribeLink) {
          if (result.unsubscribeLink.startsWith('mailto:')) {
            window.location.href = result.unsubscribeLink
          } else {
            window.open(result.unsubscribeLink, '_blank')
          }
        }
      }

      if (action === 'markUnsubscribed' || action === 'unsubscribeAndArchive') {
        // Remove from list
        setRecommendations(prev =>
          prev.filter(
            r =>
              !(r.emailAccountId === candidate.emailAccountId &&
                r.senderEmail === candidate.senderEmail)
          )
        )
      }

      setMessage({ type: 'success', text: result.message })
    } catch (error) {
      console.error('Action failed:', error)
      setMessage({ type: 'error', text: 'Action failed' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Smart Unsubscribe</h1>
            <p className="text-gray-500 mt-1">
              Clean up newsletters you haven&apos;t read in a while
            </p>
          </div>
          <Button onClick={fetchRecommendations} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        {message.text && (
          <div
            className={`mb-4 px-4 py-3 rounded ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading recommendations...</div>
          </div>
        ) : recommendations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No unsubscribe recommendations
              </h3>
              <p className="text-gray-500">
                Great job! You don&apos;t have any newsletters with low engagement.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {recommendations.length} Unsubscribe Candidate{recommendations.length !== 1 ? 's' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  These senders have low read rates or you haven&apos;t read their emails recently.
                  Consider unsubscribing to clean up your inbox.
                </p>
              </CardContent>
            </Card>

            {recommendations.map(candidate => {
              const key = `${candidate.emailAccountId}-${candidate.senderEmail}`
              const isLoading = actionLoading === key
              const readPercent = Math.round(candidate.readRate * 100)

              return (
                <Card key={key}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">
                            {candidate.senderName || candidate.senderEmail}
                          </span>
                          {readPercent === 0 && (
                            <Badge variant="important">Never read</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {candidate.senderEmail}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span>
                            <strong>{candidate.totalEmails}</strong> emails
                          </span>
                          <span>
                            <strong>{readPercent}%</strong> read rate
                          </span>
                          {candidate.daysSinceLastRead !== null && (
                            <span>
                              {candidate.lastReadAt ? (
                                <>
                                  Last read{' '}
                                  {formatDistanceToNow(new Date(candidate.lastReadAt), {
                                    addSuffix: true,
                                  })}
                                </>
                              ) : (
                                'Never read'
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="ml-4 flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAction(candidate, 'unsubscribeAndArchive')}
                          disabled={isLoading}
                        >
                          {isLoading ? 'Processing...' : 'Unsubscribe & Archive'}
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(candidate, 'getLink')}
                            disabled={isLoading}
                          >
                            Open Link
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleAction(candidate, 'archiveAll')}
                            disabled={isLoading}
                          >
                            Archive
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
