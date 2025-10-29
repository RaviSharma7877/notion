import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500))

    const mockMessages = [
      {
        id: "1",
        content: "Hello! How can I help you today?",
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        sender: "Assistant",
      },
      {
        id: "2",
        content: "I need help with the data visualization",
        timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
        sender: "User",
      },
      {
        id: "3",
        content: "Let me fetch the latest chart data for you.",
        timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
        sender: "Assistant",
      },
    ]

    return NextResponse.json(mockMessages)
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}
