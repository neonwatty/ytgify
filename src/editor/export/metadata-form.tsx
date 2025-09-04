import * as React from "react"
import { cn } from "@/lib/utils"
import { GifData } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface MetadataFormProps {
  title: string
  description: string
  filename: string
  tags: string[]
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
  onFilenameChange: (filename: string) => void
  onTagsChange: (tags: string[]) => void
  className?: string
  disabled?: boolean
}

interface TagInputProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const TagInput: React.FC<TagInputProps> = ({
  tags,
  onTagsChange,
  placeholder = "Add tags...",
  disabled = false,
  className
}) => {
  const [inputValue, setInputValue] = React.useState("")
  const [isComposing, setIsComposing] = React.useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposing) return

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag()
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const addTag = () => {
    const trimmedValue = inputValue.trim().replace(/,+$/, '') // Remove trailing commas
    if (trimmedValue && !tags.includes(trimmedValue)) {
      onTagsChange([...tags, trimmedValue])
    }
    setInputValue("")
  }

  const removeTag = (indexToRemove: number) => {
    onTagsChange(tags.filter((_, index) => index !== indexToRemove))
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[2.5rem] bg-background">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-sm rounded-md"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              disabled={disabled}
              className="hover:bg-primary/20 rounded-full w-4 h-4 flex items-center justify-center text-xs"
              aria-label={`Remove ${tag} tag`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Press Enter or comma to add tags</span>
        <span>{tags.length} tag{tags.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

export const MetadataForm: React.FC<MetadataFormProps> = ({
  title,
  description,
  filename,
  tags,
  onTitleChange,
  onDescriptionChange,
  onFilenameChange,
  onTagsChange,
  className,
  disabled = false
}) => {
  const [titleError, setTitleError] = React.useState<string | null>(null)
  const [filenameError, setFilenameError] = React.useState<string | null>(null)

  // Generate suggested filename from title
  const generateFilename = React.useCallback((title: string) => {
    const sanitized = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove duplicate hyphens
      .trim()
    
    return sanitized || 'untitled-gif'
  }, [])

  // Auto-generate filename when title changes (if filename is empty or was auto-generated)
  React.useEffect(() => {
    if (title && (!filename || filename === generateFilename(title))) {
      onFilenameChange(generateFilename(title))
    }
  }, [title, filename, generateFilename, onFilenameChange])

  // Validate title
  React.useEffect(() => {
    if (title.trim() === '') {
      setTitleError('Title is required')
    } else if (title.length < 3) {
      setTitleError('Title must be at least 3 characters')
    } else if (title.length > 100) {
      setTitleError('Title must be less than 100 characters')
    } else {
      setTitleError(null)
    }
  }, [title])

  // Validate filename
  React.useEffect(() => {
    const filenameRegex = /^[a-zA-Z0-9\s\-_]+$/
    if (filename.trim() === '') {
      setFilenameError('Filename is required')
    } else if (!filenameRegex.test(filename)) {
      setFilenameError('Filename can only contain letters, numbers, spaces, hyphens, and underscores')
    } else if (filename.length > 50) {
      setFilenameError('Filename must be less than 50 characters')
    } else {
      setFilenameError(null)
    }
  }, [filename])

  const handleTitleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onTitleChange(e.target.value)
  }, [onTitleChange])

  const handleDescriptionChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onDescriptionChange(e.target.value)
  }, [onDescriptionChange])

  const handleFilenameChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onFilenameChange(e.target.value)
  }, [onFilenameChange])

  const handleGenerateFilename = React.useCallback(() => {
    if (title) {
      onFilenameChange(generateFilename(title))
    }
  }, [title, generateFilename, onFilenameChange])

  const clearForm = React.useCallback(() => {
    onTitleChange("")
    onDescriptionChange("")
    onFilenameChange("")
    onTagsChange([])
  }, [onTitleChange, onDescriptionChange, onFilenameChange, onTagsChange])

  const hasValidationErrors = titleError || filenameError

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Metadata</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearForm}
          disabled={disabled}
          className="h-8 px-3 text-xs"
        >
          Clear All
        </Button>
      </div>

      {/* Title Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="gif-title">
          Title *
        </label>
        <Input
          id="gif-title"
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Enter GIF title..."
          disabled={disabled}
          className={titleError ? "border-destructive" : ""}
          maxLength={100}
        />
        {titleError && (
          <p className="text-xs text-destructive">{titleError}</p>
        )}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>A descriptive title for your GIF</span>
          <span>{title.length}/100</span>
        </div>
      </div>

      {/* Description Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="gif-description">
          Description
        </label>
        <textarea
          id="gif-description"
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Add a description..."
          disabled={disabled}
          rows={3}
          maxLength={500}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Optional description or notes</span>
          <span>{description.length}/500</span>
        </div>
      </div>

      {/* Filename Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="gif-filename">
            Filename *
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGenerateFilename}
            disabled={disabled || !title}
            className="h-6 px-2 text-xs"
          >
            Auto-generate
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            id="gif-filename"
            type="text"
            value={filename}
            onChange={handleFilenameChange}
            placeholder="Enter filename..."
            disabled={disabled}
            className={cn("flex-1", filenameError ? "border-destructive" : "")}
            maxLength={50}
          />
          <span className="text-sm text-muted-foreground">.gif</span>
        </div>
        {filenameError && (
          <p className="text-xs text-destructive">{filenameError}</p>
        )}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Filename for download (without .gif extension)</span>
          <span>{filename.length}/50</span>
        </div>
      </div>

      {/* Tags Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Tags
        </label>
        <TagInput
          tags={tags}
          onTagsChange={onTagsChange}
          placeholder="Add tags for organization..."
          disabled={disabled}
        />
        <div className="text-xs text-muted-foreground">
          Tags help organize and find your GIFs later
        </div>
      </div>

      {/* Suggested Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">
          Suggested Tags
        </label>
        <div className="flex flex-wrap gap-2">
          {['funny', 'reaction', 'meme', 'animation', 'short', 'loop'].map((suggestedTag) => (
            <button
              key={suggestedTag}
              onClick={() => !tags.includes(suggestedTag) && onTagsChange([...tags, suggestedTag])}
              disabled={disabled || tags.includes(suggestedTag)}
              className="px-2 py-1 text-xs border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {suggestedTag}
            </button>
          ))}
        </div>
      </div>

      {/* Validation Summary */}
      {hasValidationErrors && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg">
          <div className="text-sm font-medium mb-1">Please fix the following issues:</div>
          <ul className="text-xs space-y-1">
            {titleError && <li>• {titleError}</li>}
            {filenameError && <li>• {filenameError}</li>}
          </ul>
        </div>
      )}

      {/* Metadata Summary */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Preview</h4>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Title:</span>{' '}
            {title || <span className="text-muted-foreground italic">No title</span>}
          </div>
          <div>
            <span className="font-medium">Filename:</span>{' '}
            {filename ? `${filename}.gif` : <span className="text-muted-foreground italic">No filename</span>}
          </div>
          {description && (
            <div>
              <span className="font-medium">Description:</span>{' '}
              <span className="text-muted-foreground">{description}</span>
            </div>
          )}
          <div>
            <span className="font-medium">Tags:</span>{' '}
            {tags.length > 0 ? (
              <span className="text-muted-foreground">{tags.join(', ')}</span>
            ) : (
              <span className="text-muted-foreground italic">No tags</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}