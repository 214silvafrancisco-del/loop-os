import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/core/db/client";

/** Saúde da app e da ligação à base de dados (usado pelo Docker/Coolify). */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up", at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
