"use client"

import type React from "react"
import type { DatabaseBlock, DatabaseViewType } from "@/lib/notion-types"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import { TableIcon, BarChart3, Grid3X3, ListIcon, Calendar, Clock, Plus, MoreHorizontal } from "lucide-react"

interface DatabaseViewProps {
  block: DatabaseBlock
  onUpdate: (updates: Partial<DatabaseBlock>) => void
}

const viewIcons: Record<DatabaseViewType, React.ReactNode> = {
  table: <TableIcon className="h-4 w-4" />,
  board: <BarChart3 className="h-4 w-4" />,
  gallery: <Grid3X3 className="h-4 w-4" />,
  list: <ListIcon className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  timeline: <Clock className="h-4 w-4" />,
  chart: <BarChart3 className="h-4 w-4" />,
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ block, onUpdate }) => {
  const properties = block.properties || []
  const records = block.records || []

  const renderTableView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Table View</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
          <Button size="sm" variant="ghost">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="border-b border-[rgba(55,53,47,0.09)]">
              {properties.map((property) => (
                <TableHead
                  key={property.id}
                  className="bg-[#F1F1EF] text-[12px] uppercase tracking-wide font-medium text-foreground/80 sticky top-0"
                >
                  {property.name}
                </TableHead>
              ))}
              <TableHead className="w-12 bg-[#F1F1EF]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={properties.length + 1} className="text-center py-8 text-muted-foreground">
                  No records yet
                </TableCell>
              </TableRow>
            ) : (
              records.map((record) => (
                <TableRow key={record.id} className="hover:bg-muted/20">
                  {properties.map((property) => (
                    <TableCell
                      key={property.id}
                      className="text-[14px] leading-[1.3] px-2 py-1 border-b border-[rgba(55,53,47,0.09)]"
                    >
                      {renderPropertyValue(record.properties[property.id], property.type)}
                    </TableCell>
                  ))}
                  <TableCell className="border-b border-[rgba(55,53,47,0.09)]">
                    <Button size="sm" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )

  const renderBoardView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Board View</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Card
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["To Do", "In Progress", "Done"].map((column) => (
          <Card key={column} className="border border-[rgba(55,53,47,0.09)] rounded-[6px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-[14px] font-medium">{column}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {records
                .filter((_, index) => index % 3 === ["To Do", "In Progress", "Done"].indexOf(column))
                .map((record) => (
                  <Card key={record.id} className="p-3 border border-[rgba(55,53,47,0.09)] rounded-[6px]">
                    <div className="space-y-2">
                      <h4 className="font-medium text-[14px]">{record.properties.title || "Untitled"}</h4>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(record.properties)
                          .filter(([key, value]) => key !== "title" && value)
                          .slice(0, 2)
                          .map(([key, value]) => (
                            <Badge key={key} variant="secondary" className="text-[12px]">
                              {String(value).slice(0, 20)}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </Card>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderGalleryView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Gallery View</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {records.map((record) => (
          <Card key={record.id} className="overflow-hidden rounded-[10px] border border-[rgba(55,53,47,0.09)]">
            <div className="aspect-video bg-muted flex items-center justify-center">
              <div className="text-muted-foreground">No image</div>
            </div>
            <CardContent className="p-3">
              <h4 className="font-medium text-[14px] mb-2">{record.properties.title || "Untitled"}</h4>
              <div className="flex flex-wrap gap-1">
                {Object.entries(record.properties)
                  .filter(([key, value]) => key !== "title" && value)
                  .slice(0, 2)
                  .map(([key, value]) => (
                    <Badge key={key} variant="secondary" className="text-[12px]">
                      {String(value).slice(0, 15)}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderPropertyValue = (value: any, type: string) => {
    if (!value) return <span className="text-muted-foreground">—</span>

    switch (type) {
      case "title":
      case "text":
        return <span>{String(value)}</span>
      case "number":
        return <span>{Number(value)}</span>
      case "checkbox":
        return <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>
      case "select":
        return <Badge variant="outline">{String(value)}</Badge>
      case "multi_select":
        return (
          <div className="flex flex-wrap gap-1">
            {Array.isArray(value) ? (
              value.map((item, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {String(item)}
                </Badge>
              ))
            ) : (
              <Badge variant="outline">{String(value)}</Badge>
            )}
          </div>
        )
      case "date":
        return <span>{new Date(value).toLocaleDateString()}</span>
      case "url":
        return (
          <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-[#487CA5] hover:underline">
            {String(value)}
          </a>
        )
      default:
        return <span>{String(value)}</span>
    }
  }

  const renderView = () => {
    switch (block.viewType) {
      case "table":
        return renderTableView()
      case "board":
        return renderBoardView()
      case "gallery":
        return renderGalleryView()
      case "list":
        return renderTableView()
      case "calendar":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Calendar View</h3>
            <div className="text-center py-8 text-muted-foreground">Calendar view coming soon</div>
          </div>
        )
      case "timeline":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Timeline View</h3>
            <div className="text-center py-8 text-muted-foreground">Timeline view coming soon</div>
          </div>
        )
      case "chart":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Chart View</h3>
            <div className="text-center py-8 text-muted-foreground">Chart view coming soon</div>
          </div>
        )
      default:
        return renderTableView()
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {viewIcons[block.viewType]}
          <CardTitle className="text-lg">Database</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{renderView()}</CardContent>
    </Card>
  )
}
