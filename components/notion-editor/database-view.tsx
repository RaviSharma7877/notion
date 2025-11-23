"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import type { DatabaseBlock, DatabaseViewType, DatabaseProperty, DatabaseRecord } from "@/lib/notion-types"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Input } from "../ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table"
import {
  TableIcon,
  BarChart3,
  Grid3X3,
  ListIcon,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { cn } from "@/lib/utils"
import { ErrorBoundary } from "../error-boundary"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"

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

const optionLabel = (option: unknown): string => {
  if (typeof option === "string") return option
  if (option && typeof option === "object" && "name" in option) {
    return String((option as Record<string, unknown>).name)
  }
  if (option && typeof option === "object" && "label" in option) {
    return String((option as Record<string, unknown>).label)
  }
  return option ? String(option) : ""
}

const defaultValueForType = (type: DatabaseProperty["type"]) => {
  switch (type) {
    case "checkbox":
      return false
    case "number":
      return 0
    case "multi_select":
      return []
    case "date":
      return ""
    case "url":
    case "email":
    case "phone":
    case "text":
    case "title":
    default:
      return ""
  }
}

const coerceValueForType = (value: unknown, type: DatabaseProperty["type"]) => {
  switch (type) {
    case "checkbox":
      return Boolean(value)
    case "number":
      return value === "" || value === null || value === undefined ? null : Number(value)
    case "multi_select":
      if (Array.isArray(value)) return value
      if (typeof value === "string") {
        return value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      }
      return []
    default:
      return value ?? ""
  }
}

const buildRecordTemplate = (properties: DatabaseProperty[], seed?: Record<string, any>) => {
  const template: Record<string, any> = { ...(seed || {}) }
  properties.forEach((prop) => {
    if (!(prop.id in template)) {
      template[prop.id] = defaultValueForType(prop.type)
    }
  })
  return template
}

const parseDateValue = (value: unknown): Date | null => {
  if (!value) return null
  if (Array.isArray(value)) {
    return parseDateValue(value[0])
  }
  const date = new Date(value as any)
  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateDisplay = (date: Date) => {
  try {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({ block, onUpdate }) => {
  const properties = block.properties || []
  const records = block.records || []
  const propertyMap = useMemo(() => new Map(properties.map((prop) => [prop.id, prop])), [properties])
  const [isAddingRecord, setIsAddingRecord] = useState(false)
  const [isAddingProperty, setIsAddingProperty] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [newRecord, setNewRecord] = useState<Record<string, any>>(() => buildRecordTemplate(properties))
  const [newProperty, setNewProperty] = useState<{ name: string; type: DatabaseProperty["type"] | "text" }>(
    () => ({ name: "", type: "text" }),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNewRecord((prev) => {
      const allowed = new Set(properties.map((prop) => prop.id))
      let changed = false
      const next: Record<string, any> = {}

      properties.forEach((prop) => {
        if (prop.id in prev) {
          next[prop.id] = prev[prop.id]
        } else {
          next[prop.id] = defaultValueForType(prop.type)
          changed = true
        }
      })

      Object.keys(prev).forEach((key) => {
        if (!allowed.has(key)) {
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [properties])

  useEffect(() => {
    setExpandedCardId(null)
  }, [block.id])

  const titleProperty = useMemo(() => {
    return (
      properties.find((prop) => prop.type === "title") ||
      properties.find((prop) => prop.name.toLowerCase() === "title") ||
      properties[0]
    )
  }, [properties])

  const numberProperty = useMemo(() => {
    return properties.find((prop) => prop.type === "number") || null
  }, [properties])

  const dateProperties = useMemo(() => properties.filter((prop) => prop.type === "date"), [properties])

  const selectProperty = useMemo(() => {
    return (
      properties.find((prop) => prop.type === "select") ||
      properties.find((prop) => prop.name.toLowerCase() === "status") ||
      null
    )
  }, [properties])

  const coverProperty = useMemo(() => {
    return (
      properties.find((prop) => prop.name.toLowerCase().includes("cover")) ||
      properties.find((prop) => prop.name.toLowerCase().includes("image")) ||
      properties.find((prop) => prop.type === "url") ||
      null
    )
  }, [properties])

  const locationProperty = useMemo(() => {
    return properties.find((prop) => prop.name.toLowerCase().includes("location")) || null
  }, [properties])

  const timelineStartProperty = useMemo(() => {
    return (
      properties.find((prop) => prop.name.toLowerCase() === "start") ||
      dateProperties[0] ||
      null
    )
  }, [properties, dateProperties])

  const timelineEndProperty = useMemo(() => {
    return (
      properties.find((prop) => prop.name.toLowerCase() === "end") ||
      dateProperties[1] ||
      dateProperties[0] ||
      null
    )
  }, [properties, dateProperties])

  const addRecordLabel = useMemo(() => {
    switch (block.viewType) {
      case "board":
        return "Add card"
      case "gallery":
        return "Add item"
      case "calendar":
        return "Add event"
      case "timeline":
        return "Add timeline item"
      case "chart":
        return "Add data point"
      default:
        return "Add record"
    }
  }, [block.viewType])

  const handleAddRecord = () => {
    try {
      setError(null)
      if (properties.length === 0) {
        setError("Add a property before creating records")
        return
      }

      const timestamp = new Date().toISOString()
      const recordData: Record<string, any> = {}
      properties.forEach((prop) => {
        recordData[prop.id] = coerceValueForType(newRecord[prop.id], prop.type)
      })

      const newRecordId = `record-${Date.now()}`
      const newEntry: DatabaseRecord = {
        id: newRecordId,
        properties: recordData,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      const updatedRecords: DatabaseRecord[] = [...records, newEntry]

      console.log("[DatabaseView] Adding record:", newEntry)
      console.log("[DatabaseView] Updated records count:", updatedRecords.length)
      onUpdate({ records: updatedRecords, updatedAt: timestamp })
      setIsAddingRecord(false)
      setNewRecord(buildRecordTemplate(properties))
      setExpandedCardId(newRecordId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add record"
      setError(errorMessage)
      console.error("[v0] Error adding record:", err)
    }
  }

  const handleAddProperty = () => {
    try {
      setError(null)

      if (!newProperty.name.trim()) {
        setError("Property name cannot be empty")
        return
      }

      const newProp = {
        id: `prop-${Date.now()}`,
        name: newProperty.name,
        type: newProperty.type as DatabaseProperty['type'],
      }

      const updatedProperties = [...properties, newProp]
      const updatedRecords = records.map((record) => ({
        ...record,
        properties: {
          ...record.properties,
          [newProp.id]: defaultValueForType(newProp.type),
        },
        updatedAt: new Date().toISOString(),
      }))

      onUpdate({ properties: updatedProperties, records: updatedRecords })
      setIsAddingProperty(false)
      setNewProperty({ name: "", type: "text" })
      setNewRecord((prev) => ({ ...prev, [newProp.id]: defaultValueForType(newProp.type) }))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add property"
      setError(errorMessage)
      console.error("[v0] Error adding property:", err)
    }
  }

  const handleDeleteRecord = (recordId: string) => {
    try {
      setError(null)
      const updatedRecords = records.filter((r) => r.id !== recordId)
      onUpdate({ records: updatedRecords })
      if (expandedCardId === recordId) {
        setExpandedCardId(null)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete record"
      setError(errorMessage)
      console.error("[v0] Error deleting record:", err)
    }
  }

  const handleDeleteProperty = (propertyId: string) => {
    try {
      setError(null)
      const updatedProperties = properties.filter((p) => p.id !== propertyId)
      const updatedRecords = records.map((record) => {
        const { [propertyId]: _removed, ...rest } = record.properties
        return {
          ...record,
          properties: rest,
          updatedAt: new Date().toISOString(),
        }
      })

      onUpdate({ properties: updatedProperties, records: updatedRecords })
      setNewRecord((prev) => {
        if (!(propertyId in prev)) return prev
        const { [propertyId]: _omit, ...rest } = prev
        return rest
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete property"
      setError(errorMessage)
      console.error("[v0] Error deleting property:", err)
    }
  }

const handleRecordPropertyChange = (recordId: string, propertyId: string, rawValue: any) => {
  const property = propertyMap.get(propertyId)
  if (!property) return

  const coerced = coerceValueForType(rawValue, property.type)
  const timestamp = new Date().toISOString()

    const updatedRecords = records.map((record) => {
      if (record.id !== recordId) return record
      return {
        ...record,
        properties: {
          ...record.properties,
          [propertyId]: coerced,
        },
        updatedAt: timestamp,
      }
    })

  console.log("[DatabaseView] Updating record property:", { recordId, propertyId, value: coerced })
  onUpdate({ records: updatedRecords, updatedAt: timestamp })
}

  const handleQuickAddBoardCard = (columnValue: string | null) => {
    try {
      setError(null)
      if (!titleProperty) {
        setError("Add a title property to create cards")
        return
      }

      const timestamp = new Date().toISOString()
      const recordProperties: Record<string, any> = {}
      properties.forEach((prop) => {
        recordProperties[prop.id] = defaultValueForType(prop.type)
      })

      recordProperties[titleProperty.id] = "Untitled card"
      if (selectProperty && columnValue) {
        recordProperties[selectProperty.id] = columnValue
      }

      const newRecord: DatabaseRecord = {
        id: `record-${Date.now()}`,
        properties: recordProperties,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      onUpdate({ records: [...records, newRecord] })
      setExpandedCardId(newRecord.id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create card"
      setError(errorMessage)
    }
  }

  const handleBoardDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const { source, destination, draggableId } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const sourceColumn = boardColumns.find((column) => column.id === source.droppableId)
    const destinationColumn = boardColumns.find((column) => column.id === destination.droppableId)
    if (!sourceColumn || !destinationColumn) return

    const recordToMove = records.find((record) => record.id === draggableId)
    if (!recordToMove) return

    const workingRecords = [...records]
    const sourceIndexInData = workingRecords.findIndex((record) => record.id === draggableId)
    if (sourceIndexInData === -1) return
    workingRecords.splice(sourceIndexInData, 1)

    const updatedRecord: DatabaseRecord = {
      ...recordToMove,
      properties: { ...recordToMove.properties },
      updatedAt: new Date().toISOString(),
    }

    if (selectProperty) {
      const destValue = destinationColumn.value ?? ""
      updatedRecord.properties = {
        ...updatedRecord.properties,
        [selectProperty.id]: destValue,
      }
    }

    const matchesColumn = (record: DatabaseRecord, column: (typeof boardColumns)[number]) => {
      if (!selectProperty) return true
      const value = getPropertyValue(record, selectProperty)
      const normalizedValue = value ? String(value) : ""
      const columnValue = column.value ?? ""
      return column.value ? normalizedValue === columnValue : normalizedValue === ""
    }

    const destinationRecords = workingRecords.filter((record) => matchesColumn(record, destinationColumn))

    if (destinationRecords.length === 0 || destination.index >= destinationRecords.length) {
      workingRecords.push(updatedRecord)
    } else {
      const targetRecord = destinationRecords[destination.index]
      const insertIndex = targetRecord
        ? workingRecords.findIndex((record) => record.id === targetRecord.id)
        : workingRecords.length
      if (insertIndex === -1) {
        workingRecords.push(updatedRecord)
      } else {
        workingRecords.splice(insertIndex, 0, updatedRecord)
      }
    }

    onUpdate({ records: workingRecords })
    setExpandedCardId(draggableId)
  }

  const getPropertyValue = (record: DatabaseRecord, property: DatabaseProperty) => {
    return record.properties?.[property.id]
  }

  const renderNewRecordField = (property: DatabaseProperty) => {
    const currentValue = newRecord[property.id]
    const setValue = (value: any) => setNewRecord((prev) => ({ ...prev, [property.id]: value }))

    switch (property.type) {
      case "checkbox":
        return (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(currentValue)}
              onChange={(e) => setValue(e.target.checked)}
            />
            <span>{property.name}</span>
          </label>
        )
      case "number":
        return (
          <Input
            type="number"
            value={currentValue ?? ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Enter ${property.name}`}
          />
        )
      case "select": {
        const options = Array.isArray(property.options) ? property.options.map(optionLabel) : []
        return (
          <select
            className="w-full px-3 py-2 border border-input rounded-md bg-background"
            value={currentValue ?? ""}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">Select…</option>
            {options.length === 0 ? (
              <option value="">No options configured</option>
            ) : (
              options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))
            )}
          </select>
        )
      }
      case "multi_select":
        return (
          <Input
            placeholder="Comma separated values"
            value={Array.isArray(currentValue) ? currentValue.join(", ") : currentValue ?? ""}
            onChange={(e) => setValue(e.target.value)}
          />
        )
      case "date":
        return (
          <Input
            type="date"
            value={currentValue ? String(currentValue).slice(0, 10) : ""}
            onChange={(e) => setValue(e.target.value)}
          />
        )
      case "url":
        return (
          <Input
            type="url"
            value={currentValue ?? ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://"
          />
        )
      default:
        return (
          <Input
            value={currentValue ?? ""}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Enter ${property.name}`}
          />
        )
    }
  }

  const renderEditableCell = (record: DatabaseRecord, property: DatabaseProperty) => {
    const value = getPropertyValue(record, property)
    const onValueChange = (updater: any) => handleRecordPropertyChange(record.id, property.id, updater)

    switch (property.type) {
      case "checkbox":
        return (
          <label className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onValueChange(e.target.checked)}
            />
          </label>
        )
      case "number":
        return (
          <Input
            type="number"
            value={value ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
          />
        )
      case "select": {
        const options = Array.isArray(property.options) ? property.options.map(optionLabel) : []
        const selectedValue = value ? optionLabel(value) : ""
        const displayOptions = options.length > 0
          ? Array.from(new Set([selectedValue, ...options].filter(Boolean)))
          : ["Backlog", "In Progress", "Done"]
        return (
          <select
            className="w-full px-2 py-1 border border-transparent rounded bg-background text-sm"
            value={selectedValue || ""}
            onChange={(e) => onValueChange(e.target.value)}
          >
            {!selectedValue && <option value="">Select…</option>}
            {displayOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      }
      case "multi_select":
        return (
          <Input
            value={Array.isArray(value) ? value.join(", ") : value ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="Comma separated"
          />
        )
      case "date":
        return (
          <Input
            type="date"
            value={value ? String(value).slice(0, 10) : ""}
            onChange={(e) => onValueChange(e.target.value)}
          />
        )
      case "url":
        return (
          <Input
            type="url"
            value={value ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
          />
        )
      default:
        return (
          <Input value={value ?? ""} onChange={(e) => onValueChange(e.target.value)} />
        )
    }
  }

  const renderTableView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Table View</h3>
        <div className="text-sm text-muted-foreground">Use the dialogs above to add properties and records.</div>
      </div>

      <div className="border rounded-md overflow-auto">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="border-b border-[rgba(55,53,47,0.09)]">
              {properties.length > 0 ? (
                properties.map((property) => (
                  <TableHead
                    key={property.id}
                    className="bg-[#F1F1EF] text-[12px] uppercase tracking-wide font-medium text-foreground/80 sticky top-0 relative group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{property.name}</span>
                      <button
                        onClick={() => handleDeleteProperty(property.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                        title="Delete property"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </TableHead>
                ))
              ) : (
                <TableHead className="bg-[#F1F1EF] text-[12px] uppercase tracking-wide font-medium text-foreground/80">
                  No properties
                </TableHead>
              )}
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
                      {renderEditableCell(record, property)}
                    </TableCell>
                  ))}
                  <TableCell className="border-b border-[rgba(55,53,47,0.09)]">
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteRecord(record.id)}>
                      <Trash2 className="h-4 w-4" />
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

  const boardColumns = useMemo(() => {
    if (!selectProperty) {
      return [
        {
          id: "board-default",
          label: "Items",
          value: null as string | null,
          records,
        },
      ]
    }

    const optionValues = Array.isArray(selectProperty.options)
      ? selectProperty.options.map(optionLabel)
      : ["Backlog", "In Progress", "Done"]

    const fallbackKey = "__NO_STATUS__"
    const fallbackLabel = "No Status"
    const groups = new Map<string, { label: string; records: DatabaseRecord[] }>()

    optionValues.forEach((option) => {
      groups.set(option, { label: option, records: [] })
    })
    groups.set(fallbackKey, { label: fallbackLabel, records: [] })

    records.forEach((record) => {
      const rawValue = getPropertyValue(record, selectProperty)
      const bucket = rawValue ? optionLabel(rawValue) : fallbackKey
      if (!groups.has(bucket)) {
        groups.set(bucket, { label: bucket, records: [] })
      }
      groups.get(bucket)!.records.push(record)
    })

    return Array.from(groups.entries()).map(([value, column]) => ({
      id: `board-${value}`,
      label: column.label,
      value: value === fallbackKey ? null : column.label,
      records: column.records,
    }))
  }, [records, selectProperty])

  const renderBoardView = () => {
    const columnAccentPalette = ["#6366F1", "#F97316", "#0EA5E9", "#10B981", "#EC4899", "#8B5CF6"]

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">Board View</h3>
          <div className="text-sm text-muted-foreground">
            {selectProperty ? `Grouped by ${selectProperty.name}` : "Add a select property to group cards"}
          </div>
        </div>

        <DragDropContext onDragEnd={handleBoardDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {boardColumns.map((column, columnIndex) => {
              const columnColor = columnAccentPalette[columnIndex % columnAccentPalette.length]
              return (
                <Droppable droppableId={column.id} key={column.id}>
                  {(dropProvided) => (
                    <div ref={dropProvided.innerRef} {...dropProvided.droppableProps} className="h-full">
                      <Card className="flex min-h-[280px] flex-col border border-border/70">
                        <CardHeader className="flex flex-col gap-3 border-b border-border/70 pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: columnColor }}
                              />
                              <span>{column.label}</span>
                            </CardTitle>
                            <Badge variant="outline" className="border-border/70 text-xs">
                              {column.records.length}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 w-full justify-center gap-2 text-xs"
                            onClick={() => handleQuickAddBoardCard(column.value)}
                          >
                            <Plus className="h-3 w-3" /> Add card
                          </Button>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-2 py-4">
                          {column.records.length === 0 ? (
                            <div className="mt-4 text-center text-xs text-muted-foreground">No cards yet</div>
                          ) : (
                            column.records.map((record, cardIndex) => (
                              <Draggable key={record.id} draggableId={record.id} index={cardIndex}>
                                {(dragProvided, snapshot) => {
                                  const cardColor = columnAccentPalette[(columnIndex + cardIndex) % columnAccentPalette.length]
                                  const isExpanded = expandedCardId === record.id
                                  const titleValue = titleProperty ? getPropertyValue(record, titleProperty) || "" : record.id
                                  return (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      style={dragProvided.draggableProps.style}
                                      className={cn(
                                        "rounded-lg border border-border/60 bg-background shadow-sm transition-transform",
                                        snapshot.isDragging ? "rotate-[1deg] border-primary/60 shadow-xl" : "",
                                      )}
                                    >
                                      <div className="space-y-3 p-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex flex-1 items-start gap-2">
                                            <span
                                              {...dragProvided.dragHandleProps}
                                              className="mt-1 flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/20 text-muted-foreground"
                                            >
                                              <GripVertical className="h-3 w-3" />
                                            </span>
                                            <div className="flex-1 space-y-2">
                                              {titleProperty ? (
                                                <Input
                                                  value={titleValue}
                                                  onChange={(e) =>
                                                    handleRecordPropertyChange(record.id, titleProperty.id, e.target.value)
                                                  }
                                                  className="h-8 text-sm font-semibold"
                                                  placeholder="Untitled card"
                                                />
                                              ) : (
                                                <div className="text-sm font-semibold">{record.id}</div>
                                              )}
                                              {selectProperty && (
                                                <select
                                                  className="w-fit rounded border border-border bg-background px-2 py-1 text-xs"
                                                  value={getPropertyValue(record, selectProperty) || ""}
                                                  onChange={(e) =>
                                                    handleRecordPropertyChange(record.id, selectProperty.id, e.target.value)
                                                  }
                                                >
                                                  <option value="">No status</option>
                                                  {Array.isArray(selectProperty.options) ? (
                                                    selectProperty.options.map((option) => {
                                                      const value = optionLabel(option)
                                                      return (
                                                        <option key={value} value={value}>
                                                          {value}
                                                        </option>
                                                      )
                                                    })
                                                  ) : (
                                                    <>
                                                      <option value="Backlog">Backlog</option>
                                                      <option value="In Progress">In Progress</option>
                                                      <option value="Done">Done</option>
                                                    </>
                                                  )}
                                                </select>
                                              )}
                                            </div>
                                          </div>
                                          <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-muted-foreground"
                                            onClick={() => setExpandedCardId(isExpanded ? null : record.id)}
                                          >
                                            {isExpanded ? (
                                              <ChevronUp className="h-4 w-4" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4" />
                                            )}
                                          </Button>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                          {properties
                                            .filter((prop) => prop.id !== titleProperty?.id && prop.id !== selectProperty?.id)
                                            .slice(0, isExpanded ? properties.length : 3)
                                            .map((prop) => {
                                              const value = getPropertyValue(record, prop)
                                              if (!value || (Array.isArray(value) && value.length === 0)) return null
                                              const display = Array.isArray(value) ? value.join(", ") : String(value)
                                              return (
                                                <Badge
                                                  key={`${record.id}-${prop.id}`}
                                                  variant="secondary"
                                                  className="rounded-full text-[11px]"
                                                  style={{ backgroundColor: `${cardColor}15`, color: cardColor }}
                                                >
                                                  {display.slice(0, 28)}
                                                </Badge>
                                              )
                                            })}
                                        </div>

                                        {isExpanded && (
                                          <div className="space-y-3 rounded border border-border/70 bg-muted/10 p-3">
                                            {properties
                                              .filter((prop) => prop.id !== titleProperty?.id)
                                              .map((prop) => (
                                                <div key={`${record.id}-editor-${prop.id}`} className="space-y-1">
                                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                                                    {prop.name}
                                                  </span>
                                                  <div className="rounded-md border border-border/60 bg-background px-2 py-1">
                                                    {renderEditableCell(record, prop)}
                                                  </div>
                                                </div>
                                              ))}
                                            <div className="flex justify-end">
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDeleteRecord(record.id)}
                                                className="h-8 gap-2 text-destructive"
                                              >
                                                <Trash2 className="h-4 w-4" /> Remove card
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                }}
                              </Draggable>
                            ))
                          )}
                          {dropProvided.placeholder}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </Droppable>
              )
            })}
          </div>
        </DragDropContext>
      </div>
    )
  }

  const renderGalleryView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Gallery View</h3>
        <div className="text-sm text-muted-foreground">Visual cards powered by your database records</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {records.map((record) => (
          <Card key={record.id} className="overflow-hidden rounded-[10px] border border-[rgba(55,53,47,0.09)]">
            <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
              {coverProperty && getPropertyValue(record, coverProperty) ? (
                <img
                  src={String(getPropertyValue(record, coverProperty))}
                  alt="Cover"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground">No cover image</div>
              )}
            </div>
            <CardContent className="p-3 space-y-2">
              <h4 className="font-medium text-[14px]">
                {titleProperty ? getPropertyValue(record, titleProperty) || "Untitled" : record.id}
              </h4>
              <div className="flex flex-wrap gap-1">
                {properties
                  .filter((prop) => prop.id !== titleProperty?.id && prop.id !== coverProperty?.id)
                  .slice(0, 3)
                  .map((prop) => {
                    const value = getPropertyValue(record, prop)
                    if (!value || (Array.isArray(value) && value.length === 0)) return null
                    const display = Array.isArray(value) ? value.join(", ") : String(value)
                    return (
                      <Badge key={`${record.id}-${prop.id}`} variant="secondary" className="text-[11px]">
                        {display.slice(0, 24)}
                      </Badge>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderCalendarView = () => {
    if (dateProperties.length === 0) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Calendar View</h3>
          <div className="text-center py-8 text-muted-foreground">Add a date property to map entries on the calendar</div>
        </div>
      )
    }

    const primaryDateProperty = dateProperties[0]
    const events = records
      .map((record) => {
        const date = parseDateValue(getPropertyValue(record, primaryDateProperty))
        if (!date) return null
        return { record, date }
      })
      .filter((event): event is { record: DatabaseRecord; date: Date } => Boolean(event))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    if (events.length === 0) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Calendar View</h3>
          <div className="text-center py-8 text-muted-foreground">Add dates to your records to populate the calendar</div>
        </div>
      )
    }

    const accentPalette = ["#6366F1", "#F97316", "#10B981", "#EC4899", "#14B8A6", "#F59E0B"]

    const groupedByMonth = events.reduce<Map<string, { record: DatabaseRecord; date: Date }[]>>((acc, event) => {
      const monthKey = event.date.toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      })
      acc.set(monthKey, [...(acc.get(monthKey) ?? []), event])
      return acc
    }, new Map())

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Calendar View</h3>
            <p className="text-xs text-muted-foreground">Organised by {primaryDateProperty.name}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            {events.length} event{events.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {[...groupedByMonth.entries()].map(([monthLabel, monthEvents]) => (
          <div key={monthLabel} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-border via-border/40 to-transparent" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{monthLabel}</span>
              <div className="h-px flex-1 bg-gradient-to-l from-border via-border/40 to-transparent" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {monthEvents.map(({ record, date }, idx) => {
                const title = titleProperty ? getPropertyValue(record, titleProperty) || "Untitled" : record.id
                const location = locationProperty ? getPropertyValue(record, locationProperty) : null
                const color = accentPalette[idx % accentPalette.length]
                const accentBackground = `${color}1A`
                const hasExplicitTime = date.getHours() !== 0 || date.getMinutes() !== 0

                return (
                  <div
                    key={`${record.id}-${date.toISOString()}`}
                    className="relative overflow-hidden rounded-xl border border-border/60 bg-background/60 shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-lg"
                    style={{ borderLeft: `4px solid ${color}` }}
                  >
                    <div className="flex items-start gap-4 px-4 py-4">
                      <div
                        className="flex flex-col items-center justify-center rounded-lg px-3 py-2"
                        style={{ backgroundColor: accentBackground }}
                      >
                        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
                          {date.toLocaleString(undefined, { weekday: "short" })}
                        </div>
                        <div className="text-2xl font-semibold" style={{ color }}>
                          {date.getDate()}
                        </div>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold leading-5">{title}</h4>
                            <p className="text-xs text-muted-foreground/80">
                              {formatDateDisplay(date)}
                              {location ? ` • ${location}` : ""}
                            </p>
                          </div>
                          {hasExplicitTime && (
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: `${color}66`, color }}>
                              {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                            </Badge>
                          )}
                        </div>

                        {properties
                          .filter(
                            (prop) => prop.id !== titleProperty?.id && prop.id !== locationProperty?.id && prop.type !== "date",
                          )
                          .slice(0, 3)
                          .map((prop) => {
                            const value = getPropertyValue(record, prop)
                            if (!value || (Array.isArray(value) && value.length === 0)) return null
                            const display = Array.isArray(value) ? value.join(", ") : String(value)
                            return (
                              <Badge key={`${record.id}-${prop.id}`} variant="secondary" className="text-[10px]">
                                {prop.name}: {display}
                              </Badge>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderTimelineView = () => {
    if (!timelineStartProperty) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Timeline View</h3>
          <div className="text-center py-8 text-muted-foreground">Add start and end date properties to visualise a timeline</div>
        </div>
      )
    }

    const accentPalette = ["#6366F1", "#8B5CF6", "#EC4899", "#F97316", "#10B981", "#0EA5E9"]

    const items = records
      .map((record) => {
        const start = parseDateValue(getPropertyValue(record, timelineStartProperty))
        const end = timelineEndProperty ? parseDateValue(getPropertyValue(record, timelineEndProperty)) : null
        if (!start) return null
        return { record, start, end }
      })
      .filter((item): item is { record: DatabaseRecord; start: Date; end: Date | null } => Boolean(item))
      .sort((a, b) => a.start.getTime() - b.start.getTime())

    if (items.length === 0) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Timeline View</h3>
          <div className="text-center py-8 text-muted-foreground">Add dates to your records to populate the timeline</div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Timeline View</h3>
            <p className="text-xs text-muted-foreground">
              Using {timelineStartProperty.name}
              {timelineEndProperty ? ` to ${timelineEndProperty.name}` : ""}
            </p>
          </div>
          <Badge variant="secondary" className="w-fit text-[10px] uppercase tracking-wide">
            {items.length} milestone{items.length === 1 ? "" : "s"}
          </Badge>
        </div>

        <div className="relative pl-6 sm:pl-12">
          <div className="absolute left-1 sm:left-3 top-0 h-full w-[2px] bg-gradient-to-b from-primary via-primary/40 to-transparent" />
          <div className="space-y-6">
            {items.map(({ record, start, end }, index) => {
              const title = titleProperty ? getPropertyValue(record, titleProperty) || "Untitled" : record.id
              const color = accentPalette[index % accentPalette.length]
              const primaryLabel = formatDateDisplay(start)
              const secondaryLabel = end ? `→ ${formatDateDisplay(end)}` : null
              const durationLabel = end ? `${Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))} days` : null

              return (
                <div key={`${record.id}-${start.toISOString()}`} className="relative pl-6 sm:pl-10">
                  <span
                    className="absolute left-[-9px] sm:left-[-5px] top-2 block h-4 w-4 rounded-full border-4"
                    style={{ backgroundColor: color, borderColor: `${color}33` }}
                  />
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-background/70 shadow-sm transition-shadow hover:shadow-lg">
                    <div className="flex flex-col gap-3 border-b border-border/40 bg-muted/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{primaryLabel}</span>
                        <h4 className="text-base font-semibold leading-6 text-foreground">{title}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {secondaryLabel && <span>{secondaryLabel}</span>}
                        {durationLabel && <Badge variant="outline" style={{ borderColor: `${color}66`, color }}>{durationLabel}</Badge>}
                      </div>
                    </div>
                    <div className="space-y-2 px-4 py-3 text-sm text-muted-foreground">
                      {properties
                        .filter((prop) => ![
                          titleProperty?.id,
                          timelineStartProperty?.id,
                          timelineEndProperty?.id,
                        ].includes(prop.id))
                        .slice(0, 4)
                        .map((prop) => {
                          const value = getPropertyValue(record, prop)
                          if (!value || (Array.isArray(value) && value.length === 0)) return null
                          const display = Array.isArray(value) ? value.join(", ") : String(value)
                          return (
                            <div key={`${record.id}-${prop.id}`} className="flex items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                                {prop.name}
                              </span>
                              <span className="rounded-full bg-muted/40 px-2 py-1 text-xs text-foreground/80">{display}</span>
                            </div>
                          )
                        })}
                      {durationLabel && !secondaryLabel && (
                        <p className="text-xs italic text-muted-foreground/80">Single-day milestone</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const renderChartView = () => {
    if (!numberProperty) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Chart View</h3>
          <div className="text-center py-8 text-muted-foreground">Add a number property to plot your data</div>
        </div>
      )
    }

    const labelProperty = titleProperty || properties.find((prop) => prop.type === "text") || properties[0]

    const chartType = (block.metadata?.chartType as string) || "bar"
    const chartTypeOptions: Array<{ value: string; label: string }> = [
      { value: "bar", label: "Column" },
      { value: "horizontal-bar", label: "Bar" },
      { value: "line", label: "Line" },
      { value: "area", label: "Area" },
      { value: "pie", label: "Pie" },
      { value: "doughnut", label: "Doughnut" },
      { value: "radar", label: "Radar" },
    ]
    const handleChartTypeChange = (nextType: string) => {
      onUpdate({ metadata: { ...(block.metadata ?? {}), chartType: nextType } })
    }

    const data = records
      .map((record) => {
        const rawValue = getPropertyValue(record, numberProperty)
        if (rawValue === null || rawValue === undefined || rawValue === "") return null
        const numericValue = Number(rawValue)
        if (Number.isNaN(numericValue)) return null
        const label = labelProperty ? getPropertyValue(record, labelProperty) || record.id : record.id
        return {
          label: String(label).slice(0, 24),
          value: numericValue,
        }
      })
      .filter((item): item is { label: string; value: number } => Boolean(item))

    if (data.length === 0) {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Chart View</h3>
          <div className="text-center py-8 text-muted-foreground">Populate numeric values to render the chart</div>
        </div>
      )
    }

    const chartColors = ["#6366F1", "#8B5CF6", "#EC4899", "#F97316", "#22D3EE", "#14B8A6"]

    const renderChartBody = () => {
      switch (chartType) {
        case "line":
          return (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ stroke: "var(--primary)", strokeWidth: 1 }} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )
        case "area":
          return (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="chartAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ stroke: "var(--primary)", strokeWidth: 1 }} />
                <Legend />
                <Area type="monotone" dataKey="value" stroke="var(--primary)" fill="url(#chartAreaGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )
        case "pie":
          return (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={4}
                  stroke="var(--background)"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${entry.label}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )
        case "doughnut":
          return (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={90}
                  outerRadius={130}
                  paddingAngle={6}
                  stroke="var(--background)"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-doughnut-${entry.label}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          )
        case "radar":
          return (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data} margin={{ top: 16, right: 24, left: 24, bottom: 16 }}>
                <PolarGrid stroke="rgba(148, 163, 184, 0.2)" />
                <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fontSize: 12 }} stroke="rgba(148, 163, 184, 0.4)" />
                <Tooltip />
                <Radar
                  dataKey="value"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          )
        case "horizontal-bar":
          return (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 16, right: 24, left: 24, bottom: 8 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  dataKey="label"
                  type="category"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip cursor={{ fill: "rgba(99,102,241,0.12)" }} />
                <Legend />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        case "bar":
        default:
          return (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: "rgba(99,102,241,0.15)" }} />
                <Legend />
                <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Chart View</h3>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Value: {numberProperty.name}</span>
            <label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground/80">
              Chart:
              <select
                className="rounded border border-input bg-background px-2 py-1 text-xs font-medium"
                value={chartType}
                onChange={(e) => handleChartTypeChange(e.target.value)}
              >
                {chartTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="h-80 w-full">{renderChartBody()}</div>
      </div>
    )
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
        return renderCalendarView()
      case "timeline":
        return renderTimelineView()
      case "chart":
        return renderChartView()
      default:
        return renderTableView()
    }
  }

  return (
    <ErrorBoundary>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {viewIcons[block.viewType]}
              <CardTitle className="text-lg">Database</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                {block.viewType}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Dialog open={isAddingProperty} onOpenChange={setIsAddingProperty}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Property</DialogTitle>
                  </DialogHeader>
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Property Name</label>
                      <Input
                        placeholder="e.g., Status, Priority, Due Date"
                        value={newProperty.name}
                        onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Property Type</label>
                      <select
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                        value={newProperty.type}
                        onChange={(e) =>
                          setNewProperty({
                            ...newProperty,
                            type: e.target.value as DatabaseProperty["type"] | "text",
                          })
                        }
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="select">Select</option>
                        <option value="multi_select">Multi-select</option>
                        <option value="date">Date</option>
                        <option value="url">URL</option>
                      </select>
                    </div>
                    <Button onClick={handleAddProperty} className="w-full">
                      Add Property
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddingRecord} onOpenChange={setIsAddingRecord}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    {addRecordLabel}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{addRecordLabel}</DialogTitle>
                  </DialogHeader>
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}
                  <div className="space-y-4">
                    {properties.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No properties yet. Add a property first to create records.
                      </div>
                    ) : (
                      properties.map((property) => (
                        <div key={property.id} className="space-y-1">
                          {property.type !== "checkbox" && (
                            <label className="text-sm font-medium">{property.name}</label>
                          )}
                          {renderNewRecordField(property)}
                        </div>
                      ))
                    )}
                    <Button onClick={handleAddRecord} className="w-full" disabled={properties.length === 0}>
                      {addRecordLabel}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {renderView()}
        </CardContent>
      </Card>
    </ErrorBoundary>
  )
}
