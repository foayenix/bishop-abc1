'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface EmailAccount {
  id: string
  email: string
  provider: string
  syncStatus: string
  lastSyncAt: string | null
  totalEmails: number
}

export default function SettingsPage() {
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    if (success) setMessage({ type: 'success', text: success })
    if (error) setMessage({ type: 'error', text: error })

    fetchAccounts()
  }, [searchParams])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sync')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data)
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const connectGmail = async () => {
    try {
      const response = await fetch('/api/gmail/connect')
      if (!response.ok) throw new Error('Failed to get auth URL')

      const { authUrl } = await response.json()
      window.location.href = authUrl
    } catch (error) {
      console.error('Connect error:', error)
      setMessage({ type: 'error', text: 'Failed to initiate Gmail connection' })
    }
  }

  const syncAccount = async (accountId: string) => {
    try {
      setSyncing(accountId)
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })

      if (!response.ok) throw new Error('Sync failed')

      const result = await response.json()
      setMessage({
        type: 'success',
        text: `Synced ${result.emailsSynced} emails`,
      })

      fetchAccounts()
    } catch (error) {
      console.error('Sync error:', error)
      setMessage({ type: 'error', text: 'Failed to sync emails' })
    } finally {
      setSyncing(null)
    }
  }

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge variant="success">Synced</Badge>
      case 'syncing':
        return <Badge variant="warning">Syncing</Badge>
      case 'pending':
        return <Badge variant="default">Pending</Badge>
      case 'error':
        return <Badge variant="important">Error</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

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

        {/* Email Accounts */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Email Accounts</CardTitle>
              <Button onClick={connectGmail} size="sm">
                Connect Gmail
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-gray-500">Loading...</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">
                  No email accounts connected yet
                </p>
                <Button onClick={connectGmail}>
                  Connect your Gmail account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {accounts.map(account => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.email}</span>
                        {getSyncStatusBadge(account.syncStatus)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {account.totalEmails.toLocaleString()} emails
                        {account.lastSyncAt && (
                          <> &middot; Last synced {formatDistanceToNow(new Date(account.lastSyncAt), { addSuffix: true })}</>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncAccount(account.id)}
                      disabled={syncing === account.id || account.syncStatus === 'syncing'}
                    >
                      {syncing === account.id ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>About Bishop</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Bishop is an AI-powered inbox manager that helps you organize, clean, and analyze your email.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              <li>• Automatically categorizes emails (Finance, Promo, Social, etc.)</li>
              <li>• Identifies emails that need a reply</li>
              <li>• Provides visual analytics of your inbox</li>
              <li>• Bulk actions to archive and organize</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
