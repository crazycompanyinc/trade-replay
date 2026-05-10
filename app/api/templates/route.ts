import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const templates = await prisma.agentTemplate.findMany({
    where: { isActive: true },
    orderBy: { department: "asc" },
  });
  return NextResponse.json(templates);
}
