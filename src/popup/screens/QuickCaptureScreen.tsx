import React from 'react';
import { Button } from '@/components/ui/button';

interface QuickCaptureScreenProps {
  videoTitle: string;
  startTime: number;
  endTime: number;
  currentTime: number;
  duration: number;
  onConfirm: () => void;
  onBack: () => void;
  formatTime: (seconds: number) => string;
  isLoading?: boolean;
}

const QuickCaptureScreen: React.FC<QuickCaptureScreenProps> = ({
  videoTitle,
  startTime,
  endTime,
  currentTime,
  duration,
  onConfirm,
  onBack,
  formatTime,
  isLoading = false
}) => {
  const gifDuration = endTime - startTime;
  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;
  
  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Quick Capture Preview
        </h2>
        <p className="text-xs text-gray-600 line-clamp-1" title={videoTitle}>
          {videoTitle}
        </p>
      </div>

      {/* Timeline Preview */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          {/* Duration Info */}
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {gifDuration.toFixed(1)}s
            </div>
            <p className="text-xs text-gray-600">GIF Duration</p>
          </div>

          {/* Visual Timeline */}
          <div className="space-y-2">
            <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
              {/* Full timeline background */}
              <div className="absolute inset-0 bg-gray-200"></div>
              
              {/* Selected range */}
              <div
                className="absolute h-full bg-blue-500"
                style={{
                  left: `${startPercent}%`,
                  width: `${endPercent - startPercent}%`
                }}
              ></div>
              
              {/* Current position marker */}
              <div
                className="absolute top-1/2 transform -translate-y-1/2 w-0.5 h-5 bg-red-500"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              ></div>
            </div>
            
            {/* Time labels */}
            <div className="flex justify-between text-[10px] text-gray-600 font-mono">
              <span>0:00</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Range Display */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Start</p>
              <div className="bg-white rounded px-3 py-1.5 border border-gray-200">
                <span className="text-sm font-mono font-medium text-gray-900">
                  {formatTime(startTime)}
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">End</p>
              <div className="bg-white rounded px-3 py-1.5 border border-gray-200">
                <span className="text-sm font-mono font-medium text-gray-900">
                  {formatTime(endTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-2">
        <Button
          variant="youtube"
          onClick={onConfirm}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⚙️</span>
              Creating GIF...
            </>
          ) : (
            <>
              <span className="mr-2">🎬</span>
              Create GIF
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="w-full"
        >
          Back
        </Button>
      </div>
    </div>
  );
};

export default QuickCaptureScreen;