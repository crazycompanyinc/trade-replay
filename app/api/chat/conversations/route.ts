import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  
  const where: any = { userId: session.user.id };
  if (agentId) where.agentId = agentId;
  
  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      agent: { select: { id: true, name: true, department: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return NextResponse.json(conversations);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { agentId, title } = await req.json();
  const conv = await prisma.conversation.create({
    data: { userId: session.user.id, agentId, title },
  });
  return NextResponse.json(conv);
}
