import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// ─── Types ───

interface ContactInput {
  name: string;
  emails: string[];
  phones: string[];
}

interface MatchedUser {
  contactName: string;
  userId: string;
  userName: string;
  username: string | null;
  avatarUrl: string | null;
}

interface UnmatchedContact {
  contactName: string;
  email: string | null;
  phone: string | null;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
};

/** Normalize a phone number to just digits (strip +, spaces, dashes, parens) */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If 11 digits starting with 1, strip the country code
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function getDisplayName(p: ProfileRow): string {
  if (p.full_name) return p.full_name;
  const parts = [p.first_name, p.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return p.username || "User";
}

/**
 * Extract user ID from Authorization Bearer token.
 */
async function extractUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { data } = await supabaseServer.auth.getUser(token);
  return data.user?.id ?? null;
}

// ═══════════════════════════════════════════════════
// POST /api/contacts/import
//
// Process imported contacts — match against existing
// LetsGo users by email and phone number.
//
// Body: { contacts: ContactInput[] }
// Returns: { matched: MatchedUser[], unmatched: UnmatchedContact[] }
// ═══════════════════════════════════════════════════

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const userId = await extractUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const contacts = (body.contacts ?? []) as ContactInput[];

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: "contacts array is required" },
        { status: 400 }
      );
    }

    // Cap at 500 contacts per import
    const capped = contacts.slice(0, 500);

    // Collect all unique emails (lowercased) from contacts
    const emailToContact = new Map<string, ContactInput>();
    for (const c of capped) {
      for (const email of c.emails) {
        const lower = email.toLowerCase().trim();
        if (lower && lower.includes("@")) {
          emailToContact.set(lower, c);
        }
      }
    }

    // Collect all unique phone numbers (normalized to 10 digits) from contacts
    const phoneToContact = new Map<string, ContactInput>();
    for (const c of capped) {
      for (const phone of c.phones) {
        const normalized = normalizePhone(phone);
        if (normalized.length >= 10) {
          phoneToContact.set(normalized, c);
        }
      }
    }

    const allEmails = [...emailToContact.keys()];
    const allPhones = [...phoneToContact.keys()];

    // Track matched user IDs to avoid duplicates (same person matched by email AND phone)
    const matchedUserIds = new Set<string>();
    const matchedContactKeys = new Set<string>();
    const matched: MatchedUser[] = [];

    // Helper to get a unique key for a contact
    const contactKey = (c: ContactInput) => c.name + "|" + (c.emails[0] || "") + "|" + (c.phones[0] || "");

    // Helper to add a matched profile
    const addMatch = (profile: ProfileRow, contact: ContactInput) => {
      if (profile.id === userId) return; // Skip the requesting user
      if (matchedUserIds.has(profile.id)) return; // Already matched
      matchedUserIds.add(profile.id);
      matchedContactKeys.add(contactKey(contact));
      matched.push({
        contactName: contact.name,
        userId: profile.id,
        userName: getDisplayName(profile),
        username: profile.username,
        avatarUrl: profile.avatar_url,
      });
    };

    // Match by email — batch in chunks of 100
    if (allEmails.length > 0) {
      for (let i = 0; i < allEmails.length; i += 100) {
        const batch = allEmails.slice(i, i + 100);
        const { data } = await supabaseServer
          .from("profiles")
          .select("id, full_name, first_name, last_name, username, avatar_url, email, phone")
          .in("email", batch);

        for (const profile of (data || []) as ProfileRow[]) {
          const profileEmail = (profile.email || "").toLowerCase().trim();
          const contact = emailToContact.get(profileEmail);
          if (contact) addMatch(profile, contact);
        }
      }
    }

    // Match by phone number — batch in chunks of 100
    if (allPhones.length > 0) {
      // Query profiles that have a phone set, then compare normalized values
      // Supabase doesn't support function-based matching, so fetch all profiles with phones
      // and filter client-side. For efficiency, batch by phone digits.
      for (let i = 0; i < allPhones.length; i += 100) {
        const batch = allPhones.slice(i, i + 100);
        // Try matching with multiple formats: raw 10 digits, with +1, with 1
        const phoneVariants: string[] = [];
        for (const p of batch) {
          phoneVariants.push(p);           // 4025150880
          phoneVariants.push("1" + p);     // 14025150880
          phoneVariants.push("+1" + p);    // +14025150880
        }

        const { data } = await supabaseServer
          .from("profiles")
          .select("id, full_name, first_name, last_name, username, avatar_url, email, phone")
          .in("phone", phoneVariants);

        for (const profile of (data || []) as ProfileRow[]) {
          if (!profile.phone) continue;
          const normalizedProfilePhone = normalizePhone(profile.phone);
          const contact = phoneToContact.get(normalizedProfilePhone);
          if (contact) addMatch(profile, contact);
        }
      }
    }

    // Build unmatched list — contacts that didn't match by email or phone
    const unmatched: UnmatchedContact[] = [];
    for (const c of capped) {
      if (matchedContactKeys.has(contactKey(c))) continue;

      // Double-check: did any of this contact's emails or phones match?
      const emailMatch = c.emails.some((e) => {
        const lower = e.toLowerCase().trim();
        return [...emailToContact.keys()].some((k) => k === lower) && matchedContactKeys.has(contactKey(emailToContact.get(lower)!));
      });
      if (emailMatch) continue;

      const phoneMatch = c.phones.some((p) => {
        const normalized = normalizePhone(p);
        return phoneToContact.has(normalized) && matchedContactKeys.has(contactKey(phoneToContact.get(normalized)!));
      });
      if (phoneMatch) continue;

      unmatched.push({
        contactName: c.name,
        email: c.emails[0] || null,
        phone: c.phones[0] || null,
      });
    }

    return NextResponse.json({ matched, unmatched });
  } catch (err) {
    console.error("[contacts/import] POST unexpected error:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
