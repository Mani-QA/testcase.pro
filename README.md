# TestCase Pro - Edge Edition

A production-ready Test Case Management System built with Hono, Cloudflare Workers, and D1.

## Features

- **Dashboard**: Overview with charts and statistics
- **Test Plan**: Organize test cases in folders, CRUD operations
- **Test Run**: Create test suites and execute tests
- **Reports**: Analytics and insights
- **Authentication**: JWT-based auth with secure password hashing
- **Guest Mode**: View-only access without login

## Tech Stack

- **Runtime**: Cloudflare Workers (Edge)
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS
- **Interactivity**: HTMX + Alpine.js
- **Charts**: Chart.js

## Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create D1 Database

```bash
# Create the database
wrangler d1 create testcase-pro-db

# Update wrangler.toml with the database_id from the output
```

### 3. Run migrations

```bash
# Local development
wrangler d1 execute testcase-pro-db --local --file=./drizzle/0000_init.sql

# Production
wrangler d1 execute testcase-pro-db --file=./drizzle/0000_init.sql
```

### 4. Build CSS

```bash
npm run css:build
```

### 5. Run development server

```bash
npm run dev
```

The app will be available at `http://localhost:8787`

## Deployment

### Deploy to Cloudflare Workers

```bash
# Build CSS first
npm run css:build

# Deploy
npm run deploy
```

## Environment Variables

Set these in your Cloudflare dashboard or wrangler.toml:

- `JWT_SECRET`: Secret key for JWT tokens (change in production!)

## Project Structure

```
edge/
├── src/
│   ├── index.ts              # Main Hono app
│   ├── types.ts              # TypeScript types
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema
│   │   └── index.ts          # D1 connection
│   ├── lib/
│   │   ├── auth.ts           # JWT & password utilities
│   │   └── utils.ts          # Helper functions
│   ├── middleware/
│   │   └── auth.ts           # Auth middleware
│   ├── routes/
│   │   ├── api/              # API routes
│   │   │   ├── auth.ts
│   │   │   ├── folders.ts
│   │   │   ├── test-cases.ts
│   │   │   ├── tags.ts
│   │   │   ├── test-suites.ts
│   │   │   ├── test-runs.ts
│   │   │   └── dashboard.ts
│   │   └── pages/            # Page routes (SSR)
│   │       ├── index.ts
│   │       ├── dashboard.tsx
│   │       ├── test-plan.tsx
│   │       ├── test-run.tsx
│   │       ├── reports.tsx
│   │       └── auth.tsx
│   ├── components/           # Hono JSX components
│   │   ├── Layout.tsx
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   └── ...
│   ├── styles/
│   │   └── input.css         # Tailwind input
│   └── static/
│       └── styles.css        # Built CSS (generated)
├── drizzle/
│   └── 0000_init.sql         # Database migrations
├── wrangler.toml             # Cloudflare config
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/session` - Get current session

### Folders
- `GET /api/folders` - List all folders
- `POST /api/folders` - Create folder
- `PUT /api/folders/:id` - Update folder
- `DELETE /api/folders/:id` - Delete folder

### Test Cases
- `GET /api/test-cases` - List test cases
- `GET /api/test-cases/:id` - Get test case
- `POST /api/test-cases` - Create test case
- `PUT /api/test-cases/:id` - Update test case
- `DELETE /api/test-cases/:id` - Delete test case
- `GET /api/test-cases/export` - Export as CSV
- `POST /api/test-cases/import` - Import from CSV
- `DELETE /api/test-cases/bulk-delete` - Bulk delete

### Test Suites
- `GET /api/test-suites` - List test suites
- `GET /api/test-suites/:id` - Get test suite with entries
- `POST /api/test-suites` - Create test suite
- `DELETE /api/test-suites/:id` - Delete test suite

### Test Runs
- `GET /api/test-runs/:id` - Get test run entry
- `PUT /api/test-runs/:id` - Update test run entry

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

## License

MIT

