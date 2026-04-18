import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

async function authenticate(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * POST /api/users/avatar
 * Upload an avatar image server-side (bypasses storage policy validation).
 * Body: FormData with "file" field
 * Returns: { publicUrl: string }
 */
export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  // Validate file size (5MB max for avatars)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabaseServer.storage
    .from("avatars")
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadErr.message },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabaseServer.storage.from("avatars").getPublicUrl(path);

  // Update profile with new avatar URL
  const { error: updateErr } = await supabaseServer
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json(
      { error: "Failed to save avatar URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ publicUrl });
}
