import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id },
    include: { agent: { select: { id: true, name: true, department: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { title, description, agentId, priority, tags, kanbanColumn } = await req.json();
  
  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      agentId,
      title,
      description,
      priority: priority || "MEDIUM",
      tags: tags || [],
      kanbanColumn: kanbanColumn || "backlog",
    },
  });
  
  if (agentId) {
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: "WORKING" },
    });
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        agentId,
        type: "task_start",
        message: `Task assigned: ${title}`,
      },
    });
  }
  
  return NextResponse.json(task);
}
