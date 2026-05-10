import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  // Verify conversation belongs to user
  const conv = await prisma.conversation.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  const messages = await prisma.message.findMany({
    where: { conversationId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}
