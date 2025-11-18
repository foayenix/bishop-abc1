# Bishop - AI Inbox Manager

Bishop is an AI-powered inbox manager that connects to your email, cleans and sorts messages, and provides visual data analysis of your inbox.

## Features

### Current (MVP)
- **Email Sync**: Connect Gmail via OAuth 2.0 and sync your last 90 days of emails
- **AI Classification**: Automatic categorization (Finance, Promo, Social, Important, Personal)
- **Priority Detection**: Identifies emails that need a reply
- **Visual Analytics**: Dashboard with charts for email volume, categories, and top senders
- **Bulk Actions**: Archive, mark read/unread, star, and categorize multiple emails
- **Background Sync**: Automatic incremental sync every 5-10 minutes

### Coming Soon
- AI Assistant with natural language queries
- Smart reply suggestions
- Email summaries and digests
- Multiple email provider support (Outlook, etc.)

## Tech Stack

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **UI**: React + Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js v5 (credentials + Google OAuth)
- **Email**: Gmail API via OAuth 2.0
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Google Cloud Console project with Gmail API enabled

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bishop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Fill in the required values in `.env`:
   - `DATABASE_URL`: PostgreSQL connection string
   - `NEXTAUTH_SECRET`: Random secret for NextAuth
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
   - `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`: Same or separate Google OAuth credentials

4. Set up the database:
   ```bash
   npx prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Gmail API
3. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (NextAuth)
     - `http://localhost:3000/api/gmail/callback` (Gmail OAuth)
4. Add test users in the OAuth consent screen (if in testing mode)

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth routes
│   │   ├── emails/        # Email CRUD and actions
│   │   ├── gmail/         # Gmail OAuth flow
│   │   ├── stats/         # Analytics data
│   │   ├── sync/          # Email sync endpoints
│   │   ├── cron/          # Background job endpoints
│   │   └── assistant/     # AI assistant endpoints
│   ├── auth/              # Auth pages (signin, signup)
│   ├── dashboard/         # Main dashboard
│   ├── emails/            # Email management
│   └── settings/          # Settings and connections
├── components/
│   ├── dashboard/         # Dashboard charts and widgets
│   ├── email/             # Email list and views
│   ├── layout/            # Navigation and layout
│   ├── providers/         # Context providers
│   └── ui/                # Reusable UI components
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── auth-utils.ts      # Auth helper functions
│   └── prisma.ts          # Prisma client
├── services/
│   ├── gmail.ts           # Gmail API service
│   ├── email-sync.ts      # Email sync logic
│   └── ai-classifier.ts   # AI classification (stubbed)
└── types/
    ├── index.ts           # Shared types
    └── next-auth.d.ts     # NextAuth type extensions
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `GET/POST /api/auth/[...nextauth]` - NextAuth handlers

### Gmail
- `GET /api/gmail/connect` - Get Gmail OAuth URL
- `GET /api/gmail/callback` - Handle Gmail OAuth callback

### Emails
- `GET /api/emails` - List emails with filters and pagination
- `GET /api/emails/[id]` - Get single email
- `PATCH /api/emails/[id]` - Update email
- `POST /api/emails/actions` - Bulk actions

### Analytics
- `GET /api/stats` - Dashboard statistics

### Sync
- `GET /api/sync` - Get sync status
- `POST /api/sync` - Trigger manual sync
- `GET /api/cron/sync` - Background sync (for cron jobs)

### AI Assistant
- `POST /api/assistant/query` - Query emails with natural language

## Development

### Database Commands

```bash
# Generate Prisma client
npx prisma generate

# Push schema changes to database
npx prisma db push

# Open Prisma Studio
npx prisma studio

# Create migration
npx prisma migrate dev --name migration_name
```

### Background Sync

For production, set up a cron job to call `/api/cron/sync` every 5-10 minutes.

Example with Vercel Cron (vercel.json):
```json
{
  "crons": [{
    "path": "/api/cron/sync",
    "schedule": "*/5 * * * *"
  }]
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | App URL (e.g., http://localhost:3000) |
| `NEXTAUTH_SECRET` | Random secret for sessions |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GMAIL_CLIENT_ID` | Gmail API client ID |
| `GMAIL_CLIENT_SECRET` | Gmail API client secret |
| `GMAIL_REDIRECT_URI` | Gmail OAuth callback URL |
| `CRON_SECRET` | Secret for authenticating cron requests |
| `OPENAI_API_KEY` | OpenAI API key (for future AI features) |

## License

MIT
