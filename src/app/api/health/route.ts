import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      service: "kaivaryn",
      time: new Date().toISOString(),
      db: "ok",
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "degraded",
        service: "kaivaryn",
        time: new Date().toISOString(),
        db: "error",
        error: e instanceof Error ? e.message : "unknown",
      },
      { status: 503 }
    );
  }
}
