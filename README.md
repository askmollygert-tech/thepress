# The Press

A friendly, banter-heavy golf scoring app for organising rounds, entering daily handicaps, tracking hole-by-hole scores, managing presses, and keeping a history of results.

## Current features

- Create a round and select players
- Manual daily course handicap for every golfer
- Hole-by-hole gross and net scoring
- Team and individual game formats
- Press tracking
- Completed-hole indicators and flexible starting holes
- Player profiles, past rounds, standings, and banter
- Supabase-ready authentication and shared live data
- Mobile-first interface

## Tech stack

- React / TypeScript
- Vinext and Vite
- Tailwind CSS
- Supabase (authentication and PostgreSQL)

## Local setup

Requirements:

- Node.js 22.13 or newer
- npm

Install and run:

```bash
npm install
npm run dev
```

Create a local `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not commit real credentials. The committed `.env.example` contains blank placeholders only.

## Database

The initial Supabase schema is located at:

```
supabase/migrations/202609210001_initial_press_schema.sql
```

Run that migration in the Supabase SQL editor when creating the production database.

## Validation

```bash
npm run build
node scripts/verify-scoring.mjs
```

## Deployment

The project can be deployed through Vercel after adding the two Supabase environment variables above.
