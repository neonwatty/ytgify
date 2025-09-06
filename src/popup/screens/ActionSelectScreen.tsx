import React from 'react';

interface ActionSelectScreenProps {
  currentTime: number;
  duration: number;
  onQuickCapture: () => void;
  onCustomRange: () => void;
  formatTime: (seconds: number) => string;
}

const ActionSelectScreen: React.FC<ActionSelectScreenProps> = ({
  currentTime,
  duration,
  onQuickCapture,
  onCustomRange,
  formatTime
}) => {
  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Choose Capture Mode
        </h2>
        <p className="text-xs text-gray-600">
          Current position: {formatTime(currentTime)} / {formatTime(duration)}
        </p>
      </div>

      {/* Options */}
      <div className="flex-1 flex flex-col justify-center space-y-4">
        {/* Quick Capture Option */}
        <button
          onClick={onQuickCapture}
          className="group relative bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
        >
          <div className="absolute top-3 right-3 text-2xl">⚡</div>
          <div className="text-left">
            <h3 className="font-semibold text-lg mb-1">Quick Capture</h3>
            <p className="text-sm text-blue-100">
              Instant 4-second GIF from current position
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-200">
              <span className="bg-blue-400/30 px-2 py-1 rounded">
                {formatTime(Math.max(0, currentTime - 2))}
              </span>
              <span>→</span>
              <span className="bg-blue-400/30 px-2 py-1 rounded">
                {formatTime(Math.min(duration, currentTime + 2))}
              </span>
            </div>
          </div>
        </button>

        {/* Custom Range Option */}
        <button
          onClick={onCustomRange}
          className="group relative bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-gray-300 transform hover:scale-[1.02] transition-all"
        >
          <div className="absolute top-3 right-3 text-2xl">✂️</div>
          <div className="text-left">
            <h3 className="font-semibold text-lg text-gray-900 mb-1">Custom Range</h3>
            <p className="text-sm text-gray-600">
              Select exact start and end points
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="text-gray-500">Full control over timing</span>
            </div>
          </div>
        </button>
      </div>

      {/* Tips */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          💡 Tip: Use arrow keys for frame-by-frame navigation
        </p>
      </div>
    </div>
  );
};

export default ActionSelectScreen;