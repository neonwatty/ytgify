/**
 * Sharing Dialog Component
 * Provides a comprehensive interface for sharing GIFs via different methods
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { GifData } from "@/types"
import { Button } from "./button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog"
import { sharing, ShareTarget } from "@/shared/sharing"
import { Input } from "./input"

interface SharingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gifBlob?: Blob
  metadata?: Partial<GifData>
  className?: string
}

interface ShareTargetButtonProps {
  target: ShareTarget
  onShare: (targetId: string) => Promise<void>
  disabled?: boolean
  loading?: boolean
}

const ShareTargetButton: React.FC<ShareTargetButtonProps> = ({
  target,
  onShare,
  disabled = false,
  loading = false
}) => {
  const [isSharing, setIsSharing] = React.useState(false)

  const handleShare = React.useCallback(async () => {
    if (disabled || loading || isSharing) return
    
    setIsSharing(true)
    try {
      await onShare(target.id)
    } finally {
      setIsSharing(false)
    }
  }, [target.id, onShare, disabled, loading, isSharing])

  return (
    <Button
      variant={target.supported ? "default" : "outline"}
      size="lg"
      onClick={handleShare}
      disabled={disabled || !target.supported || isSharing}
      className={cn(
        "h-auto p-4 flex flex-col gap-2 text-center",
        !target.supported && "opacity-50"
      )}
    >
      <div className="text-2xl">{target.icon}</div>
      <div className="space-y-1">
        <div className="font-medium text-sm">{target.name}</div>
        <div className="text-xs text-muted-foreground leading-tight">
          {target.description}
        </div>
        {!target.supported && (
          <div className="text-xs text-destructive">Not supported</div>
        )}
      </div>
      {(loading || isSharing) && (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
    </Button>
  )
}

interface SocialShareLinksProps {
  shareUrl: string
  title: string
  description?: string
  className?: string
}

const SocialShareLinks: React.FC<SocialShareLinksProps> = ({
  shareUrl,
  title,
  description,
  className
}) => {
  const socialUrls = React.useMemo(
    () => sharing.generateSocialShareUrls(shareUrl, title, description),
    [shareUrl, title, description]
  )

  const socialPlatforms = [
    { id: 'twitter', name: 'Twitter', icon: '🐦', color: 'hover:bg-blue-50' },
    { id: 'facebook', name: 'Facebook', icon: '👥', color: 'hover:bg-blue-50' },
    { id: 'reddit', name: 'Reddit', icon: '🤖', color: 'hover:bg-orange-50' },
    { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: 'hover:bg-green-50' },
    { id: 'telegram', name: 'Telegram', icon: '✈️', color: 'hover:bg-blue-50' },
    { id: 'email', name: 'Email', icon: '📧', color: 'hover:bg-gray-50' }
  ]

  const handleSocialShare = React.useCallback((platform: string) => {
    const url = socialUrls[platform]
    if (url) {
      window.open(url, '_blank', 'width=600,height=400')
    }
  }, [socialUrls])

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium text-muted-foreground">Share on Social Media</h4>
      <div className="grid grid-cols-3 gap-2">
        {socialPlatforms.map((platform) => (
          <Button
            key={platform.id}
            variant="outline"
            size="sm"
            onClick={() => handleSocialShare(platform.id)}
            className={cn(
              "h-auto p-3 flex flex-col gap-1 text-center",
              platform.color
            )}
          >
            <div className="text-lg">{platform.icon}</div>
            <div className="text-xs">{platform.name}</div>
          </Button>
        ))}
      </div>
    </div>
  )
}

export const SharingDialog: React.FC<SharingDialogProps> = ({
  open,
  onOpenChange,
  gifBlob,
  metadata,
  className
}) => {
  const [shareTargets, setShareTargets] = React.useState<ShareTarget[]>([])
  const [shareUrl, setShareUrl] = React.useState<string>("")
  const [isSharing, setIsSharing] = React.useState(false)
  const [shareStatus, setShareStatus] = React.useState<{
    success?: boolean
    message?: string
  } | null>(null)

  // Load share targets on component mount
  React.useEffect(() => {
    const loadShareTargets = async () => {
      const capabilities = await sharing.getCapabilities()
      setShareTargets(capabilities.availableTargets)
    }
    loadShareTargets()
  }, [])

  // Generate share URL when metadata changes
  React.useEffect(() => {
    if (metadata) {
      const url = sharing.generateShareableURL(metadata)
      setShareUrl(url)
    }
  }, [metadata])

  const handleShare = React.useCallback(async (targetId: string) => {
    if (!gifBlob || !metadata) return

    setIsSharing(true)
    setShareStatus(null)

    try {
      let result;
      
      if (targetId === 'web-share') {
        result = await sharing.shareGif(gifBlob, metadata, 'web-share')
      } else if (targetId === 'url-copy') {
        result = await sharing.shareGif(gifBlob, metadata, 'url-copy')
      } else if (targetId === 'download') {
        result = await sharing.shareGif(gifBlob, metadata, 'download-link')
      } else {
        result = { success: false, error: 'Unknown share target' }
      }

      if (result.success) {
        if (result.shared) {
          setShareStatus({
            success: true,
            message: targetId === 'url-copy' ? 'Link copied to clipboard!' : 'Shared successfully!'
          })
          // Auto-close after successful share (except for copy)
          if (targetId !== 'url-copy') {
            setTimeout(() => onOpenChange(false), 1500)
          }
        } else {
          setShareStatus({
            success: true,
            message: 'Share cancelled'
          })
        }
      } else {
        setShareStatus({
          success: false,
          message: result.error || 'Failed to share'
        })
      }
    } catch (error) {
      setShareStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsSharing(false)
    }
  }, [gifBlob, metadata, onOpenChange])

  const handleCopyUrl = React.useCallback(async () => {
    if (shareUrl) {
      await handleShare('url-copy')
    }
  }, [shareUrl, handleShare])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>Share Your GIF</DialogTitle>
          <DialogDescription>
            Choose how you'd like to share your animated GIF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Primary share targets */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Quick Share</h4>
            <div className="grid grid-cols-2 gap-3">
              {shareTargets.map((target) => (
                <ShareTargetButton
                  key={target.id}
                  target={target}
                  onShare={handleShare}
                  disabled={isSharing}
                  loading={isSharing}
                />
              ))}
            </div>
          </div>

          {/* Share URL section */}
          {shareUrl && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Share Link</h4>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="text-sm"
                  placeholder="Share URL will appear here"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  disabled={isSharing}
                >
                  📋 Copy
                </Button>
              </div>
            </div>
          )}

          {/* Social media links */}
          {shareUrl && (
            <SocialShareLinks
              shareUrl={shareUrl}
              title={metadata?.title || 'Animated GIF'}
              description={metadata?.description}
            />
          )}

          {/* Status messages */}
          {shareStatus && (
            <div className={cn(
              "p-3 rounded-lg text-sm text-center",
              shareStatus.success 
                ? "bg-green-50 text-green-800 border border-green-200" 
                : "bg-red-50 text-red-800 border border-red-200"
            )}>
              {shareStatus.message}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}