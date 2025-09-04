import * as React from "react"
import { cn } from "@/lib/utils"

interface EditorLayoutProps {
  children: React.ReactNode
  className?: string
}

export const EditorLayout: React.FC<EditorLayoutProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {children}
    </div>
  )
}

interface EditorPanelProps {
  children: React.ReactNode
  className?: string
  position?: "left" | "right" | "center"
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ 
  children, 
  className,
  position = "center"
}) => {
  const positionClasses = {
    left: "order-1 lg:w-1/4",
    center: "order-2 flex-1",
    right: "order-3 lg:w-1/4"
  }

  return (
    <div className={cn(
      "flex flex-col",
      positionClasses[position],
      className
    )}>
      {children}
    </div>
  )
}

interface EditorHeaderProps {
  children: React.ReactNode
  className?: string
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={cn(
      "flex items-center justify-between border-b px-4 py-3",
      className
    )}>
      {children}
    </div>
  )
}

interface EditorContentProps {
  children: React.ReactNode
  className?: string
  scrollable?: boolean
}

export const EditorContent: React.FC<EditorContentProps> = ({ 
  children, 
  className,
  scrollable = true
}) => {
  return (
    <div className={cn(
      "flex-1 p-4",
      scrollable && "overflow-y-auto",
      className
    )}>
      {children}
    </div>
  )
}

interface EditorSidebarProps {
  children: React.ReactNode
  className?: string
  side?: "left" | "right"
}

export const EditorSidebar: React.FC<EditorSidebarProps> = ({ 
  children, 
  className,
  side = "left"
}) => {
  return (
    <div className={cn(
      "w-64 border-r bg-muted/10",
      side === "right" && "border-l border-r-0",
      className
    )}>
      {children}
    </div>
  )
}

interface EditorGridProps {
  children: React.ReactNode
  className?: string
  columns?: number
}

export const EditorGrid: React.FC<EditorGridProps> = ({
  children,
  className,
  columns = 2
}) => {
  const gridClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
  }

  return (
    <div className={cn(
      "grid gap-4",
      gridClasses[columns as keyof typeof gridClasses] || gridClasses[2],
      className
    )}>
      {children}
    </div>
  )
}

interface EditorSectionProps {
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
}

export const EditorSection: React.FC<EditorSectionProps> = ({
  children,
  className,
  title,
  description
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-lg font-medium">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

interface ResponsiveContainerProps {
  children: React.ReactNode
  className?: string
  direction?: "row" | "column"
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  className,
  direction = "row"
}) => {
  const directionClasses = {
    row: "flex-col lg:flex-row",
    column: "flex-col"
  }

  return (
    <div className={cn(
      "flex gap-4",
      directionClasses[direction],
      className
    )}>
      {children}
    </div>
  )
}

interface EditorToolbarProps {
  children: React.ReactNode
  className?: string
  position?: "top" | "bottom"
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  children,
  className,
  position = "top"
}) => {
  return (
    <div className={cn(
      "flex items-center gap-2 border-b px-4 py-2",
      position === "bottom" && "border-t border-b-0",
      className
    )}>
      {children}
    </div>
  )
}