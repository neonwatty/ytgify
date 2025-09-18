import * as React from "react"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"

interface SliderControlProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  unit?: string
  formatValue?: (value: number) => string
  className?: string
  disabled?: boolean
  description?: string
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = "",
  formatValue,
  className,
  disabled = false,
  description
}) => {
  const handleChange = React.useCallback((values: number[]) => {
    onChange(values[0])
  }, [onChange])

  const displayValue = formatValue ? formatValue(value) : `${value}${unit}`

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm text-muted-foreground font-mono">
          {displayValue}
        </span>
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      <Slider
        value={[value]}
        onValueChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full"
      />
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

// Unused components removed to fix linting errors
// These components were created for future features but are not currently in use