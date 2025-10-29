"use client"

import type React from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import type { DatabaseBlock } from "@/lib/notion-types"

interface ChartRendererProps {
  block: DatabaseBlock
  onUpdate: (updates: Partial<DatabaseBlock>) => void
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658", "#FF7C7C"]

export const ChartRenderer: React.FC<ChartRendererProps> = ({ block, onUpdate }) => {
  const records = block.records || []
  const properties = block.properties || []

  if (records.length === 0 || properties.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center py-8 text-muted-foreground">Add records and properties to display chart</div>
        </CardContent>
      </Card>
    )
  }

  // Transform records into chart data
  const chartData = records.map((record) => {
    const data: Record<string, any> = {}
    properties.forEach((prop) => {
      data[prop.name] = record.properties[prop.id]
    })
    return data
  })

  const renderChart = () => {
    const chartType = (block as any).chartType || "bar"
    const xAxis = (block as any).xAxis || properties[0]?.name
    const yAxis = (block as any).yAxis || properties[1]?.name

    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={yAxis} fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        )
      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey={yAxis} stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        )
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie data={chartData} dataKey={yAxis} nameKey={xAxis} cx="50%" cy="50%" outerRadius={80} label>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )
      case "area":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={xAxis} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey={yAxis} fill="#8884d8" stroke="#8884d8" />
            </AreaChart>
          </ResponsiveContainer>
        )
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chart View</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto">{renderChart()}</div>
      </CardContent>
    </Card>
  )
}
