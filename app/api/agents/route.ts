import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const agents = await prisma.agent.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { tasks: true, conversations: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { templateId, name } = await req.json();
  
  // Get template
  const template = await prisma.agentTemplate.findUnique({ where: { id: templateId } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  
  // Check user tier
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const tierOrder = ["FREE", "STARTER", "GROWTH", "SCALE", "ENTERPRISE"];
  if (tierOrder.indexOf(user!.tier) < tierOrder.indexOf(template.tierRequired)) {
    return NextResponse.json({ error: "Upgrade required for this agent" }, { status: 403 });
  }
  
  const agentName = name || template.name;
  const agent = await prisma.agent.create({
    data: {
      userId: session.user.id,
      templateId: template.id,
      name: agentName,
      title: template.title,
      role: template.role,
      department: template.department,
      model: template.model,
      systemPrompt: template.systemPrompt,
      temperature: template.temperature,
      maxTokens: template.maxTokens,
      skills: template.defaultSkills,
      tools: template.defaultTools,
      element: template.element,
      avatarUrl: template.avatarUrl,
    },
  });
  
  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      agentId: agent.id,
      type: "agent_created",
      message: `Agent ${agent.name} deployed from template ${template.slug}`,
    },
  });
  
  return NextResponse.json(agent);
}
