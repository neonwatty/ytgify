import { TimelineSelection } from '@/types';
import { youTubeAPI } from './youtube-api-integration';
import { logger } from '@/lib/logger';

export interface TimeSelectionState {
  isSelecting: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  currentTime: number;
  videoDuration: number;
}

export type TimeSelectionCallback = (selection: TimelineSelection) => void;
export type SelectionChangeCallback = (state: TimeSelectionState) => void;

export interface TimelineDragHandles {
  startHandle: HTMLElement;
  endHandle: HTMLElement;
  selectionBar: HTMLElement;
}

export interface TimeSelectorConfig {
  container: HTMLElement;
  minDuration: number;
  maxDuration: number;
  snapToSeconds: boolean;
  showPreview: boolean;
  allowMarkerDrag: boolean;
}

export class TimelineSelector {
  private container: HTMLElement;
  private config: TimeSelectorConfig;
  private state: TimeSelectionState;
  private selectionCallbacks: Set<TimeSelectionCallback> = new Set();
  private changeCallbacks: Set<SelectionChangeCallback> = new Set();
  
  private timelineElement: HTMLElement | null = null;
  private dragHandles: TimelineDragHandles | null = null;
  private isDragging = false;
  private dragType: 'start' | 'end' | 'selection' | null = null;
  private dragStartX = 0;
  private dragStartTime = 0;
  
  private animationFrame: number | null = null;
  private updateInterval: number | null = null;

  constructor(config: TimeSelectorConfig) {
    this.config = config;
    this.container = config.container;
    
    this.state = {
      isSelecting: false,
      startTime: 0,
      endTime: 0,
      duration: 0,
      currentTime: 0,
      videoDuration: 0
    };

    this.initializeTimeline();
    this.bindEventListeners();
    this.startTimeUpdater();
  }

  private initializeTimeline(): void {
    if (!this.container) {
      logger.error('[TimeSelector] Container not provided');
      return;
    }

    this.timelineElement = this.createTimelineElement();
    this.dragHandles = this.createDragHandles();
    
    this.container.appendChild(this.timelineElement);
    this.updateVideoState();
  }

  private createTimelineElement(): HTMLElement {
    const timeline = document.createElement('div');
    timeline.className = 'ytgif-timeline-selector';
    timeline.innerHTML = `
      <div class="ytgif-timeline-track">
        <div class="ytgif-timeline-progress"></div>
        <div class="ytgif-timeline-selection" data-selection-bar>
          <div class="ytgif-timeline-handle ytgif-handle-start" data-handle="start"></div>
          <div class="ytgif-timeline-handle ytgif-handle-end" data-handle="end"></div>
        </div>
        <div class="ytgif-timeline-current-time"></div>
      </div>
      <div class="ytgif-timeline-labels">
        <span class="ytgif-time-start">0:00</span>
        <span class="ytgif-time-duration">0:00</span>
        <span class="ytgif-time-end">0:00</span>
      </div>
    `;
    return timeline;
  }

  private createDragHandles(): TimelineDragHandles {
    const selectionBar = this.timelineElement?.querySelector('[data-selection-bar]') as HTMLElement;
    const startHandle = this.timelineElement?.querySelector('[data-handle="start"]') as HTMLElement;
    const endHandle = this.timelineElement?.querySelector('[data-handle="end"]') as HTMLElement;

    if (!selectionBar || !startHandle || !endHandle) {
      throw new Error('[TimeSelector] Failed to create drag handles');
    }

    return {
      startHandle,
      endHandle,
      selectionBar
    };
  }

  private bindEventListeners(): void {
    if (!this.timelineElement || !this.dragHandles) return;

    // Timeline click for initial selection
    this.timelineElement.addEventListener('mousedown', this.handleTimelineMouseDown.bind(this));
    
    // Handle drag events
    if (this.config.allowMarkerDrag) {
      this.dragHandles.startHandle.addEventListener('mousedown', this.handleStartHandleDrag.bind(this));
      this.dragHandles.endHandle.addEventListener('mousedown', this.handleEndHandleDrag.bind(this));
      this.dragHandles.selectionBar.addEventListener('mousedown', this.handleSelectionBarDrag.bind(this));
    }

    // Global mouse events for drag operations
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Prevent text selection during drag
    this.timelineElement.addEventListener('selectstart', (e) => e.preventDefault());
  }

  private handleTimelineMouseDown(event: MouseEvent): void {
    event.preventDefault();
    
    // Don't start new selection if clicking on handles
    if ((event.target as HTMLElement).closest('.ytgif-timeline-handle')) {
      return;
    }

    const clickTime = this.getTimeFromMousePosition(event);
    
    if (!this.state.isSelecting) {
      this.startSelection(clickTime);
    } else {
      this.updateSelectionEnd(clickTime);
    }
  }

  private handleStartHandleDrag(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.isDragging = true;
    this.dragType = 'start';
    this.dragStartX = event.clientX;
    this.dragStartTime = this.state.startTime;
  }

  private handleEndHandleDrag(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.isDragging = true;
    this.dragType = 'end';
    this.dragStartX = event.clientX;
    this.dragStartTime = this.state.endTime;
  }

  private handleSelectionBarDrag(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.isDragging = true;
    this.dragType = 'selection';
    this.dragStartX = event.clientX;
    this.dragStartTime = this.state.startTime;
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.isDragging || !this.dragType) return;

    const deltaX = event.clientX - this.dragStartX;
    const deltaTime = this.getTimeDeltaFromPixelDelta(deltaX);
    
    switch (this.dragType) {
      case 'start':
        this.updateSelectionStart(this.dragStartTime + deltaTime);
        break;
      case 'end':
        this.updateSelectionEnd(this.dragStartTime + deltaTime);
        break;
      case 'selection':
        this.moveSelection(deltaTime);
        break;
    }
  }

  private handleMouseUp(_event: MouseEvent): void {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.dragType = null;
    this.dragStartX = 0;
    this.dragStartTime = 0;
    
    this.finalizeSelection();
  }

  private getTimeFromMousePosition(event: MouseEvent): number {
    if (!this.timelineElement) return 0;
    
    const track = this.timelineElement.querySelector('.ytgif-timeline-track') as HTMLElement;
    if (!track) return 0;
    
    const rect = track.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const time = percentage * this.state.videoDuration;
    
    return this.config.snapToSeconds ? Math.round(time) : time;
  }

  private getTimeDeltaFromPixelDelta(deltaX: number): number {
    if (!this.timelineElement) return 0;
    
    const track = this.timelineElement.querySelector('.ytgif-timeline-track') as HTMLElement;
    if (!track) return 0;
    
    const rect = track.getBoundingClientRect();
    const percentage = deltaX / rect.width;
    const deltaTime = percentage * this.state.videoDuration;
    
    return this.config.snapToSeconds ? Math.round(deltaTime) : deltaTime;
  }

  private startSelection(startTime: number): void {
    this.state.isSelecting = true;
    this.state.startTime = Math.max(0, Math.min(this.state.videoDuration, startTime));
    this.state.endTime = this.state.startTime;
    this.state.duration = 0;
    
    this.updateVisualState();
    this.notifySelectionChange();
  }

  private updateSelectionStart(newStartTime: number): void {
    const clampedStart = Math.max(0, Math.min(this.state.videoDuration, newStartTime));
    
    if (clampedStart >= this.state.endTime) {
      return;
    }
    
    this.state.startTime = clampedStart;
    this.state.duration = this.state.endTime - this.state.startTime;
    
    this.updateVisualState();
    this.notifySelectionChange();
  }

  private updateSelectionEnd(newEndTime: number): void {
    const clampedEnd = Math.max(0, Math.min(this.state.videoDuration, newEndTime));
    
    if (clampedEnd <= this.state.startTime) {
      return;
    }
    
    this.state.endTime = clampedEnd;
    this.state.duration = this.state.endTime - this.state.startTime;
    
    this.updateVisualState();
    this.notifySelectionChange();
  }

  private moveSelection(deltaTime: number): void {
    const newStartTime = this.dragStartTime + deltaTime;
    const selectionDuration = this.state.duration;
    
    const clampedStart = Math.max(0, Math.min(this.state.videoDuration - selectionDuration, newStartTime));
    
    this.state.startTime = clampedStart;
    this.state.endTime = clampedStart + selectionDuration;
    
    this.updateVisualState();
    this.notifySelectionChange();
  }

  private updateVisualState(): void {
    if (!this.timelineElement || !this.dragHandles) return;

    const startPercentage = (this.state.startTime / this.state.videoDuration) * 100;
    const endPercentage = (this.state.endTime / this.state.videoDuration) * 100;
    const currentTimePercentage = (this.state.currentTime / this.state.videoDuration) * 100;
    
    // Update selection bar
    this.dragHandles.selectionBar.style.left = `${startPercentage}%`;
    this.dragHandles.selectionBar.style.width = `${endPercentage - startPercentage}%`;
    
    // Update current time indicator
    const currentTimeIndicator = this.timelineElement.querySelector('.ytgif-timeline-current-time') as HTMLElement;
    if (currentTimeIndicator) {
      currentTimeIndicator.style.left = `${currentTimePercentage}%`;
    }
    
    // Update time labels
    this.updateTimeLabels();
  }

  private updateTimeLabels(): void {
    if (!this.timelineElement) return;
    
    const startLabel = this.timelineElement.querySelector('.ytgif-time-start') as HTMLElement;
    const durationLabel = this.timelineElement.querySelector('.ytgif-time-duration') as HTMLElement;
    const endLabel = this.timelineElement.querySelector('.ytgif-time-end') as HTMLElement;
    
    if (startLabel) startLabel.textContent = this.formatTime(this.state.startTime);
    if (durationLabel) durationLabel.textContent = this.formatTime(this.state.duration);
    if (endLabel) endLabel.textContent = this.formatTime(this.state.endTime);
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private updateVideoState(): void {
    this.state.currentTime = youTubeAPI.getCurrentTime();
    this.state.videoDuration = youTubeAPI.getDuration();
    
    if (this.state.videoDuration > 0) {
      this.updateVisualState();
    }
  }

  private startTimeUpdater(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateVideoState();
    }, 100);
  }

  private finalizeSelection(): void {
    if (!this.state.isSelecting) return;
    
    if (this.state.duration > 0) {
      this.notifySelectionComplete();
    }
  }

  private notifySelectionChange(): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback({ ...this.state });
      } catch (error) {
        logger.error('[TimeSelector] Error in change callback', { error });
      }
    });
  }

  private notifySelectionComplete(): void {
    const selection: TimelineSelection = {
      startTime: this.state.startTime,
      endTime: this.state.endTime,
      duration: this.state.duration
    };
    
    this.selectionCallbacks.forEach(callback => {
      try {
        callback(selection);
      } catch (error) {
        logger.error('[TimeSelector] Error in selection callback', { error });
      }
    });
  }

  public onSelectionComplete(callback: TimeSelectionCallback): () => void {
    this.selectionCallbacks.add(callback);
    return () => this.selectionCallbacks.delete(callback);
  }

  public onSelectionChange(callback: SelectionChangeCallback): () => void {
    this.changeCallbacks.add(callback);
    return () => this.changeCallbacks.delete(callback);
  }

  public getSelection(): TimelineSelection | null {
    if (!this.state.isSelecting || this.state.duration === 0) {
      return null;
    }
    
    return {
      startTime: this.state.startTime,
      endTime: this.state.endTime,
      duration: this.state.duration
    };
  }

  public setSelection(selection: TimelineSelection): void {
    this.state.startTime = selection.startTime;
    this.state.endTime = selection.endTime;
    this.state.duration = selection.duration;
    this.state.isSelecting = true;
    
    this.updateVisualState();
    this.notifySelectionChange();
  }

  public clearSelection(): void {
    this.state.isSelecting = false;
    this.state.startTime = 0;
    this.state.endTime = 0;
    this.state.duration = 0;
    
    this.updateVisualState();
    this.notifySelectionChange();
  }

  public seekToSelectionStart(): void {
    if (this.state.isSelecting) {
      youTubeAPI.seekTo(this.state.startTime);
    }
  }

  public seekToSelectionEnd(): void {
    if (this.state.isSelecting) {
      youTubeAPI.seekTo(this.state.endTime);
    }
  }

  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    
    if (this.timelineElement && this.timelineElement.parentNode) {
      this.timelineElement.parentNode.removeChild(this.timelineElement);
    }
    
    this.selectionCallbacks.clear();
    this.changeCallbacks.clear();
    
    logger.debug('[TimeSelector] Destroyed');
  }
}