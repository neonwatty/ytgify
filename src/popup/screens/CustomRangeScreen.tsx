import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface CustomRangeScreenProps {
  videoTitle: string;
  currentTime: number;
  duration: number;
  onConfirm: (startTime: number, endTime: number) => void;
  onBack: () => void;
  formatTime: (seconds: number) => string;
}

const CustomRangeScreen: React.FC<CustomRangeScreenProps> = ({
  videoTitle,
  currentTime,
  duration,
  onConfirm,
  onBack,
  formatTime
}) => {
  const [startTime, setStartTime] = useState(Math.max(0, currentTime - 2));
  const [endTime, setEndTime] = useState(Math.min(duration, currentTime + 2));
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);

  const gifDuration = endTime - startTime;
  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickPercent = (x / rect.width) * 100;
    const clickTime = (clickPercent / 100) * duration;

    // Determine which handle is closer
    const distToStart = Math.abs(clickTime - startTime);
    const distToEnd = Math.abs(clickTime - endTime);

    if (distToStart < distToEnd) {
      setStartTime(Math.min(clickTime, endTime - 0.5));
    } else {
      setEndTime(Math.max(clickTime, startTime + 0.5));
    }
  };

  const handleConfirm = () => {
    onConfirm(startTime, endTime);
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Select Range
        </h2>
        <p className="text-xs text-gray-600 line-clamp-1" title={videoTitle}>
          {videoTitle}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center space-y-4">
        {/* Duration Display */}
        <div className="text-center py-3 bg-gray-50 rounded-lg">
          <div className="text-xl font-bold text-blue-600">
            {gifDuration.toFixed(1)}s
          </div>
          <p className="text-xs text-gray-600">Selected Duration</p>
          {gifDuration > 10 && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Long GIFs may have large file sizes
            </p>
          )}
        </div>

        {/* Interactive Timeline */}
        <div className="space-y-3">
          <div 
            className="relative h-12 bg-gray-100 rounded-lg cursor-pointer"
            onClick={handleTimelineClick}
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gray-200 rounded-lg"></div>
            
            {/* Selected Range */}
            <div
              className="absolute h-full bg-blue-500/30 border-2 border-blue-500 rounded"
              style={{
                left: `${startPercent}%`,
                width: `${endPercent - startPercent}%`
              }}
            >
              {/* Start Handle */}
              <div
                className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-8 bg-blue-600 rounded-full cursor-ew-resize shadow-lg"
                onMouseDown={() => setIsDragging('start')}
              ></div>
              
              {/* End Handle */}
              <div
                className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1/2 w-4 h-8 bg-blue-600 rounded-full cursor-ew-resize shadow-lg"
                onMouseDown={() => setIsDragging('end')}
              ></div>
            </div>

            {/* Current Time Indicator */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500"
              style={{ left: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 text-[10px] text-red-600 font-mono">
                {formatTime(currentTime)}
              </div>
            </div>
          </div>

          {/* Time Scale */}
          <div className="flex justify-between text-[10px] text-gray-500 font-mono px-1">
            <span>0:00</span>
            <span>{formatTime(duration / 4)}</span>
            <span>{formatTime(duration / 2)}</span>
            <span>{formatTime(duration * 3 / 4)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Time Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">Start Time</label>
            <input
              type="text"
              value={formatTime(startTime)}
              onChange={(e) => {
                const parts = e.target.value.split(':');
                if (parts.length === 2) {
                  const mins = parseInt(parts[0]) || 0;
                  const secs = parseInt(parts[1]) || 0;
                  const newTime = Math.min(mins * 60 + secs, endTime - 0.5);
                  setStartTime(Math.max(0, newTime));
                }
              }}
              className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">End Time</label>
            <input
              type="text"
              value={formatTime(endTime)}
              onChange={(e) => {
                const parts = e.target.value.split(':');
                if (parts.length === 2) {
                  const mins = parseInt(parts[0]) || 0;
                  const secs = parseInt(parts[1]) || 0;
                  const newTime = Math.max(mins * 60 + secs, startTime + 0.5);
                  setEndTime(Math.min(duration, newTime));
                }
              }}
              className="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 space-y-2">
        <Button
          variant="youtube"
          onClick={handleConfirm}
          className="w-full"
        >
          Continue
        </Button>
        <Button
          variant="outline"
          onClick={onBack}
          className="w-full"
        >
          Back
        </Button>
      </div>
    </div>
  );
};

export default CustomRangeScreen;