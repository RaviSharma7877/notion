import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    const mockChartData = [
      { name: "Jan", value: 400, uv: 2400, pv: 1398 },
      { name: "Feb", value: 300, uv: 1398, pv: 9800 },
      { name: "Mar", value: 200, uv: 9800, pv: 2290 },
      { name: "Apr", value: 278, uv: 3908, pv: 2000 },
      { name: "May", value: 189, uv: 4800, pv: 2181 },
      { name: "Jun", value: 239, uv: 3800, pv: 2500 },
    ]

    return NextResponse.json(mockChartData)
  } catch (error) {
    console.error("[v0] Chart API error:", error)
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 })
  }
}
