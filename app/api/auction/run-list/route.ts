import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";
import { isValidVin, normalizeVin } from "@/lib/vehicle/vin";
import { maintenanceQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";

// POST /api/auction/run-list - Upload a new run list
export async function POST(request: NextRequest) {
  try {
    let getUserResult: { data: { user: any }; error: any };
    try {
      getUserResult = await getServerUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const {
      data: { user },
    } = getUserResult;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { auction_name, auction_date, vins: rawVins } = body;

    if (!auction_name || !auction_date) {
      return NextResponse.json(
        { error: "auction_name and auction_date are required" },
        { status: 400 },
      );
    }

    let vinList: string[] = [];
    if (Array.isArray(rawVins)) {
      vinList = rawVins;
    } else if (typeof rawVins === "string") {
      // Split by comma, space, or newline
      vinList = rawVins
        .split(/[,\s\n]+/)
        .map((v) => v.trim())
        .filter(Boolean);
    }

    const validVins = Array.from(
      new Set(vinList.map((v) => normalizeVin(v)).filter((v) => isValidVin(v))),
    );

    if (validVins.length === 0) {
      return NextResponse.json(
        { error: "No valid 17-character ISO-3779 VINs found" },
        { status: 400 },
      );
    }

    const supabase = createServerComponentClient();
    const { data, error } = await supabase
      .from("auction_run_lists")
      .insert({
        user_id: userId,
        auction_name,
        auction_date,
        vins: validVins,
        total_count: validVins.length,
        processed_count: 0,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger the background job
    try {
      await maintenanceQueue.add("run-list-process", { runListId: data.id });
    } catch (qErr: any) {
      console.error("[API] Failed to queue run-list-process job:", qErr);
      // Update status to failed since we can't queue it
      await supabase
        .from("auction_run_lists")
        .update({ status: "failed" })
        .eq("id", data.id);
      return NextResponse.json(
        { error: "Failed to queue job for background processing" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/auction/run-list - List uploaded run lists
export async function GET(request: NextRequest) {
  try {
    let getUserResult: { data: { user: any }; error: any };
    try {
      getUserResult = await getServerUser();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const {
      data: { user },
    } = getUserResult;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    const supabase = createServerComponentClient();
    const { data, error } = await supabase
      .from("auction_run_lists")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
