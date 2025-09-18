// Unused React component - kept for potential future use
/*
import React from 'react';
interface YouTubeButtonProps {
  isActive: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}
interface YouTubeButtonState {
  isHovered: boolean;
  isPressed: boolean;
}

class YouTubeButton extends React.Component<YouTubeButtonProps, YouTubeButtonState> {
  constructor(props: YouTubeButtonProps) {
    super(props);
    this.state = {
      isHovered: false,
      isPressed: false
    };
  }

  private handleMouseEnter = () => {
    this.setState({ isHovered: true });
  };

  private handleMouseLeave = () => {
    this.setState({ isHovered: false, isPressed: false });
  };

  private handleMouseDown = () => {
    this.setState({ isPressed: true });
  };

  private handleMouseUp = () => {
    this.setState({ isPressed: false });
  };

  private handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!this.props.disabled) {
      this.props.onClick(event);
    }
  };

  render() {
    const { isActive, disabled = false, className = '', 'aria-label': ariaLabel } = this.props;
    const { isHovered, isPressed } = this.state;

    // YouTube native button classes
    const baseClasses = 'ytp-button';
    const stateClasses = [
      isActive && 'ytp-button-active',
      disabled && 'ytp-button-disabled',
      isHovered && 'ytp-button-hover',
      isPressed && 'ytp-button-pressed'
    ].filter(Boolean).join(' ');

    const buttonClasses = `${baseClasses} ytgif-button ${stateClasses} ${className}`.trim();

    return (
      <button
        className={buttonClasses}
        onClick={this.handleClick}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
        onMouseDown={this.handleMouseDown}
        onMouseUp={this.handleMouseUp}
        disabled={disabled}
        type="button"
        role="button"
        tabIndex={0}
        aria-label={ariaLabel || (isActive ? 'Stop creating GIF' : 'Create GIF from video')}
        data-tooltip-text={isActive ? 'Stop GIF creation' : 'Create GIF'}
      >
        <img
          src={chrome.runtime.getURL('icons/icon.svg')}
          alt="YTGify"
          className="ytgif-button-icon"
          style={{
            width: '100%',
            height: '100%',
            opacity: isActive ? 1 : 0.8,
            filter: isActive ? 'drop-shadow(0 0 4px rgba(255, 0, 102, 0.5))' : 'none'
          }}
        />
      </button>
    );
  }
}
*/

// Utility function to create button element without React
export function createNativeYouTubeButton(props: {
  isActive: boolean;
  onClick: (event: Event) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}): HTMLButtonElement {
  const { isActive, onClick, disabled = false, className = '', ariaLabel } = props;

  const button = document.createElement('button');
  
  // Apply YouTube native classes
  button.className = `ytp-button ytgif-button ${className}`.trim();
  button.type = 'button';
  button.disabled = disabled;
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', ariaLabel || (isActive ? 'Stop creating GIF' : 'Create GIF from video'));
  button.setAttribute('data-tooltip-text', isActive ? 'Stop GIF creation' : 'Create GIF');

  // Create logo image icon
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/icon.svg');
  img.alt = 'YTGify';
  img.className = 'ytgif-button-icon';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.opacity = isActive ? '1' : '0.8';
  img.style.filter = isActive ? 'drop-shadow(0 0 4px rgba(255, 0, 102, 0.5))' : 'none';

  button.appendChild(img);

  // Add click handler
  button.addEventListener('click', onClick);

  // Add hover effects
  button.addEventListener('mouseenter', () => {
    button.classList.add('ytp-button-hover');
  });

  button.addEventListener('mouseleave', () => {
    button.classList.remove('ytp-button-hover', 'ytp-button-pressed');
  });

  button.addEventListener('mousedown', () => {
    button.classList.add('ytp-button-pressed');
  });

  button.addEventListener('mouseup', () => {
    button.classList.remove('ytp-button-pressed');
  });

  return button;
}

// Update button state function
export function updateButtonState(button: HTMLButtonElement, isActive: boolean): void {
  // Update aria-label
  button.setAttribute('aria-label', isActive ? 'Stop creating GIF' : 'Create GIF from video');
  button.setAttribute('data-tooltip-text', isActive ? 'Stop GIF creation' : 'Create GIF');
  
  // Update active class
  if (isActive) {
    button.classList.add('ytp-button-active');
  } else {
    button.classList.remove('ytp-button-active');
  }

  // Update logo image state
  const img = button.querySelector('.ytgif-button-icon') as HTMLImageElement;

  if (img) {
    img.style.opacity = isActive ? '1' : '0.8';
    img.style.filter = isActive ? 'drop-shadow(0 0 4px rgba(255, 0, 102, 0.5))' : 'none';
  }
}