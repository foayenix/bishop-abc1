import Link from 'next/link'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await auth()

  // Redirect authenticated users to dashboard
  if (session?.user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="py-6 px-4 sm:px-6 lg:px-8">
        <nav className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Bishop</h1>
          <div className="space-x-4">
            <Link
              href="/auth/signin"
              className="text-gray-600 hover:text-gray-900"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Take Control of Your Inbox
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Bishop is an AI-powered inbox manager that cleans, sorts, and analyzes
            your email. Spend less time managing email and more time on what matters.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-blue-600 text-white text-lg px-8 py-3 rounded-md hover:bg-blue-700"
          >
            Start for Free
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            title="Smart Categorization"
            description="Automatically categorize emails into Finance, Promo, Social, and more with AI-powered classification."
          />
          <FeatureCard
            title="Visual Analytics"
            description="Understand your inbox with charts showing email volume, top senders, and category breakdowns."
          />
          <FeatureCard
            title="Bulk Actions"
            description="Archive promotions, organize finance emails, and clean up your inbox with powerful bulk actions."
          />
        </div>

        <div className="mt-20 text-center">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Features Coming Soon
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto text-left">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900">AI Assistant</h4>
              <p className="text-gray-600 text-sm">
                Ask questions like &quot;Show unpaid invoices from last 30 days&quot;
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900">Smart Replies</h4>
              <p className="text-gray-600 text-sm">
                AI-generated reply suggestions for emails that need a response
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900">Email Summaries</h4>
              <p className="text-gray-600 text-sm">
                Daily digest of important emails and action items
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900">Multiple Accounts</h4>
              <p className="text-gray-600 text-sm">
                Connect Gmail, Outlook, and other email providers
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-8 px-4 sm:px-6 lg:px-8 mt-20 border-t border-gray-200">
        <div className="max-w-7xl mx-auto text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Bishop. AI-powered inbox management.
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}
