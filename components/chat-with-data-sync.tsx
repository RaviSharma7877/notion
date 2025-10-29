"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { LoadingSkeleton } from "./loading-skeleton"
import { AlertCircle, MessageCircle } from "lucide-react"
import { useDataSync } from "./data-sync-provider"
import { Button } from "./ui/button"

export const ChatWithDataSync: React.FC = () => {
  const { chatData, isLoadingChat, chatError, refetch } = useDataSync()

  if (isLoadingChat) {
    return <LoadingSkeleton variant="card" count={3} />
  }

  if (chatError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Chat Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{chatError.message}</p>
          <Button onClick={refetch} variant="outline" size="sm">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!chatData || chatData.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center py-8 text-muted-foreground">No messages yet</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Chat Messages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {chatData.map((message) => (
            <div key={message.id} className="p-3 bg-muted rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium text-sm">{message.sender}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-foreground">{message.content}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
