import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const agentId = searchParams.get("agentId");
  
  const where: any = { userId: session.user.id };
  if (agentId) where.agentId = agentId;
  
  const logs = await prisma.activityLog.findMany({
    where,
    include: { agent: { select: { id: true, name: true, department: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(logs);
}
