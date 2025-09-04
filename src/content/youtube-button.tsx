import React from 'react';

export interface YouTubeButtonProps {
  isActive: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export interface YouTubeButtonState {
  isHovered: boolean;
  isPressed: boolean;
}

export class YouTubeButton extends React.Component<YouTubeButtonProps, YouTubeButtonState> {
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
        <svg
          height="100%"
          version="1.1"
          viewBox="0 0 36 36"
          width="100%"
          className="ytgif-button-icon"
        >
          {/* Background frame */}
          <rect
            x="6"
            y="10"
            width="24"
            height="16"
            rx="2"
            ry="2"
            fill="currentColor"
            fillOpacity={isActive ? "0.8" : "0.3"}
            className="ytgif-icon-background"
          />
          
          {/* Film strip holes */}
          <rect x="8" y="14" width="3" height="8" fill="currentColor" className="ytgif-icon-strip" />
          <rect x="13" y="14" width="3" height="8" fill="currentColor" className="ytgif-icon-strip" />
          <rect x="18" y="14" width="3" height="8" fill="currentColor" className="ytgif-icon-strip" />
          <rect x="23" y="14" width="3" height="8" fill="currentColor" className="ytgif-icon-strip" />
          
          {/* Record indicator */}
          <circle
            cx="29"
            cy="13"
            r={isActive ? "3" : "2"}
            fill={isActive ? "#ff0000" : "currentColor"}
            fillOpacity={isActive ? "1" : "0.6"}
            className="ytgif-icon-indicator"
          />
          
          {/* Play triangle when active */}
          {isActive && (
            <polygon
              points="14,16 14,20 18,18"
              fill="currentColor"
              fillOpacity="0.9"
              className="ytgif-icon-play"
            />
          )}
        </svg>
      </button>
    );
  }
}

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

  // Create SVG icon
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('height', '100%');
  svg.setAttribute('version', '1.1');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('width', '100%');
  svg.setAttribute('class', 'ytgif-button-icon');

  // Background frame
  const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  background.setAttribute('x', '6');
  background.setAttribute('y', '10');
  background.setAttribute('width', '24');
  background.setAttribute('height', '16');
  background.setAttribute('rx', '2');
  background.setAttribute('ry', '2');
  background.setAttribute('fill', 'currentColor');
  background.setAttribute('fill-opacity', isActive ? '0.8' : '0.3');
  background.setAttribute('class', 'ytgif-icon-background');

  // Film strip holes
  const strips = [8, 13, 18, 23].map(x => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x.toString());
    rect.setAttribute('y', '14');
    rect.setAttribute('width', '3');
    rect.setAttribute('height', '8');
    rect.setAttribute('fill', 'currentColor');
    rect.setAttribute('class', 'ytgif-icon-strip');
    return rect;
  });

  // Record indicator
  const indicator = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  indicator.setAttribute('cx', '29');
  indicator.setAttribute('cy', '13');
  indicator.setAttribute('r', isActive ? '3' : '2');
  indicator.setAttribute('fill', isActive ? '#ff0000' : 'currentColor');
  indicator.setAttribute('fill-opacity', isActive ? '1' : '0.6');
  indicator.setAttribute('class', 'ytgif-icon-indicator');

  // Assemble SVG
  svg.appendChild(background);
  strips.forEach(strip => svg.appendChild(strip));
  svg.appendChild(indicator);

  // Play triangle when active
  if (isActive) {
    const play = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    play.setAttribute('points', '14,16 14,20 18,18');
    play.setAttribute('fill', 'currentColor');
    play.setAttribute('fill-opacity', '0.9');
    play.setAttribute('class', 'ytgif-icon-play');
    svg.appendChild(play);
  }

  button.appendChild(svg);

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

  // Update icon elements
  const background = button.querySelector('.ytgif-icon-background') as SVGElement;
  const indicator = button.querySelector('.ytgif-icon-indicator') as SVGElement;
  const playIcon = button.querySelector('.ytgif-icon-play') as SVGElement;

  if (background) {
    background.setAttribute('fill-opacity', isActive ? '0.8' : '0.3');
  }

  if (indicator) {
    indicator.setAttribute('r', isActive ? '3' : '2');
    indicator.setAttribute('fill', isActive ? '#ff0000' : 'currentColor');
    indicator.setAttribute('fill-opacity', isActive ? '1' : '0.6');
  }

  // Add/remove play triangle
  if (isActive && !playIcon) {
    const svg = button.querySelector('svg');
    if (svg) {
      const play = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      play.setAttribute('points', '14,16 14,20 18,18');
      play.setAttribute('fill', 'currentColor');
      play.setAttribute('fill-opacity', '0.9');
      play.setAttribute('class', 'ytgif-icon-play');
      svg.appendChild(play);
    }
  } else if (!isActive && playIcon) {
    playIcon.remove();
  }
}