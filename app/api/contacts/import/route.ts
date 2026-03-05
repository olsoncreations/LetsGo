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
};

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
// LetsGo users by email (case-insensitive).
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

    const allEmails = [...emailToContact.keys()];

    if (allEmails.length === 0) {
      // No valid emails — return all as unmatched
      const unmatched: UnmatchedContact[] = capped.map((c) => ({
        contactName: c.name,
        email: c.emails[0] || null,
        phone: c.phones[0] || null,
      }));
      return NextResponse.json({ matched: [], unmatched });
    }

    // Query profiles by email (case-insensitive) — batch in chunks of 100
    const matchedProfiles: ProfileRow[] = [];
    for (let i = 0; i < allEmails.length; i += 100) {
      const batch = allEmails.slice(i, i + 100);
      const { data } = await supabaseServer
        .from("profiles")
        .select("id, full_name, first_name, last_name, username, avatar_url, email")
        .in("email", batch);

      if (data) {
        matchedProfiles.push(...(data as ProfileRow[]));
      }
    }

    // Build set of matched emails
    const matchedEmailSet = new Set<string>();
    const matchedContactSet = new Set<string>(); // track which contacts matched

    const matched: MatchedUser[] = [];
    for (const profile of matchedProfiles) {
      // Skip the requesting user
      if (profile.id === userId) continue;

      const profileEmail = (profile.email || "").toLowerCase().trim();
      if (!profileEmail) continue;

      matchedEmailSet.add(profileEmail);

      const contact = emailToContact.get(profileEmail);
      if (contact) {
        matchedContactSet.add(contact.name + "|" + (contact.emails[0] || ""));
        matched.push({
          contactName: contact.name,
          userId: profile.id,
          userName: getDisplayName(profile),
          username: profile.username,
          avatarUrl: profile.avatar_url,
        });
      }
    }

    // Build unmatched list — contacts whose emails didn't match any profile
    const unmatched: UnmatchedContact[] = [];
    for (const c of capped) {
      const key = c.name + "|" + (c.emails[0] || "");
      if (matchedContactSet.has(key)) continue;

      // Check if ANY of this contact's emails matched
      const anyMatch = c.emails.some((e) =>
        matchedEmailSet.has(e.toLowerCase().trim())
      );
      if (anyMatch) continue;

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
