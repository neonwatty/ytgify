import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface EditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
  description?: string
}

const EditorModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
EditorModalOverlay.displayName = "EditorModalOverlay"

const EditorModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn(
      "fixed right-0 top-0 z-50 h-full w-full max-w-2xl border-l bg-background shadow-2xl duration-300",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
      "focus:outline-none",
      "md:max-w-3xl lg:max-w-4xl",
      className
    )}
    {...props}
  >
    {children}
  </DialogPrimitive.Content>
))
EditorModalContent.displayName = "EditorModalContent"

export const EditorModal: React.FC<EditorModalProps> = ({
  open,
  onOpenChange,
  children,
  title,
  description,
}) => {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (open) {
      const previouslyFocused = document.activeElement as HTMLElement
      return () => {
        previouslyFocused?.focus()
      }
    }
  }, [open])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <EditorModalOverlay />
        <EditorModalContent>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex-1">
                {title && (
                  <DialogPrimitive.Title className="text-lg font-semibold">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {children}
            </div>
          </div>
        </EditorModalContent>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export interface EditorModalSectionProps {
  children: React.ReactNode
  className?: string
}

export const EditorModalSection: React.FC<EditorModalSectionProps> = ({
  children,
  className,
}) => (
  <div className={cn("mb-6 last:mb-0", className)}>
    {children}
  </div>
)

export interface EditorModalFooterProps {
  children: React.ReactNode
  className?: string
}

export const EditorModalFooter: React.FC<EditorModalFooterProps> = ({
  children,
  className,
}) => (
  <div className={cn(
    "flex items-center justify-end gap-2 border-t px-6 py-4",
    className
  )}>
    {children}
  </div>
)