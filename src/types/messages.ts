// Chrome Extension Message Types and Interfaces
interface BaseMessage {
  type: string;
  id?: string;
}

export interface ExtractFramesRequest extends BaseMessage {
  type: 'EXTRACT_FRAMES';
  data: {
    videoElement: {
      currentTime: number;
      duration: number;
      videoWidth: number;
      videoHeight: number;
    };
    settings: {
      startTime: number;
      endTime: number;
      frameRate: number;
      quality: 'low' | 'medium' | 'high';
    };
  };
}

export interface ExtractFramesResponse extends BaseMessage {
  type: 'EXTRACT_FRAMES_RESPONSE';
  success: boolean;
  data?: {
    frames: ImageData[];
    frameCount: number;
  };
  error?: string;
}

export interface EncodeGifRequest extends BaseMessage {
  type: 'ENCODE_GIF';
  data: {
    frames: ImageData[];
    settings: {
      frameRate: number;
      width: number;
      height: number;
      quality: 'low' | 'medium' | 'high';
      loop: boolean;
    };
    metadata: {
      title: string;
      description?: string;
      youtubeUrl: string;
      startTime: number;
      endTime: number;
    };
  };
}

export interface EncodeGifResponse extends BaseMessage {
  type: 'ENCODE_GIF_RESPONSE';
  success: boolean;
  data?: {
    gifBlob: Blob;
    thumbnailBlob?: Blob;
    metadata: {
      fileSize: number;
      duration: number;
      width: number;
      height: number;
    };
  };
  error?: string;
}

export interface GetVideoStateRequest extends BaseMessage {
  type: 'GET_VIDEO_STATE';
}

export interface GetVideoStateResponse extends BaseMessage {
  type: 'GET_VIDEO_STATE_RESPONSE';
  success: boolean;
  data?: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    videoUrl: string;
    title: string;
  };
  error?: string;
}

export interface ShowTimelineRequest extends BaseMessage {
  type: 'SHOW_TIMELINE';
  data: {
    videoDuration: number;
    currentTime: number;
  };
}

export interface HideTimelineRequest extends BaseMessage {
  type: 'HIDE_TIMELINE';
}

export interface TimelineSelectionUpdate extends BaseMessage {
  type: 'TIMELINE_SELECTION_UPDATE';
  data: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

interface OpenEditorRequest extends BaseMessage {
  type: 'OPEN_EDITOR';
  data: {
    videoUrl: string;
    selection: {
      startTime: number;
      endTime: number;
      duration: number;
    };
  };
}

export interface LogMessage extends BaseMessage {
  type: 'LOG';
  data: {
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    context?: Record<string, unknown>;
  };
}

export interface ErrorResponse extends BaseMessage {
  type: 'ERROR_RESPONSE';
  success: false;
  error: string;
}

export interface SuccessResponse extends BaseMessage {
  type: 'SUCCESS_RESPONSE';
  success: true;
  data?: unknown;
}

export interface DownloadGifRequest extends BaseMessage {
  type: 'DOWNLOAD_GIF';
  data: {
    gifId?: string;
    url: string;
    filename?: string;
  };
}

export interface GetJobStatusRequest extends BaseMessage {
  type: 'GET_JOB_STATUS';
  data: {
    jobId: string;
  };
}

interface GetJobStatusResponse extends BaseMessage {
  type: 'JOB_STATUS_RESPONSE';
  success: boolean;
  data?: {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
    createdAt: string;
    completedAt?: string;
  };
  error?: string;
}

interface CancelJobRequest extends BaseMessage {
  type: 'CANCEL_JOB';
  data: {
    jobId: string;
  };
}

interface CancelJobResponse extends BaseMessage {
  type: 'JOB_CANCEL_RESPONSE';
  success: boolean;
  data?: {
    jobId: string;
    cancelled: boolean;
  };
  error?: string;
}

export interface JobProgressUpdate extends BaseMessage {
  type: 'JOB_PROGRESS_UPDATE';
  data: {
    jobId: string;
    progress: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    stage?: string;    // Current processing stage (e.g., 'extracting', 'encoding', 'optimizing')
    message?: string;  // Human-readable status message
    details?: {        // Optional detailed progress info
      currentFrame?: number;
      totalFrames?: number;
      currentStep?: number;
      totalSteps?: number;
    };
  };
}

// New message types for GIF creation flow
export interface RequestVideoDataForGif extends BaseMessage {
  type: 'REQUEST_VIDEO_DATA_FOR_GIF';
  data: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export interface VideoDataResponse extends BaseMessage {
  type: 'VIDEO_DATA_RESPONSE';
  success: boolean;
  data?: {
    videoElement: {
      videoWidth: number;
      videoHeight: number;
      duration: number;
      currentTime: number;
      videoSrc: string;
      tabId?: number;
    };
    settings: {
      startTime: number;
      endTime: number;
      frameRate: number;
      maxWidth: number;
      quality: number;
    };
  };
  error?: string;
}

export interface GifCreationComplete extends BaseMessage {
  type: 'GIF_CREATION_COMPLETE';
  success: boolean;
  data?: {
    gifBlob: Blob;
    thumbnailBlob: Blob;
    gifDataUrl?: string;
    thumbnailDataUrl?: string;
    metadata: Record<string, unknown>;
  };
  error?: string;
}

export interface SaveGifRequest extends BaseMessage {
  type: 'SAVE_GIF_REQUEST';
  data: {
    gifData: {
      id: string;
      title: string;
      description?: string;
      blob: Blob;
      thumbnailBlob?: Blob;
      metadata: {
        width: number;
        height: number;
        duration: number;
        frameRate: number;
        fileSize: number;
        createdAt: Date;
        lastModified?: Date;
        youtubeUrl?: string;
        startTime?: number;
        endTime?: number;
        editorVersion?: number;
        originalGifId?: string;
      };
      tags: string[];
    };
  };
}

export interface SaveGifResponse extends BaseMessage {
  type: 'SAVE_GIF_RESPONSE';
  success: boolean;
  data?: {
    gifId: string;
  };
  error?: string;
}

// Direct wizard activation from extension icon
interface ShowWizardDirectRequest extends BaseMessage {
  type: 'SHOW_WIZARD_DIRECT';
  data: {
    triggeredBy: string;
  };
}

// Import from frame-extractor for content script messages
import type { ContentFrameExtractionRequest } from '../content/frame-extractor';

// Union type for all possible messages
export type ExtensionMessage = 
  | ExtractFramesRequest
  | ExtractFramesResponse
  | EncodeGifRequest
  | EncodeGifResponse
  | GetVideoStateRequest
  | GetVideoStateResponse
  | ShowTimelineRequest
  | HideTimelineRequest
  | ShowWizardDirectRequest
  | TimelineSelectionUpdate
  | OpenEditorRequest
  | LogMessage
  | ErrorResponse
  | SuccessResponse
  | DownloadGifRequest
  | GetJobStatusRequest
  | GetJobStatusResponse
  | CancelJobRequest
  | CancelJobResponse
  | JobProgressUpdate
  | RequestVideoDataForGif
  | VideoDataResponse
  | GifCreationComplete
  | SaveGifRequest
  | SaveGifResponse
  | ContentFrameExtractionRequest;

// Type guards for message validation
export function isExtractFramesRequest(message: BaseMessage): message is ExtractFramesRequest {
  return message.type === 'EXTRACT_FRAMES';
}

export function isEncodeGifRequest(message: BaseMessage): message is EncodeGifRequest {
  return message.type === 'ENCODE_GIF';
}

export function isGetVideoStateRequest(message: BaseMessage): message is GetVideoStateRequest {
  return message.type === 'GET_VIDEO_STATE';
}

function _isShowTimelineRequest(message: BaseMessage): message is ShowTimelineRequest {
  return message.type === 'SHOW_TIMELINE';
}

function _isHideTimelineRequest(message: BaseMessage): message is HideTimelineRequest {
  return message.type === 'HIDE_TIMELINE';
}

export function isTimelineSelectionUpdate(message: BaseMessage): message is TimelineSelectionUpdate {
  return message.type === 'TIMELINE_SELECTION_UPDATE';
}

function _isOpenEditorRequest(message: BaseMessage): message is OpenEditorRequest {
  return message.type === 'OPEN_EDITOR';
}

export function isLogMessage(message: BaseMessage): message is LogMessage {
  return message.type === 'LOG';
}

export function isDownloadGifRequest(message: BaseMessage): message is DownloadGifRequest {
  return message.type === 'DOWNLOAD_GIF';
}

export function isGetJobStatusRequest(message: BaseMessage): message is GetJobStatusRequest {
  return message.type === 'GET_JOB_STATUS';
}

// Response helper function
function _createResponse<T extends ExtensionMessage>(
  originalMessage: BaseMessage,
  responseType: T['type'],
  success: boolean,
  data?: T extends { data: infer D } ? D : never,
  error?: string
): T {
  return {
    type: responseType,
    id: originalMessage.id,
    success,
    data,
    error,
  } as T;
}