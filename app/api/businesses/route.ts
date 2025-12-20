// app/api/businesses/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("business") // table name is singular in your Supabase
      .select(
        `
        id,
        name,
        is_active,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        website_url,
        phone_number,
        category_main,
        category_2,
        category_3,
        category_4,
        category_5,
        sun_open,
        sun_close,
        mon_open,
        mon_close,
        tue_open,
        tue_close,
        wed_open,
        wed_close,
        thu_open,
        thu_close,
        fri_open,
        fri_close,
        sat_open,
        sat_close
      `
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Supabase business query error:", error);
      return NextResponse.json(
        { error: "Failed to load businesses" },
        { status: 500 }
      );
    }

    return NextResponse.json({ businesses: data ?? [] });
  } catch (err: any) {
    console.error("Unexpected /api/businesses error:", err);
    return NextResponse.json(
      {
        error: "Unexpected server error",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}