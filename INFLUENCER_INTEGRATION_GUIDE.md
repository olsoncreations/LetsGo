# Influencer Program Integration Guide

## Overview
This guide explains how to integrate the influencer code system into your user signup flow.

## Database Setup

### 1. Run the Migration
Execute the SQL migration in Supabase SQL Editor:
```bash
# File location: /migrations/create-influencer-tables.sql
```

This creates:
- `influencers` - Influencer profiles with rates and stats
- `influencer_signups` - Tracks which users signed up with which code
- `influencer_payouts` - Payout history and pending payments

### 2. Verify Tables Created
After running the migration, verify in Supabase:
- Check that all 3 tables exist
- Verify RLS policies are enabled
- Confirm indexes are created

## User Signup Integration

### Option 1: Add to Existing Signup Form

Add an optional influencer code field to your signup form (e.g., `/app/signup/page.tsx`):

```tsx
const [influencerCode, setInfluencerCode] = useState("");

// In your signup form JSX:
<div>
  <label>Influencer Code (Optional)</label>
  <input
    type="text"
    value={influencerCode}
    onChange={(e) => setInfluencerCode(e.target.value.toUpperCase())}
    placeholder="Enter code (e.g., SARAH2026)"
    style={{ textTransform: "uppercase" }}
  />
</div>
```

### Option 2: URL Parameter (Recommended)

Support influencer codes via URL parameter:
```
https://yourapp.com/signup?ref=SARAH2026
```

In your signup page:
```tsx
import { useSearchParams } from 'next/navigation';

export default function SignupPage() {
  const searchParams = useSearchParams();
  const [influencerCode, setInfluencerCode] = useState(
    searchParams.get('ref')?.toUpperCase() || ""
  );

  // ... rest of component
}
```

### 3. Save Attribution on Signup

After user successfully signs up, save the influencer attribution:

```tsx
async function handleSignup() {
  // 1. Create user account (your existing signup logic)
  const { data: authData, error: authError } = await supabaseBrowser.auth.signUp({
    email,
    password,
  });

  if (authError || !authData.user) {
    // Handle error
    return;
  }

  // 2. If influencer code provided, attribute signup
  if (influencerCode.trim()) {
    try {
      // Verify influencer code exists and is active
      const { data: influencer } = await supabaseBrowser
        .from("influencers")
        .select("id, status")
        .eq("code", influencerCode.toUpperCase())
        .eq("status", "active")
        .single();

      if (influencer) {
        // Save attribution
        await supabaseBrowser.from("influencer_signups").insert({
          influencer_id: influencer.id,
          user_id: authData.user.id,
        });

        console.log(`✅ Signup attributed to influencer code: ${influencerCode}`);
      } else {
        console.warn(`Invalid or inactive influencer code: ${influencerCode}`);
        // Don't block signup, just log the issue
      }
    } catch (err) {
      console.error("Error saving influencer attribution:", err);
      // Don't block signup for attribution errors
    }
  }

  // 3. Continue with rest of signup flow
  // ...
}
```

## Admin Dashboard Usage

### Accessing Influencer Management

Navigate to: `/admin/referrals`

The influencer section appears at the bottom of the Referrals page.

### Key Features

1. **Add Influencer**
   - Click "+ Add Influencer"
   - Enter name, unique code, email, and rate
   - Default rate: $50 per 1,000 signups

2. **Edit Rates**
   - Click "Edit Rate" next to any influencer
   - Enter new rate and reason for change
   - All rate changes are logged in notes for audit

3. **Generate Payouts**
   - When an influencer reaches 1,000+ unpaid signups
   - Click "Generate Payout" button
   - System calculates: `floor(unpaid_signups / 1000) × rate`
   - Payout appears in "Pending Payouts" section

4. **Mark Payouts as Paid**
   - Review pending payouts
   - Click "Mark Paid" when payment is sent
   - Automatically updates influencer's total_paid

5. **Pause/Activate Influencers**
   - Paused influencers cannot receive new signups
   - Useful for inactive partnerships or contract changes

## Payout Calculation Example

**Influencer: Sarah Johnson**
- Code: SARAH2026
- Rate: $75 per 1,000 signups
- Total signups: 3,247
- Already paid: 3,000 signups ($225)

**When you click "Generate Payout":**
- Unpaid signups: 3,247 - 3,000 = 247
- Not enough for payout (need 1,000 minimum)
- Button won't appear

**After Sarah reaches 4,000 signups:**
- Unpaid signups: 4,000 - 3,000 = 1,000
- Payout groups: floor(1,000 / 1,000) = 1
- Payout amount: 1 × $75 = $75
- Creates payout for 1,000 signups

## Best Practices

1. **Unique Codes**: Use memorable, brand-safe codes (SARAH2026, not SARAH123)
2. **Rate Transparency**: Document all rate changes with clear reasons
3. **Regular Payouts**: Review pending payouts weekly/monthly
4. **Communication**: Notify influencers when payouts are processed
5. **Performance Review**: Use the "Top Performers" chart to identify high performers
6. **Code Sharing**: Provide influencers with trackable URLs like `yourapp.com/signup?ref=CODE`

## Troubleshooting

### "Invalid influencer code" during signup
- Code doesn't exist in database
- Influencer status is "paused" or "suspended"
- Code is case-sensitive (always uppercase)

### Signup count not updating
- Check if signup was attributed (query `influencer_signups` table)
- Verify trigger `trigger_update_influencer_signup_count` is active
- Check for duplicate user_id + influencer_id (unique constraint)

### Payout amount incorrect
- Verify rate_per_thousand_cents value (in cents, not dollars)
- Check if all previous payouts were marked as paid
- Review calculation: `floor(unpaid_signups / 1000) × rate`

## Security Notes

- ✅ RLS policies restrict all tables to admin users only
- ✅ Influencer codes are public (users enter them during signup)
- ✅ Rates and payout data are admin-only
- ✅ All rate changes are logged with timestamps
- ⚠️ Service role key bypasses RLS - use server-side only

## Next Steps

1. Run the migration SQL
2. Add influencer code input to signup form
3. Add attribution logic after successful signup
4. Create your first test influencer in admin
5. Test signup flow with influencer code
6. Verify attribution in admin dashboard

---

**Questions?** Check the influencer tables directly in Supabase or review the admin page code at `/app/admin/referrals/page.tsx`.
