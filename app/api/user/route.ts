import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      _count: { select: { agents: true, tasks: true, conversations: true } },
    },
  });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const body = await req.json();
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: body.name },
  });
  return NextResponse.json(user);
}
