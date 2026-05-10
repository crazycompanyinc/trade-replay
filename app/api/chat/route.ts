import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const { agentId, message, conversationId } = await req.json();
  
  // Verify agent belongs to user
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId: session.user.id },
  });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  
  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const conv = await prisma.conversation.create({
      data: { userId: session.user.id, agentId, title: message.slice(0, 50) },
    });
    convId = conv.id;
  }
  
  // Save user message
  await prisma.message.create({
    data: { conversationId: convId, role: "user", content: message },
  });
  
  // Get conversation history
  const history = await prisma.message.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  
  // Build messages for AI
  const messages = [
    { role: "system", content: agent.systemPrompt || `You are ${agent.name}, a ${agent.role} agent.` },
    ...history.map((m: any) => ({ role: m.role, content: m.content })),
  ];
  
  // Call OpenRouter
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  let assistantContent = "";
  
  if (openrouterKey) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "ZOO Agents Platform",
        },
        body: JSON.stringify({
          model: agent.model || "openrouter/owl-alpha",
          messages,
          temperature: agent.temperature || 0.7,
          max_tokens: agent.maxTokens || 2048,
        }),
      });
      const data = await response.json();
      assistantContent = data.choices?.[0]?.message?.content || "I apologize, I couldn't generate a response.";
    } catch {
      assistantContent = "Error connecting to AI provider. Please try again.";
    }
  } else {
    // Demo mode - echo response
    assistantContent = `[Demo Mode] I am ${agent.name}, your ${agent.role}. You said: "${message}". Connect OPENROUTER_API_KEY for real AI responses.`;
  }
  
  // Save assistant message
  const assistantMsg = await prisma.message.create({
    data: { conversationId: convId, role: "assistant", content: assistantContent },
  });
  
  // Update agent activity
  await prisma.agent.update({
    where: { id: agentId },
    data: { lastActiveAt: new Date() },
  });
  
  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      agentId,
      type: "chat",
      message: `Chat with ${agent.name}: ${message.slice(0, 80)}`,
    },
  });
  
  return NextResponse.json({
    message: assistantContent,
    conversationId: convId,
    messageId: assistantMsg.id,
  });
}
