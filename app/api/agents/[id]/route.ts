import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const agent = await prisma.agent.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      tasks: { orderBy: { createdAt: "desc" }, take: 10 },
      conversations: { orderBy: { updatedAt: "desc" }, take: 5 },
      _count: { select: { tasks: true, conversations: true } },
    },
  });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const body = await req.json();
  const agent = await prisma.agent.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: {
      name: body.name,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      skills: body.skills,
      tools: body.tools,
      knowledgeBase: body.knowledgeBase,
      status: body.status,
    },
  });
  if (agent.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  await prisma.agent.deleteMany({
    where: { id: params.id, userId: session.user.id },
  });
  return NextResponse.json({ success: true });
}
