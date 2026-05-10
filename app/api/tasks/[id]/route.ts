import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const body = await req.json();
  const updateData: any = {};
  
  if (body.status) updateData.status = body.status;
  if (body.kanbanColumn) updateData.kanbanColumn = body.kanbanColumn;
  if (body.kanbanPosition !== undefined) updateData.kanbanPosition = body.kanbanPosition;
  if (body.priority) updateData.priority = body.priority;
  if (body.title) updateData.title = body.title;
  if (body.description) updateData.description = body.description;
  if (body.result) updateData.result = body.result;
  if (body.agentId !== undefined) updateData.agentId = body.agentId;
  if (body.status === "DONE") updateData.completedAt = new Date();
  
  const task = await prisma.task.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: updateData,
  });
  
  if (task.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  // Log status change
  if (body.status) {
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        agentId: body.agentId,
        type: body.status === "DONE" ? "task_complete" : "status_change",
        message: `Task "${body.title || params.id}" → ${body.status}`,
      },
    });
  }
  
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  await prisma.task.deleteMany({
    where: { id: params.id, userId: session.user.id },
  });
  return NextResponse.json({ success: true });
}
