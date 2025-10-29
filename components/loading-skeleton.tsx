"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  className?: string
  count?: number
  variant?: "text" | "card" | "table" | "chart"
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ className, count = 1, variant = "text" }) => {
  const baseClasses = "bg-muted animate-pulse rounded"

  const variants = {
    text: "h-4 w-full mb-2",
    card: "h-32 w-full mb-4",
    table: "h-10 w-full mb-2",
    chart: "h-64 w-full",
  }

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(baseClasses, variants[variant])} />
      ))}
    </div>
  )
}
