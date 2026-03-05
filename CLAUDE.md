# Let's Go - Project Documentation

## Rules

### Security
- Never expose API keys, tokens, or secrets in code — always use environment variables
- Always implement Row Level Security (RLS) policies on every new Supabase table
- Never disable or bypass authentication checks
- Always validate and sanitize user inputs to prevent SQL injection and XSS
- Never store passwords in plain text
- Never create API endpoints without authentication unless I explicitly approve
- Always use HTTPS for external calls
- Never design or implement anything that could create legal liability or security vulnerabilities that could be exploited

### Code Quality
- Always match the existing design system — dark neon aesthetic, glassmorphic cards, specific hex colors
- Use TypeScript types, never use `any`
- Don't install new packages without asking first
- Keep components small and focused — one component, one job
- Write code comments on complex business logic
- This is a PRODUCTION app — write production-quality code every time with proper error handling, loading states, and edge cases
- Never use placeholder data, mock functions, or TODO comments without flagging them to me
- Every feature must be built for real users — accessibility, mobile responsiveness, human-readable error messages
- Always consider failure states — empty states, network failures, invalid data

### Database
- Before creating any table, verify it doesn't already exist
- Before running any migration, explain what it does and get my approval
- Never create test or temporary tables in the production database
- Never drop tables without my explicit approval
- Always create migrations for schema changes, never modify directly
- Always add RLS policies when creating new tables
- Explain what any destructive query (DELETE, UPDATE on multiple rows) will do before running it
- Help identify and clean up unused SQL migrations when asked

### Cost & Infrastructure
- Don't implement features that would significantly increase Supabase or Vercel costs without discussing first
- Be mindful of database query efficiency — avoid N+1 queries and unnecessary reads
- Flag any architecture decisions that could cause scaling issues

### User Privacy & Legal
- Never log or expose user personal information in console, error messages, or client-side code
- Always consider privacy implications when building features that collect user data
- Ensure data collection complies with standard privacy practices (consent, minimal collection, secure storage)
- Flag any feature that may need Terms of Service or Privacy Policy updates

### Workflow
- When detailing steps, go slow — one step at a time, wait for my confirmation before moving on
- Never make things up — if you don't know, ask me or search reliable sources before implementing
- Don't refactor or edit code unless I specifically ask
- Don't delete files without my explicit approval
- Ask before making any database changes
- Show me a plan before starting any multi-file changes
- If something fails twice, stop and explain the problem instead of retrying
- Don't assume what I want — ask clarifying questions

---

## Project Overview

**Let's Go**: Discovery + rewards platform. Users find restaurants/activities, earn progressive cash-back (5% → 20%) for repeat visits.

**Tagline**: "Go. Play. Eat. Get paid to live life."

**Core Model**:
- Users swipe/discover → visit → upload receipts → earn progressive payouts
- Businesses onboard → set payout tiers → attract loyal customers via increasing rewards
- LetsGo charges businesses 10% fee per receipt (capped at $5 max) - this is our revenue
- 365-day rolling window per user/business pair (resets annually)

---

## Tech Stack

- Next.js 16.0.10 (App Router), React 19.2.3
- Tailwind CSS v4, PostCSS v4
- Supabase (PostgreSQL + Auth + Storage)
- TypeScript 5.x, ESLint 9
- lucide-react, recharts, xlsx
- Google Maps JavaScript API (autocomplete, places)

---

## Key Architecture Points

### File Structure
- `app/` - Next.js pages (Server Components default)
- `app/swipe/` - Discovery feed (full-screen carousel)
- `app/profile/` - User dashboard (payouts, receipts)
- `app/experiences/` - UGC photo/video feed
- `app/partner-onboarding/` - 7-step business signup
- `app/businessprofile-v2/` - Business dashboard (9 tabs)
- `app/admin/` - 25+ admin pages (dark neon theme)
- `components/` - Reusable UI components
- `lib/supabaseBrowser.ts` - Client-side Supabase (session storage)
- `lib/supabaseServer.ts` - Server-only Supabase (service role, no session)

### Authentication
- Supabase Auth (email/password or OAuth)
- Client: `supabaseBrowser` (RLS enforced)
- Server: `supabaseServer` (service role, bypasses RLS - use carefully)
- Session storage: LocalStorage key `letsgo-auth`
- Admin: separate `/admin/login` page, verified via `staff_users` table
- Business access: `business_users` table (owner/manager/staff roles)

### Database Tables

**business**:
- `id` (text PK), `business_name`, `public_business_name`
- `is_active` (boolean) - controls discovery feed visibility
- `config` (jsonb) - flexible config including:
  - `businessType`, `vibe`, `hours`, `tags`, `images`
  - `payoutBps` (array of 7 numbers: [500, 750, 1000...] = 5%, 7.5%, 10%...)
  - `priceLevel` ($, $$, $$$)

**business_payout_tiers**:
- `business_id`, `tier_index` (1-7)
- `min_visits`, `max_visits` (null = unlimited)
- `percent_bps` (500 = 5.00%), `label` (e.g., "Starter", "Legend")

**receipts**:
- `id`, `business_id`, `user_id`, `visit_date`
- `receipt_total_cents`, `payout_cents`, `payout_tier_index`
- `status` (approved|pending|rejected)

**user_experience_media** (UGC):
- `id`, `business_id`, `user_id`, `storage_path`, `media_type`
- `status` (pending|approved|rejected), `reviewed_by`
- Business approves before public display

**profiles**: `id`, `full_name`, `first_name`, `last_name`

**business_users**: `business_id`, `user_id`, `role` (owner|manager|staff)

**staff_users**: `user_id`, `role` (admin accounts)

---

## Revenue Model & Payout System

### Two Separate Systems (DO NOT CONFUSE)

#### 1. Progressive Payout (Business → User)
**What**: Cash-back rewards businesses pay to users through LetsGo platform
**Who Pays**: Business
**Who Receives**: User
**Amount**: Progressive tiers from 5% → 20% based on visit count
**Cap**: NO per-receipt cap (business sets their own tier structure)

**4 Preset Plans + Custom**:

**Standard (Default)**:
```
Tier 1 (Starter):    1-10 visits   →  5.0% (500 bps)
Tier 2 (Regular):   11-20 visits   →  7.5% (750 bps)
Tier 3 (Favorite):  21-30 visits   → 10.0% (1000 bps)
Tier 4 (VIP):       31-40 visits   → 12.5% (1250 bps)
Tier 5 (Elite):     41-50 visits   → 15.0% (1500 bps)
Tier 6 (Legend):    51-60 visits   → 17.5% (1750 bps)
Tier 7 (Ultimate):  61+ visits     → 20.0% (2000 bps)
```

**Conservative**: Lower (3%, 4%, 5%, 6%, 7%, 8%, 10%)
**Aggressive**: Higher (8%, 10%, 12%, 14%, 16%, 18%, 20%)
**Custom**: Business defines each tier

**Calculation**: `payout_cents = floor(receipt_subtotal_cents × percent_bps / 10000)`

#### 2. LetsGo Fee (Business → LetsGo)
**What**: Platform fee LetsGo charges businesses for each receipt
**Who Pays**: Business
**Who Receives**: LetsGo (our revenue)
**Amount**: 10% of receipt subtotal
**Cap**: $5.00 maximum per receipt

**Calculation**: `letsgo_fee_cents = min(floor(receipt_subtotal_cents × 0.10), 500)`

**Example**:
- $30 receipt → LetsGo fee = $3.00
- $75 receipt → LetsGo fee = $5.00 (capped)
- $200 receipt → LetsGo fee = $5.00 (capped)

### Key Rules
- **365-day rolling window** per user/business pair (not calendar year)
- **Basis points**: 100 BPS = 1.00% (avoids float errors)
- Only **verified (approved) receipts** count toward visit totals
- Each business/user relationship tracked independently
- Progressive payout + LetsGo fee are calculated separately

### Receipt Processing Flow
1. User submits receipt
2. Count visits in 365-day window for this business
3. Load business payout tiers
4. Find matching tier for visit count
5. Calculate user payout: `receipt × tier_percent_bps / 10000` (NO cap)
6. Calculate LetsGo fee: `min(receipt × 0.10, $5.00)` (capped at $5)
7. Insert receipt with both values
8. Business pays: user_payout + letsgo_fee

---

## Brand Assets

### Logo
**File**: `/public/lg-logo.png`
**Format**: PNG
**Usage**:
- Homepage navigation header
- Partner onboarding pages
- Business dashboard headers
- Admin dashboard (if needed)
- Email templates
- Marketing materials

**Implementation**:
```tsx
import Image from 'next/image'

<Image
  src="/lg-logo.png"
  alt="Let's Go"
  width={200}
  height={60}
/>
```

**Guidelines**:
- Always use Next.js `Image` component for optimization
- Maintain aspect ratio
- Don't modify or distort the logo
- Ensure sufficient contrast against background
- Use transparent background version when available

---

## Design System

### Colors Currently in Codebase

#### Admin/Dashboard (Dark Neon)
**Neon Primaries** (`/components/admin/constants.ts`):
- `#ff2d92` - Neon Pink
- `#00d4ff` - Neon Blue
- `#39ff14` - Neon Green
- `#ffff00` - Neon Yellow
- `#ff6b35` - Neon Orange
- `#bf5fff` - Neon Purple
- `#ff3131` - Neon Red

**Dark Backgrounds**:
- `#0f0f1a` - Primary BG
- `#1a1a2e` - Card BG
- `#2d2d44` - Card border

**Text**:
- `#ffffff` - Primary
- `#a0a0b0` - Secondary

**Gradients**:
- Pink → Orange: `#ff2d92 → #ff6b35`
- Blue → Green: `#00d4ff → #39ff14`
- Purple → Pink: `#bf5fff → #ff2d92`
- Yellow → Orange: `#ffff00 → #ff6b35`

#### Partner Onboarding (Light Theme)
**Primary Colors** (`/app/partner-onboarding/onboarding.css`):
- `#ff6b35` - Primary Orange
- `#e5501f` - Primary Dark (hover)
- `#004e89` - Secondary Dark Blue
- `#1a659e` - Secondary Light Blue
- `#f7b801` - Accent Yellow
- `#00c896` - Success Green

**Backgrounds**:
- `#ffffff` - White
- `#fafbfc` - Background Light
- `#f0f4f8` - Gradient End

**Text**:
- `#1a2332` - Text Dark
- `#4a5568` - Text Medium
- `#8892a6` - Text Light

**Borders**:
- `#e2e8f0` - Border Light

**Additional**:
- `#ff6b6b` - Alert/Price Red
- `#ffa500` - Orange (premium)
- `#10b981` - Green (badges)
- `#1a1a2e` - Dark Navy (cards)
- `#16213e` - Dark Navy variant
- `#0b5c92` - Dark Blue (ads)

#### User-Facing (Dark Modern)
**Tailwind Classes** (used in `/app/page.tsx`, `/app/swipe/page.tsx`, `/app/experiences/page.tsx`):

**Backgrounds**:
- `bg-gradient-to-b from-black via-slate-950 to-slate-900` (primary gradient)
- `bg-black` with opacity variants: `/30`, `/35`, `/45`, `/50`, `/55`, `/60`, `/70`
- `bg-slate-950` with opacity: `/80`, `/90`

**Accents**:
- `sky-400`, `sky-500` (primary blue)
- `pink-400`, `pink-500` (primary pink)
- `purple-400`, `purple-500`
- `emerald-300`, `emerald-400`, `emerald-500`
- `amber-400`
- `rose-400`
- `red-300` (errors)

**Borders**:
- `border-white` with opacity: `/5`, `/10`, `/12`, `/15`, `/20`
- `border-sky-300`, `border-sky-400` with opacity: `/60`, `/70`
- `border-pink-400`, `border-purple-400`, etc. with `/70`

**Text**:
- `text-white` with opacity: `/45`, `/55`, `/60`, `/65`, `/70`, `/80`, `/90`
- `text-sky-100`, `text-sky-200`, `text-sky-500`
- `text-emerald-200`, `text-emerald-300`
- `text-amber-100`
- `text-red-200`, `text-red-300`

**Glow Effects**:
- `shadow-[0_0_40px_rgba(244,114,182,0.7)]` (pink glow)
- `bg-pink-500/30`, `bg-sky-500/30`, `bg-purple-500/25`, `bg-amber-400/25` (glow orbs)

### Typography
- Sans: `Inter, system-ui, sans-serif`
- Headings: `text-4xl`, `text-3xl`, `text-2xl`, `text-xl`
- Body: `text-base`, `text-sm`
- Small: `text-xs`

---

## Key Features

### Discovery Feed (`/swipe`)
- Full-screen horizontal swipe carousel (snap-x, snap-center)
- 3 panels per business: hero → details → photos
- Real-time filters: distance, price, cuisine, vibe, activity type, age
- Shows all 7 payout tiers upfront
- Save to "would go again" list

### User Profile (`/profile`)
- Stats: nights out, places visited, saved places
- Balance: lifetime, this month, pending, available
- Payout levels: progress bars per business
- Receipt history: all or by-business
- Upload receipt modal with business search

### Partner Onboarding (`/partner-onboarding`)
**7 Steps**:
1. Business basics (name, type, contact)
2. Location + hours (Google Maps autocomplete)
3. Plan selection (Basic/Premium, ads, add-ons)
4. Payout config (preset or custom tiers)
5. Payment method (bank/card)
6. Verification docs + logo
7. Legal agreements + marketing permissions

- LocalStorage auto-save: `partner-onboarding-data`
- Creates business + payout tiers + business_users ownership

### Business Dashboard V2 (`/businessprofile-v2/[businessId]`)
**9 Tabs**:
1. Overview - Performance metrics
2. Billing - Payment info
3. Analytics - Charts (recharts)
4. Media - Photo gallery + UGC approval
5. Events - Event management
6. Receipts - Approval queue
7. Profile - Edit business details
8. Advertising Addons - Promotions
9. Support - Help center

### Admin Dashboard (`/admin/*`)
**25+ Pages**:
- Overview, Businesses, Users, Receipts, Payouts
- Analytics, Fraud Detection, Advertising
- Automation, Messaging, Training, Health, Audit Logs
- Dark neon aesthetic, sidebar nav (AdminNav), reusable Card/Badge components

### Other Modes
- **Date Night** (`/datenight`): AI selects 1 restaurant + 1 activity
- **1-on-1** (`/5v3v1`): Two-person 5→3→1 voting game
- **Group** (`/group`): Multi-person voting
- **Events** (`/events`): Event discovery
- **Experiences** (`/experiences`): UGC feed (approved photos/videos)

---

## Development Patterns

### Server vs Client Components
- Default: Server Components (can directly query DB)
- Client: `"use client"` directive for interactivity (useState, browser APIs)
- Use client for: user interactions, LocalStorage, real-time updates

### Data Fetching
- Client: `supabaseBrowser.from().select()`
- Server: `supabaseServer` in API routes or Server Components
- No React Query/SWR (direct Supabase queries)

### State Management
- Local state: `useState`
- Persistence: LocalStorage (partner onboarding)
- No Redux/Zustand/Context API

### Styling
- Tailwind utility classes (inline)
- Gradient backgrounds, glow effects
- CSS modules for onboarding (onboarding.css)
- Scroll snap for carousel UX

### TypeScript
- Inline type definitions (no centralized types/ directory)
- Strict mode enabled
- Path alias: `@/*` → project root

---

## Environment Variables

```env
SUPABASE_URL=<your_supabase_project_url>
SUPABASE_SERVICE_ROLE_KEY=<service_role_jwt>
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_project_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_jwt>
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<google_maps_key>
```

**Critical**:
- `NEXT_PUBLIC_*` = exposed to browser
- Non-prefixed = server-only
- **NEVER expose service role key to client** (bypasses RLS)

---

## Common Workflows

### Receipt Upload Flow
1. User: `/profile` → "Add Receipt"
2. Search business, upload photo, enter amount + date
3. API (`/api/receipts` POST):
   - Count visits in 365-day window
   - Find applicable tier
   - Calculate user payout: `receipt × tier_bps / 10000` (NO cap)
   - Calculate LetsGo fee: `min(receipt × 0.10, $5.00)`
   - Insert with status "pending"
4. Receipt appears in profile as "Pending"

### UGC Approval
1. User uploads photo/video → `user_experience_media` (status: pending)
2. Business dashboard → Media tab → Approve/Reject
3. Approved → appears on `/experiences` feed

### Business Onboarding
1. 7-step form (auto-saved to LocalStorage)
2. Select payout preset or define custom
3. Upload verification docs
4. Submit → creates `business` + `business_payout_tiers` + `business_users`
5. Admin approves (sets `is_active: true`)

---

## Security Notes

- Always validate user inputs (positive amounts, dates not in future)
- Auth guards: check `user` exists before processing
- Service role key = server-only (API routes, Server Components)
- Enable RLS on all sensitive tables
- Use parameterized queries (Supabase client handles this)
- Never `dangerouslySetInnerHTML` with user input
- Sanitize business names, blurbs, tags

---

## Build & Deploy

```bash
npm run dev     # localhost:3000
npm run build   # production build
npm run start   # production server
npm run lint    # ESLint
```

**Platform**: Likely Vercel
**Env vars**: Set in deployment platform (ensure service role is server-only)

---

## Troubleshooting

**Empty query results**: Check RLS policies, verify auth, use `supabaseServer` for admin ops
**Google Maps not working**: Check API key, enable Places API
**LocalStorage not persisting**: Incognito blocks LocalStorage
**Receipt calc wrong**: Verify BPS division (÷ 10000), check tier ranges, 365-day window
**Build failing**: Check env vars, TypeScript errors, review logs

---

## Important Context

### Visit Counting
- Only approved receipts count
- 365-day rolling window (from today backwards)
- Per user/business pair (independent relationships)
- Query: `receipts` WHERE `status = 'approved'` AND `visit_date >= today - 365 days`

### Advertising Options (Partner Onboarding)
- 1-Day Spotlight ($99)
- 7-Day Spotlight ($599)
- 14-Day Spotlight ($999)
- 100 Mile Push ($2,599)
- Tour Wide Push ($4,599)
- Premium add-ons: video, 15-min live, 30-min live

### Business Types
restaurant_bar, activity, salon_beauty (others in config)

### Status Values
- Receipts: approved | pending | rejected
- UGC: pending | approved | rejected
- Business: `is_active` (boolean)

---

*Last Updated: 2026-02-16*
