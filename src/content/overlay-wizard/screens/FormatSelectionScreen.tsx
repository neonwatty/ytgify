import React from 'react';
import { ArrowLeft, FileImage, Zap, Check, AlertCircle } from 'lucide-react';

interface FormatSelectionScreenProps {
  onFormatSelect: (format: 'gif' | 'webp') => void;
  onBack: () => void;
}

export function FormatSelectionScreen({ onFormatSelect, onBack }: FormatSelectionScreenProps) {
  const [selectedFormat, setSelectedFormat] = React.useState<'gif' | 'webp' | null>(null);

  const handleContinue = () => {
    if (selectedFormat) {
      onFormatSelect(selectedFormat);
    }
  };

  return (
    <div className="wizard-screen format-selection-screen">
      <div className="wizard-header">
        <button onClick={onBack} className="wizard-back-button">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h2 className="wizard-title">Choose Export Format</h2>
      </div>

      <div className="wizard-content">
        <p className="wizard-description">
          Select your preferred output format for the GIF
        </p>

        <div className="format-options">
          <button
            className={`format-option ${selectedFormat === 'gif' ? 'selected' : ''}`}
            onClick={() => setSelectedFormat('gif')}
          >
            <div className="format-icon">
              <FileImage className="h-8 w-8" />
            </div>
            <div className="format-details">
              <h3 className="format-title">GIF</h3>
              <span className="format-badge recommended">Recommended</span>
              <p className="format-description">Classic format</p>
              <ul className="format-features">
                <li>
                  <Check className="h-3 w-3" />
                  Universal compatibility
                </li>
                <li>
                  <Check className="h-3 w-3" />
                  Works everywhere
                </li>
                <li>
                  <AlertCircle className="h-3 w-3 warning" />
                  Larger file size
                </li>
              </ul>
            </div>
          </button>

          <button
            className={`format-option ${selectedFormat === 'webp' ? 'selected' : ''}`}
            onClick={() => setSelectedFormat('webp')}
          >
            <div className="format-icon">
              <Zap className="h-8 w-8" />
            </div>
            <div className="format-details">
              <h3 className="format-title">WebP</h3>
              <span className="format-badge experimental">Experimental</span>
              <p className="format-description">Modern format</p>
              <ul className="format-features">
                <li>
                  <Check className="h-3 w-3" />
                  Up to 80% smaller file size
                </li>
                <li>
                  <Check className="h-3 w-3" />
                  Better image quality
                </li>
                <li>
                  <Check className="h-3 w-3" />
                  Full animation support (using WASM)
                </li>
                <li>
                  <AlertCircle className="h-3 w-3 warning" />
                  Requires modern browser
                </li>
              </ul>
            </div>
          </button>
        </div>

        <div className="wizard-actions">
          <button
            onClick={handleContinue}
            disabled={!selectedFormat}
            className="wizard-button wizard-button-primary"
          >
            Continue with {selectedFormat ? selectedFormat.toUpperCase() : 'selected format'}
          </button>
        </div>
      </div>
    </div>
  );
}