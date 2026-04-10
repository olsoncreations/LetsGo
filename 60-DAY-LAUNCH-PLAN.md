# LetsGo 60-Day Launch Plan
**Start Date**: March 6, 2026
**Target**: Revenue-generating platform with paying businesses and active users
**Entity**: Olson Creations LLC, DBA "LETS GO OUT"
**Domain**: www.useletsgo.com

---

## CURRENT STATE (What's Done)

### Technical (95% Complete)
- All user-facing features working (swipe, profile, games, UGC, events, date night)
- 25+ admin pages fully functional
- 9-tab business dashboard complete
- 7-step partner onboarding complete
- 71 API endpoints built and secured
- Receipt upload + progressive payout calculation working
- Stripe business billing (test mode) — SetupIntent, invoices, charging, webhooks
- PayPal/Venmo user payouts (sandbox mode) — OAuth, batch payouts
- Push notifications + email (Resend) infrastructure
- PWA configured with service worker
- Security headers, RLS policies, API auth all in place
- Domain live on Vercel (www.useletsgo.com)
- Legal entity + business bank account set up

### What's NOT Done
- Stripe in TEST mode (needs switch to live)
- PayPal in SANDBOX mode (needs switch to live)
- No automated tests or CI/CD
- No error tracking (Sentry)
- No analytics (Google Analytics)
- 166 ESLint errors (mostly `any` types, not blocking)
- Console.log statements need cleanup (PII risk in PayPal flow)
- No sales materials (pitch deck, one-pager)
- No businesses onboarded yet
- No users yet
- No marketing

---

## THE PLAN

---

## PHASE 1: PRODUCTION-READY (Days 1-7) — March 6-12
**Goal**: Platform fully operational in live/production mode

### Day 1-2: Payment Systems Go Live

#### Stripe: Test → Live
- [ ] Log into Stripe Dashboard (dashboard.stripe.com)
- [ ] Complete Stripe account activation (if not done):
  - Business details (Olson Creations LLC / DBA "LETS GO OUT")
  - Business bank account for receiving payments
  - Tax ID / EIN
  - Business website (www.useletsgo.com)
  - Description of business model
- [ ] Get LIVE keys from Stripe Dashboard → Developers → API Keys
- [ ] Update Vercel environment variables:
  - `STRIPE_SECRET_KEY` → `sk_live_...`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
- [ ] Set up LIVE webhook endpoint in Stripe Dashboard:
  - URL: `https://www.useletsgo.com/api/webhooks/stripe`
  - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
  - Copy the new webhook signing secret
- [ ] Update Vercel: `STRIPE_WEBHOOK_SECRET` → new live `whsec_...`
- [ ] Test with a real $1 charge (use your own card):
  - Go through partner onboarding with a test business
  - Verify SetupIntent completes
  - Verify customer created in Stripe Dashboard
  - Generate a test invoice and charge it
  - Verify webhook fires and invoice marked "paid"
- [ ] Refund the $1 test charge

#### PayPal: Sandbox → Live
- [ ] Log into PayPal Developer Dashboard (developer.paypal.com)
- [ ] Create a LIVE app (or switch existing app to live)
- [ ] Get LIVE credentials:
  - Client ID
  - Client Secret
- [ ] Update Vercel environment variables:
  - `PAYPAL_CLIENT_ID` → live client ID
  - `PAYPAL_CLIENT_SECRET` → live secret
  - `PAYPAL_MODE` → `live`
- [ ] Test with a real $1 payout (to your own PayPal):
  - Create a test user_payout record
  - Trigger payout via admin
  - Verify $1 arrives in your PayPal
- [ ] Verify Venmo payout works too (if you have Venmo)

### Day 3-4: Production Hardening

#### Error Tracking
- [ ] Create Sentry account (free tier: 5K errors/month)
- [ ] Install: `npm install @sentry/nextjs`
- [ ] Run `npx @sentry/wizard@latest -i nextjs`
- [ ] Configure DSN in Vercel env vars
- [ ] Verify errors show up in Sentry dashboard
- [ ] Add to key API routes: receipts, payouts, stripe webhook

#### Analytics
- [ ] Create Google Analytics 4 property for useletsgo.com
- [ ] Get Measurement ID (G-XXXXXXX)
- [ ] Add GA4 script to `app/layout.tsx` (or use `@next/third-parties`)
- [ ] Set up key events to track:
  - `sign_up` — new user registration
  - `receipt_upload` — user submits a receipt
  - `business_onboard_start` — partner onboarding page load
  - `business_onboard_complete` — step 7 submitted
  - `payout_request` — user requests cashout
  - `swipe_view` — discovery feed loaded
  - `game_start` — any game mode started

#### Console.log Cleanup
- [ ] Remove/replace console.log statements in production code paths:
  - `lib/paymentIntegration.ts` — logs PayPal transaction details (PII risk)
  - API route handlers — replace with Sentry capture or remove
  - Keep console.error for actual error logging
- [ ] Use `if (process.env.NODE_ENV === 'development')` guard for any debug logs you want to keep

### Day 5-6: End-to-End Production Testing

#### Full User Flow Test
- [ ] Sign up as a new user on www.useletsgo.com
- [ ] Complete the find-friends flow
- [ ] Browse the discovery feed (will be empty — that's OK)
- [ ] Try all game modes (date night, 5v3v1, group vote)
- [ ] Go to profile, check all tabs load
- [ ] Set up payout method (PayPal or Venmo)

#### Full Business Flow Test
- [ ] Go through partner onboarding end-to-end with a real test business
- [ ] Use YOUR restaurant/bar or a friend's (you'll delete it after)
- [ ] Complete all 7 steps including real Stripe payment method
- [ ] Log into admin → approve the business (set is_active: true)
- [ ] Verify business appears in swipe feed
- [ ] Log into business dashboard → check all 9 tabs
- [ ] Upload a test receipt as a user against this business
- [ ] Approve the receipt from the business dashboard
- [ ] Verify payout calculation is correct
- [ ] Request cashout as the user
- [ ] Process the payout from admin
- [ ] Verify money arrives

#### Admin Flow Test
- [ ] Log into admin dashboard
- [ ] Check all 25+ pages load without errors
- [ ] Test receipt approval/rejection
- [ ] Test user management (suspend, ban, notes)
- [ ] Test billing page (invoice generation, charging)
- [ ] Test payout processing
- [ ] Verify audit logs are recording actions

### Day 7: Fix Any Issues Found
- [ ] Address any bugs discovered during testing
- [ ] Deploy fixes to Vercel
- [ ] Re-test broken flows
- [ ] Snapshot: Platform is LIVE and functional

---

## PHASE 2: SALES REP RECRUITMENT + FIRST BUSINESSES (Days 8-21) — March 13-26
**Goal**: Recruit 2-5 sales reps, get 5-10 businesses onboarded

### Day 8-10: Sales Materials (You Build Once, Reps Use Forever)

#### One-Pager for Businesses (Print + Digital)
Create a single-page PDF reps hand to business owners:
- [ ] Headline: "Turn First-Time Visitors Into Regulars — And Only Pay When It Works"
- [ ] The Problem: Customer acquisition is expensive, loyalty programs are stale
- [ ] The Solution: Progressive cash-back that increases with every visit (5% → 20%)
- [ ] How It Works (3 steps):
  1. Customer discovers your business on LetsGo
  2. They visit and upload their receipt
  3. You pay a small % cash-back — it grows as they return
- [ ] What You Pay:
  - Cash-back to customers (your payout tier — you choose the %)
  - 10% platform fee per receipt (capped at $5 max)
  - Monthly plan: Basic (free features) or Premium ($XX/mo for analytics, ratings, priority placement)
- [ ] ROI Example:
  - Customer spends $50/visit, comes 10 times = $500 revenue
  - You pay: ~$25 in cash-back (5% tier) + ~$50 in fees = $75 total
  - Cost to acquire a $500 regular customer: $75 (15% effective rate)
  - Compare to: Yelp ads ($300-500/mo), Instagram ($200-400/mo)
- [ ] QR code linking to www.useletsgo.com/partner-onboarding
- [ ] LetsGo contact info

#### Sales Rep Recruitment Flyer / Post
Create a one-pager for attracting reps:
- [ ] Headline: "Earn $25-$100+ Per Signup — Sell a Product Businesses Actually Want"
- [ ] What you're selling: A customer loyalty app (not ads, not subscriptions)
- [ ] Commission structure:
  - **$100 per Basic plan signup**
  - **$250 per Premium plan signup**
  - **$10 per $100 in ad spend the business purchases**
  - **Quarterly bonus pool** for top performers
- [ ] Requirements: your own phone, car, ability to talk to business owners
- [ ] 1099 independent contractor (set your own hours, no cap on earnings)
- [ ] "A good rep signing 2-3 businesses per week earns $800-$3,000/month part-time"
- [ ] Application: email or Google Form link

#### Pitch Deck (10 slides max)
For reps to show business owners on their phone/tablet:
- [ ] Slide 1: Cover — LetsGo logo, tagline
- [ ] Slide 2: The Problem — acquisition costs, dead loyalty programs
- [ ] Slide 3: The Solution — progressive cash-back model
- [ ] Slide 4: How It Works — visual user journey
- [ ] Slide 5: Business Benefits — retention, discovery, data
- [ ] Slide 6: Pricing — plan comparison (Basic vs Premium)
- [ ] Slide 7: Revenue Model — how LetsGo makes money (10% fee, capped $5)
- [ ] Slide 8: The App — screenshots of swipe feed, profile, business dashboard
- [ ] Slide 9: Traction — "Launching in [your city]" + early interest
- [ ] Slide 10: Next Steps — QR code to onboard, rep's contact info

Tools: Canva (free), Google Slides, or Figma

#### Business FAQ Sheet (Reps Carry This)
- [ ] "How do I get paid?" — Stripe charges your card/bank monthly
- [ ] "How much does it cost?" — Only pay when customers visit (performance-based)
- [ ] "Can I set my own cash-back rates?" — Yes, 3 presets or fully custom
- [ ] "How do customers find me?" — Discovery feed, date night generator, group voting
- [ ] "What if a receipt is fake?" — You approve every receipt before payout
- [ ] "Can I see analytics?" — Premium plan includes ratings, analytics, priority placement
- [ ] "How do I sign up?" — 10-minute online form at useletsgo.com/partner-onboarding

#### Sales Training Document
- [ ] You already have `sales-training-document.md` — review and update it
- [ ] Add: objection handling (top 5 objections and responses)
- [ ] Add: the 30-second elevator pitch script
- [ ] Add: best times to visit different business types
- [ ] Add: how to use the partner onboarding form (walk business through it on their phone)
- [ ] Add: how the referral field works (rep enters their name in Step 1)
- [ ] Add: what happens after signup (admin approval, activation, dashboard access)

### Day 11-14: Recruit Your First Sales Reps

**Your job is NOT to sell to businesses. Your job is to recruit, equip, and manage the people who do.**

#### Where to Find 1099 Sales Reps
Post on ALL of these (costs $0):
- [ ] **Craigslist** → "Gigs" → "Sales" section in your city
  - Title: "Earn $25-$100 per signup — sell a loyalty app to local restaurants"
  - Emphasize: 1099, set your own hours, commission-only, no cold calling (warm local businesses)
- [ ] **Facebook Marketplace** → Jobs section
- [ ] **Facebook Groups** → local side-hustle, gig economy, sales groups
- [ ] **Indeed** → post as 1099 independent contractor (free to post)
- [ ] **LinkedIn** → post in your feed + local business groups
- [ ] **Nextdoor** → "Looking for motivated sales reps in [city]"
- [ ] **College job boards** → business/marketing students looking for side income
- [ ] **Your personal network** → text/DM anyone who's outgoing and needs extra money

#### Ideal Rep Profile
Look for people who are:
- [ ] Outgoing and comfortable walking into a restaurant cold
- [ ] Already in a role that takes them to businesses (delivery drivers, food reps, event planners)
- [ ] Motivated by commission (not looking for hourly — those aren't 1099 material)
- [ ] Familiar with local restaurant/bar scene
- [ ] Have reliable transportation
- [ ] Former restaurant workers are GOLD — they know the owners, speak the language

#### The Rep Interview (Phone/Zoom — You Never Leave Home)
- [ ] Quick 15-minute call to vet them
- [ ] Questions to ask:
  1. "Have you done any sales before?" (experience helps but isn't required)
  2. "How many hours per week can you commit?" (minimum 5-10 hours)
  3. "Do you know any restaurant or bar owners personally?" (instant leads)
  4. "Are you comfortable walking into a business and asking for the manager?"
  5. "Are you OK with 1099/commission-only?" (filter out hourly-seekers)
- [ ] If they pass: send them the training doc, one-pager, and pitch deck
- [ ] Goal: **3-5 reps recruited by Day 14**

#### Rep Onboarding (All Remote — Text/Email/Zoom)
For each rep you bring on:
- [ ] Send: sales training document (PDF)
- [ ] Send: business one-pager (PDF, they print copies)
- [ ] Send: pitch deck (Google Slides link or PDF)
- [ ] Send: FAQ sheet
- [ ] Quick 30-min Zoom walkthrough:
  - Show them the app (swipe feed, business dashboard)
  - Walk them through the partner onboarding form
  - Explain the referral field ("put YOUR name in Step 1 so you get credit")
  - Explain commission structure and payout schedule
  - **Emphasize: commission is earned when the business's first payment clears, not on signup**
  - This means reps should help businesses complete onboarding properly (real docs, real payment method)
  - Set expectations: aim for 2-3 signups per week
- [ ] Add them to admin → Sales → Sales Reps
- [ ] **IMPORTANT**: Update `sales_config` table commission rates to match new structure:
  - `basic_signup`: 10000 (= $100)
  - `premium_signup`: 25000 (= $250)
  - (DB currently has old values: $25/$100 — update before first payout)
- [ ] Set their zone and division
- [ ] Set their quota (start low: 5-10/month to build confidence)
- [ ] Have them sign a simple 1099 Independent Contractor Agreement:
  - Commission rates ($100 Basic, $250 Premium)
  - **Commission triggers on first successful payment from the business, NOT on signup**
  - They're not an employee
  - They'll receive 1099-NEC if they earn $600+
  - They represent LetsGo professionally
  - Non-exclusive (they can sell other things)

#### 1099 Legal Requirements (You Need These)
- [ ] Collect from each rep: W-9 form (name, address, SSN/EIN)
- [ ] Store securely (DO NOT put in the app database — use encrypted cloud storage)
- [ ] Track all payments — you'll issue 1099-NEC forms at tax time for anyone earning $600+
- [ ] Your Terms already cover this (Section 14 of Terms & Conditions)
- [ ] Consider: simple contractor agreement template (Google "1099 contractor agreement template")

### Day 15-21: Reps Hit the Ground + You Manage From Home

#### Your Daily Management Routine (All From Your Computer)
- [ ] **Morning check-in** (text/Slack): "What's your plan today? How many businesses are you hitting?"
- [ ] **Evening check-in** (text/Slack): "How'd it go? Any signups? Any questions?"
- [ ] **Track in admin**: Admin → Sales → check for new signups attributed to each rep
- [ ] **Quick coaching**: If a rep is struggling, do a 10-min call to troubleshoot objections
- [ ] **Celebrate wins**: When a rep lands a signup, congratulate them publicly in the group chat

#### What Reps Do (They Handle ALL In-Person Work)
- [ ] Walk into restaurants/bars/activities during slow hours
- [ ] Ask for the owner or manager
- [ ] Deliver the 30-second pitch
- [ ] Show the app on their phone
- [ ] Leave the one-pager
- [ ] Help the business owner complete the online onboarding form
- [ ] Enter THEIR NAME in the "referred by" field on Step 1
- [ ] Follow up within 48 hours
- [ ] Report back to you each evening

#### What YOU Do (All Remote)
- [ ] Monitor admin dashboard for new onboarding submissions
- [ ] Review and approve submitted businesses:
  - Check business info is accurate
  - Verify uploaded documents
  - Set is_active: true
  - Ensure payout tiers are reasonable
- [ ] Upload/improve business photos if reps' photos aren't great
- [ ] Write compelling descriptions for each business
- [ ] Match referredBy names to sales_signups in admin → Sales
- [ ] Track rep performance in admin → Sales → Sales Reps
- [ ] Process rep commission payouts (bi-monthly: 1st-15th and 16th-end)
- [ ] Answer rep questions via text/Slack/email

#### Commission Payouts (Already Built in Admin)
Your system already supports bi-monthly payout periods (P1: 1-15, P2: 16-end):
- [ ] **CRITICAL RULE: Reps do NOT get paid until the business's first Stripe payment clears**
  - This prevents reps from writing down fake signups to collect commissions
  - A "signup" isn't a sale until the business actually pays their first invoice
  - Flow: Rep signs business → you onboard → first invoice generated → Stripe charges → payment succeeds → THEN commission is earned
  - Make this crystal clear in the contractor agreement and during onboarding
- [ ] At end of each period, review sales_signups in admin
- [ ] Cross-reference with invoices: only count signups where business has a paid invoice
- [ ] Calculate commissions: $100/basic, $250/premium, + ad spend bonuses
- [ ] Pay reps via PayPal/Venmo/Zelle (same payout system you use for users)
- [ ] Mark payouts as paid in admin → Sales → Payouts

#### Early Adopter Incentives (Reps Offer These to Businesses)
- [ ] First month: waive the 10% platform fee entirely
- [ ] "Sign up today and your first month is completely free — zero risk"
- [ ] Offer to help them set up their profile photos
- [ ] Promise a featured spot in the discovery feed

#### Rep Incentive Bonuses
- [ ] First signup bonus: extra $25 for their very first business signup (gets them hooked)
- [ ] "3 in a week" bonus: extra $50 if they sign 3+ in one week
- [ ] Referral bonus: $25 if they recruit another rep who gets their first signup
- [ ] Track all bonuses in admin → Sales → Bonus Pool

#### Seed the Platform with Content (You Do This Remotely)
- [ ] Ask reps to take 3-5 photos of each business they sign up
- [ ] Reps text/email photos to you
- [ ] You upload photos to business profiles via admin
- [ ] Write compelling descriptions for each business
- [ ] Set accurate hours, tags, and vibes (from onboarding data)
- [ ] Create at least 1 event per business (from their social media or website)

#### Platform Quality Check
- [ ] Open the swipe feed — do the businesses look appealing?
- [ ] Try the date night generator — does it produce good results?
- [ ] Check that payout tiers display correctly for each business
- [ ] Make sure all business hours are accurate
- [ ] Verify Google Maps locations are correct
- [ ] Goal: **10 businesses live and active by Day 21**

---

## PHASE 3: USER ACQUISITION + FIRST REVENUE (Days 22-42) — March 27 - April 16
**Goal**: 100+ users signed up, first revenue cycle complete

### Day 22-24: Marketing Setup (All From Your Computer)

#### Social Media Setup
- [ ] Create Instagram account: @useletsgo (or similar)
- [ ] Create TikTok account: @useletsgo
- [ ] Create Facebook page: LetsGo
- [ ] Bio on all: "Get paid to go out. 5-20% cash-back at local restaurants & activities. Download free → useletsgo.com"
- [ ] Profile photo: LetsGo logo
- [ ] Link in bio: www.useletsgo.com

#### Content Calendar (First 2 Weeks)
Post 1x/day minimum on Instagram + TikTok (you can schedule everything in advance):
- [ ] Day 1: "We just launched" announcement + app demo video (screen record on your phone)
- [ ] Day 2: "How it works" explainer (screen recording of swipe + receipt upload)
- [ ] Day 3: Feature a partner business ("Meet [Business Name]" — use their photos)
- [ ] Day 4: Show the cash-back math ("$50 dinner = $2.50 back on your first visit, up to $10 by visit 7")
- [ ] Day 5: Behind-the-scenes ("I built this app because...")
- [ ] Day 6: Feature another partner business
- [ ] Day 7: User testimonial (get a friend to use it and quote them)
- [ ] Days 8-14: Repeat cycle — mix of explainers, business features, testimonials
- [ ] Use free scheduling tools: Later, Buffer, or Meta Business Suite (all free tier)

#### Ask Reps to Cross-Promote
- [ ] Tell your sales reps: "Every business you sign up — ask them to put a LetsGo flyer by the register"
- [ ] Design a simple counter card (Canva):
  - "Get PAID to eat here — scan to join LetsGo"
  - QR code to useletsgo.com
  - "Earn 5-20% cash-back on every visit"
- [ ] Send PDF to reps → they print and place at each business they sign up
- [ ] This turns every business into a user acquisition channel — zero effort from you

### Day 25-28: Soft Launch to Personal Network (Text/DM Only)

#### Personal Network Blast (No In-Person Required)
- [ ] Text everyone you know: friends, family, former coworkers
- [ ] Copy-paste message template:
  > "Hey! I launched an app called LetsGo — you get cash-back every time you
  > go to a local restaurant or activity, and it INCREASES the more you go.
  > Like 5% your first visit, up to 20% by your 7th. It's free.
  > Would you try it? useletsgo.com"
- [ ] Ask each person to sign up AND upload 1 receipt
- [ ] Ask each person to share with 2 friends
- [ ] Goal: 25-50 signups from personal network
- [ ] Post on your personal social media accounts too

#### Activate the Influencer System
Your influencer system is fully built (15 tiers, referral tracking, payout generation):
- [ ] Identify 3-5 local micro-influencers (1K-10K followers) — DM them on Instagram
- [ ] Message template:
  > "Hey! I built a cash-back app for local restaurants called LetsGo.
  > We have an influencer program — you get a unique referral link and earn
  > for every user that signs up through you. Interested?"
- [ ] Create their influencer record in admin → Referrals
- [ ] Give them unique referral codes (e.g., ?ref=SARAH2026)
- [ ] Set their rate (e.g., $50 per 1,000 signups to start)
- [ ] They promote on their social media, you track signups in admin
- [ ] This is 100% remote — DM outreach only

### Day 29-35: Scale User Acquisition (All Remote Channels)

#### Digital Marketing (Free)
- [ ] Post in local Facebook groups ("Check out this new app...")
- [ ] Post on Nextdoor ("New local app gives you cash-back at [list businesses]")
- [ ] Post on local subreddit (if applicable — check rules first)
- [ ] DM local food bloggers / Instagram food accounts (offer influencer code)
- [ ] Ask partner businesses to post about LetsGo on their social media
  - Give them a template post they can copy-paste
  - "Our customers can now earn cash-back with @useletsgo!"

#### Flyers at Partner Businesses (Reps Handle Distribution)
- [ ] Design user-facing flyer in Canva:
  - "Get PAID to eat out"
  - QR code to useletsgo.com
  - List of partner businesses on the platform
  - "Download free — no catch"
- [ ] Send PDF to sales reps → they distribute at businesses they've signed up
- [ ] Ask businesses to mention LetsGo to their customers
- [ ] Print extras for college campuses, gyms, apartment complexes (reps can drop off)
- [ ] Cost: ~$50-100 for 200-500 flyers at Staples/FedEx

#### Promotions to Drive First Usage
- [ ] Create a launch promotion in admin → Promotions:
  - "LAUNCH" code: first receipt gets DOUBLE cash-back
  - Limited to first 100 users
- [ ] Coordinate with 1-2 businesses for a "LetsGo Launch Night":
  - Business offers a deal (10% off or free appetizer for LetsGo users)
  - You promote the event on social media
  - Reps promote in-person at the business
  - Everyone who comes signs up for LetsGo and uploads a receipt
  - You don't have to attend — reps run it, you promote online

### Day 36-42: First Revenue Cycle

#### Generate First Invoices
- [ ] By now you should have receipts flowing in
- [ ] At the end of the month, run invoice generation from admin:
  - Admin → Billing → Generate Invoices
- [ ] Review generated invoices for accuracy:
  - Premium plan fees (if any businesses on Premium)
  - Payout amounts (cash-back owed to users)
  - LetsGo fees (10% per receipt, capped $5)
  - Ad campaign charges (if any)
- [ ] Send invoices to businesses (the system handles this)
- [ ] Charge invoices via Stripe from admin dashboard

#### Process First User Payouts
- [ ] Users should have approved receipts by now
- [ ] Check admin → Payouts for pending cashout requests
- [ ] If users haven't requested cashouts, that's OK — balance accumulates
- [ ] For any pending payouts:
  - Review the amounts
  - Approve legitimate payouts
  - Send via PayPal/Venmo from admin
  - Verify delivery
- [ ] This is your first REAL money cycle — document any issues

#### Pay Your Sales Reps (First Commission Cycle)
- [ ] Review admin → Sales → Signups for the period
- [ ] Verify each attributed signup is legitimate
- [ ] Calculate commissions ($100/basic, $250/premium + ad bonuses)
- [ ] Pay reps via PayPal/Venmo/Zelle
- [ ] Mark payouts as paid in admin → Sales → Payouts
- [ ] Communicate pay stubs to reps (amount, signups, period)
- [ ] This builds trust — reps who get paid on time recruit more reps

#### Track Key Metrics
Use the admin executive dashboard + a simple spreadsheet:
- [ ] Total users signed up
- [ ] Total users who uploaded at least 1 receipt
- [ ] Total businesses active
- [ ] Total receipts submitted
- [ ] Total receipt value ($)
- [ ] Total LetsGo fees earned ($)
- [ ] Total user payouts processed ($)
- [ ] Total rep commissions paid ($)
- [ ] LetsGo net revenue = fees earned - rep commissions - operating costs

---

## PHASE 4: SCALE & OPTIMIZE (Days 43-60) — April 17 - May 4
**Goal**: Sustainable growth engine, 25+ businesses, 300+ users, 5-10 active reps

### Day 43-46: Analyze & Iterate

#### Review First Month Data (All From Admin Dashboard)
- [ ] What's the signup-to-first-receipt conversion rate?
- [ ] Which businesses are getting the most traffic?
- [ ] What's the average receipt value?
- [ ] Are users coming back for repeat visits? (check 2nd, 3rd receipts)
- [ ] Which reps are performing best? (admin → Sales → Sales Reps)
- [ ] What's the average signups per rep per week?
- [ ] What feedback are reps getting from businesses?
- [ ] What feedback from users? (check support tickets)

#### Fix Top 3 Issues
- [ ] Whatever the biggest complaints are — fix them this week
- [ ] Common early issues might be:
  - Receipt approval taking too long (solution: push notification to business)
  - Not enough businesses in the feed (solution: push reps harder or recruit more)
  - Payout too slow (solution: faster admin processing cycle)
  - App feels empty (solution: more UGC content, events)
  - Reps not performing (solution: better training, better incentives, or replace)

#### Optimize the Funnel
- [ ] If signups are low: improve the welcome page, add video demo
- [ ] If receipt uploads are low: add in-app prompts, push notifications
- [ ] If business onboarding is slow: simplify the form, let reps do it on-site
- [ ] If retention is low: add push notification reminders ("You haven't been out in a week!")

### Day 47-53: Scale the Sales Rep Team

#### Recruit More Reps (Target: 5-10 Active Reps)
- [ ] Post recruitment ads again on all channels (Craigslist, Indeed, Facebook, etc.)
- [ ] Ask top-performing reps to refer friends ($25 bonus per referred rep who gets a signup)
- [ ] Consider expanding to adjacent cities/areas
- [ ] Each new rep = potential 8-12 new businesses per month

#### Rep Performance Management
- [ ] Weekly leaderboard (share in group chat — reps are competitive)
- [ ] Cut underperformers after 3 weeks of zero signups (they're wasting your time)
- [ ] Increase incentives for top performers (bump commission, give Premium signup bonuses)
- [ ] Create a simple Google Sheet or Notion board reps can see:
  | Rep | This Week | This Month | Total | Earnings |
  |-----|-----------|------------|-------|----------|

#### Scale Bonuses
- [ ] Implement quarterly bonus pool from admin → Sales → Bonus Pool
- [ ] Top 3 reps split the pool
- [ ] Pool is funded by a small % of each signup's commission (already built in system)
- [ ] Announce bonuses to motivate competition

#### Expand Categories
- [ ] Tell reps to target new business types:
  - If you started with restaurants, add bars and breweries
  - Activities: bowling alleys, escape rooms, mini golf, arcades, axe throwing
  - Salons/beauty if there's interest
- [ ] Each new category makes the platform more valuable for users

#### Premium Upsell (You Handle This Remotely)
- [ ] After businesses have been on the platform 2-3 weeks, email/text them:
  - "You've had X customers come through LetsGo! Want to see your star ratings and analytics?"
  - Premium gives them: ratings, analytics dashboard, priority placement in the feed
- [ ] Template email you can copy-paste to each business
- [ ] Or train reps to upsell on their follow-up visits (higher commission: $100 vs $25)
- [ ] This is additional recurring revenue for you

### Day 54-57: Technical Polish

#### ESLint Cleanup
- [ ] Fix the 166 ESLint errors (mostly `any` types)
- [ ] Focus on API routes and payment-related code first
- [ ] This prevents bugs as the codebase grows

#### Performance Optimization
- [ ] Check Vercel analytics for slow pages
- [ ] Optimize any slow database queries (check Supabase dashboard → Logs)
- [ ] Add database indexes if needed for common queries
- [ ] Replace `<img>` tags with Next.js `<Image>` component (7 instances)

#### Wire the Referral Attribution (Technical Improvement)
Currently the "referred by" field in partner onboarding is not automatically linked to sales_signups:
- [ ] Add a sales rep code system (like influencer codes) so reps get unique codes
- [ ] Add autocomplete/validation on the referral field in onboarding Step 1
- [ ] Auto-create sales_signups entry when a business is approved with a valid rep code
- [ ] This eliminates manual attribution work for you in admin

#### Monitoring Setup
- [ ] Set up Vercel alerts for deployment failures
- [ ] Set up Sentry alerts for error spikes
- [ ] Create a daily routine: check Sentry + Vercel + Supabase dashboard each morning
- [ ] Set up uptime monitoring (UptimeRobot — free tier, 50 monitors)

### Day 58-60: Plan Next 90 Days

#### Revenue Assessment
- [ ] Calculate total revenue from first billing cycle
- [ ] Calculate total expenses:
  - Operating: Vercel, Supabase, Stripe fees, PayPal fees
  - Sales: rep commissions, bonuses, bonus pool
  - Marketing: flyers, any paid ads
- [ ] Determine monthly burn rate
- [ ] Set revenue targets for Month 2 and Month 3

#### Rep Team Assessment
- [ ] How many reps are actively producing?
- [ ] What's the average cost-per-acquisition (commission / signup)?
- [ ] Is the commission structure sustainable? (LetsGo fee per receipt vs commission paid)
- [ ] Do you need to adjust rates up or down?
- [ ] Plan for Month 2: recruit X more reps, target Y signups

#### Growth Strategy
- [ ] If the model is working: recruit more reps and expand geography
- [ ] If users aren't sticking: focus on retention features
- [ ] If businesses are churning: have reps do check-in visits, focus on demonstrating ROI
- [ ] Consider geographic expansion (reps in nearby cities)

#### Feature Roadmap
Based on feedback, prioritize the next features:
- [ ] Sales rep self-service dashboard (so reps can see their own stats without you)
- [ ] Stripe Connect for bank payouts (if users want ACH instead of PayPal)
- [ ] Push notification campaigns (re-engagement)
- [ ] Automated referral attribution (rep codes → auto-create sales_signups)
- [ ] Native app wrapper (Capacitor/PWA)
- [ ] Advanced fraud detection
- [ ] Business self-service receipt approval automation

---

## COST ESTIMATES

### Monthly Operating Costs (Estimated)
| Service | Free Tier | Expected Cost |
|---------|-----------|---------------|
| Vercel (hosting) | Free (hobby) or $20/mo (pro) | $0-20/mo |
| Supabase (DB + Auth) | Free tier (500MB, 50K requests) | $0-25/mo |
| Stripe (payment processing) | 2.9% + $0.30 per charge | Per transaction |
| PayPal (payouts) | 2% per payout (min $0.25) | Per transaction |
| Resend (email) | Free (100/day) | $0/mo |
| Google Maps API | $200/mo free credit | $0/mo |
| Sentry (error tracking) | Free (5K events) | $0/mo |
| Google Analytics | Free | $0/mo |
| Domain (GoDaddy) | Already paid | ~$15/year |
| **Total** | | **$0-50/mo + transaction fees** |

### Revenue Potential (Conservative, With Sales Reps)
| Metric | Month 1 | Month 2 | Month 3 |
|--------|---------|---------|---------|
| Active sales reps | 2-3 | 4-6 | 6-10 |
| Active businesses | 5-10 | 15-25 | 30-50 |
| Active users | 50-100 | 150-300 | 300-600 |
| Receipts/month | 100-200 | 300-700 | 800-1800 |
| Avg receipt value | $35 | $35 | $35 |
| **Gross LetsGo fees** | **$350-700** | **$1,050-2,450** | **$2,800-6,300** |
| Premium plans | $0 | $100-250 | $300-750 |
| Ad revenue (spotlights) | $0 | $0-200 | $200-500 |
| **Gross revenue** | **$350-700** | **$1,150-2,900** | **$3,300-7,550** |
| Rep commissions (est.) | -$0* | -$500-1,000 | -$1,500-5,000 |
| Rep bonuses | -$0 | -$50 | -$200 |
| Operating costs | -$0-50 | -$25-50 | -$25-50 |
| **Net revenue** | **$300-650** | **$575-1,800** | **$1,575-2,300** |

*\*Month 1 commissions are $0 because reps don't get paid until the business's first Stripe payment clears. Businesses signed up in Month 1 won't have their first invoice charged until end of Month 1 or early Month 2 — so commissions shift to Month 2.*

*Rep commissions are a COST OF REVENUE, not a loss. Every $100 commission generates a business that produces $3.50/receipt indefinitely. A business generating 20 receipts/month = $70/month in fees from a one-time $100 commission. You'll be negative Month 1 because you're paying upfront commissions on businesses that haven't generated receipts yet — that's normal. By Month 2-3, the recurring fees from those businesses overtake the commission costs.*

### Unit Economics (Why This Works)
| Metric | Value |
|--------|-------|
| Commission per Basic signup | $100 |
| Commission per Premium signup | $250 |
| Avg receipts/business/month | 15-25 |
| Avg LetsGo fee per receipt | $3.50 |
| Monthly revenue per business | $52-87 |
| **Payback period (Basic)** | **~1.5-2 months** |
| **Payback period (Premium)** | **~3-4 months** (but Premium also has monthly plan fee) |
| Lifetime value (12 months) | $630-1,050 (fees only) |
| **LTV:CAC ratio (Basic)** | **6:1 to 10:1** |
| **LTV:CAC ratio (Premium)** | **Higher with monthly plan revenue** |

*The higher commission attracts better reps and motivates more signups. The payback period is slightly longer but LTV is still extremely strong — and the recurring nature means every business you acquire prints money for years.*

---

## DAILY ROUTINE (Once Live — All From Home)

### Morning (45 min)
- [ ] Check Sentry for new errors
- [ ] Check admin dashboard → Receipts (approve/reject pending)
- [ ] Check admin dashboard → Payouts (process any pending)
- [ ] Check admin dashboard → Overview (daily metrics)
- [ ] Check admin → Sales → Signups (any new businesses from reps?)
- [ ] Respond to any support tickets
- [ ] Approve any new business onboarding submissions

### Midday (1-2 hours)
- [ ] Text/Slack check-in with sales reps ("How's today going?")
- [ ] Review any new business profiles — improve photos, descriptions, tags
- [ ] Answer rep questions (objection handling, onboarding issues)
- [ ] DM 2-3 potential influencers or respond to influencer messages
- [ ] Create/schedule 1 social media post
- [ ] If recruiting: review rep applications, schedule phone screens

### Evening (30 min)
- [ ] Post on social media (or let scheduled posts go out)
- [ ] Quick scan of user activity and engagement
- [ ] Text reps: "How'd today go? Any signups?"
- [ ] Log rep activity in admin → Sales
- [ ] Plan tomorrow (who to DM, what content to create)

### Weekly (1 hour, pick a day)
- [ ] Review weekly metrics: signups, receipts, revenue
- [ ] Send reps a weekly leaderboard update
- [ ] Process any commission payouts due
- [ ] Identify and cut underperforming reps
- [ ] Post new recruitment ads if you need more reps

---

## CRITICAL SUCCESS METRICS

### Week 1 (by March 12)
- [ ] Stripe LIVE and tested with real money
- [ ] PayPal LIVE and tested with real money
- [ ] Sentry + Google Analytics installed
- [ ] Full E2E test passed on production

### Week 2 (by March 19)
- [ ] Sales materials created (one-pager, pitch deck, FAQ, training doc)
- [ ] Rep recruitment ads posted on 5+ channels
- [ ] 2-3 reps recruited and onboarded
- [ ] Reps have materials and are hitting the streets

### Week 3 (by March 26)
- [ ] 5+ businesses live and active (from reps)
- [ ] First rep commissions calculated
- [ ] Social media accounts created and posting
- [ ] First receipts flowing through the system

### Week 6 (by April 16)
- [ ] 4-6 active sales reps
- [ ] 15+ businesses active
- [ ] 100+ users signed up
- [ ] First invoices generated and charged
- [ ] First user payouts processed
- [ ] First rep commission payouts processed
- [ ] REAL REVENUE IN YOUR BANK ACCOUNT

### Week 9 (by May 4)
- [ ] 6-10 active sales reps
- [ ] 30+ businesses
- [ ] 300+ users
- [ ] Consistent weekly receipt volume
- [ ] Monthly net revenue (after commissions) exceeding operating costs
- [ ] Clear growth trend
- [ ] Self-sustaining: reps recruit reps, businesses attract users

---

## EMERGENCY PRIORITIES

If you only have time for ONE thing each day:

1. **Days 1-7**: Get payments live (Stripe + PayPal)
2. **Days 8-14**: Recruit sales reps (this is YOUR bottleneck)
3. **Days 15-28**: Support reps + approve businesses they bring in
4. **Days 29-42**: Drive user acquisition + process first revenue
5. **Days 43-60**: Scale the rep team + optimize

**The #1 thing that will make or break this: RECRUITING AND RETAINING GOOD SALES REPS.**

You don't need to be the one walking into restaurants. You need to find people who LOVE doing that and pay them well for it. Your job is to be the operator: recruit reps, build materials, approve businesses, manage the platform, and collect revenue.

### Your Strengths as an Introvert Founder:
- You built the entire platform — you understand every detail
- You can manage reps via text/Slack (no meetings required)
- You can create all marketing materials from your computer
- The admin dashboard gives you full visibility without leaving home
- Social media, influencer outreach, and DMs are all text-based
- Your sales reps are your extrovert layer — let them do what they're good at

---

## QUICK REFERENCE: KEY URLS

| What | URL |
|------|-----|
| Your app | https://www.useletsgo.com |
| Partner onboarding | https://www.useletsgo.com/partner-onboarding |
| Admin dashboard | https://www.useletsgo.com/admin |
| Stripe Dashboard | https://dashboard.stripe.com |
| PayPal Developer | https://developer.paypal.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| Supabase Dashboard | https://supabase.com/dashboard |
| Sentry | https://sentry.io |
| Google Analytics | https://analytics.google.com |

---

## SALES REP QUICK REFERENCE

### Commission Structure (Already Built in Admin)
| Action | Commission |
|--------|-----------|
| Basic plan business signup | $100 |
| Premium plan business signup | $250 |
| Per $100 ad spend purchased | $10 |
| Quarterly bonus pool (top performers) | Split among top 3 |
| Refer another rep (who gets 1st signup) | $25 bonus |

### Payout Schedule
- Bi-monthly: Period 1 (1st-15th) and Period 2 (16th-end)
- Pay within 3-5 days of period end
- Via PayPal, Venmo, or Zelle (same system as user payouts)
- **Commission triggers on first successful Stripe payment from the business — not on signup**

### What Reps Need From You
1. Training document (PDF)
2. Business one-pager (PDF — they print copies)
3. Pitch deck (Google Slides link)
4. FAQ sheet (PDF)
5. Their name to put in the "referred by" field
6. Responsive text/Slack support for questions
7. On-time commission payments

### Where to Find Reps (Ranked by Quality)
1. **Former restaurant/bar workers** — they know owners, speak the language (best)
2. **Real estate agents** — used to commission, know local businesses
3. **Event planners** — already visit venues regularly
4. **College business students** — hungry, energetic, cheap
5. **Craigslist/Indeed gig workers** — high volume, mixed quality
6. **Your personal network** — friends/family who are outgoing

### Red Flags (Don't Hire These People)
- Want hourly pay or a base salary (not 1099 material)
- Can't commit to at least 5 hours/week
- No reliable transportation
- Want to "work from home" (this is a feet-on-the-street job)
- Can't clearly explain what LetsGo does after reading the training doc

---

*This plan is designed for an introvert founder managing a remote sales team. You never have to walk into a restaurant or make a cold pitch. Your reps are your extrovert layer. Your job is to recruit, equip, support, and pay them — all from your computer. The most important thing is momentum — do something every single day that moves you closer to revenue.*
