// app/api/homeiq/saved/[id] — update a saved lead's pipeline status/notes, or remove it.

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase";
import { getServerUser } from "@/lib/server-supabase";

export const dynamic = "force-dynamic";

const STAGES = [
  "new",
  "contacted",
  "analyzing",
  "offer",
  "contract",
  "closed",
  "dead",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.status === "string" && STAGES.includes(body.status))
    patch.status = body.status;
  if (typeof body.notes === "string") patch.notes = body.notes;

  const sb = createServerComponentClient();

  // OUTCOME CAPTURE — the learning loop. When a deal resolves, record the ACTUAL numbers into the
  // snapshot jsonb (no schema change). The snapshot already holds the lead's features at save-time
  // (score/tier/mao/arv/verdict/source); pairing them with the realized profit is the training data a
  // future calibration model learns from (which leads actually make money). num-only, merge-preserving.
  if (body.outcome && typeof body.outcome === "object") {
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const o = body.outcome as Record<string, unknown>;
    const { data: cur } = await sb
      .from("saved_properties")
      .select("snapshot")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    const snap: Record<string, any> =
      cur?.snapshot && typeof cur.snapshot === "object" ? cur.snapshot : {};
    snap.outcome = {
      ...(snap.outcome || {}),
      actualProfit: num(o.actualProfit),
      salePrice: num(o.salePrice),
      purchasePrice: num(o.purchasePrice),
      at: new Date().toISOString(),
    };
    patch.snapshot = snap;
  }

  if (!Object.keys(patch).length)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { error } = await sb
    .from("saved_properties")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const {
    data: { user },
  } = await getServerUser();
  if (!user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const sb = createServerComponentClient();
  const { error } = await sb
    .from("saved_properties")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
