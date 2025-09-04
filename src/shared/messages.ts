// Enhanced Chrome Extension Message Types with Request/Response Pattern Support

import { GifData, GifSettings, TimelineSelection, TextOverlay } from '@/types/storage';

// Base message interface with required fields
export interface BaseMessage {
  type: string;
  id: string; // Required for request/response correlation
  timestamp?: number;
}

// Request/Response pattern interface
export interface BaseRequest extends BaseMessage {
  requestId: string; // Unique identifier for tracking request/response pairs
}

export interface BaseResponse extends BaseMessage {
  requestId: string; // Matches the original request
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Message routing information
export interface MessageContext {
  sender: 'content' | 'background' | 'popup';
  target: 'content' | 'background' | 'popup' | 'broadcast';
  priority: 'low' | 'normal' | 'high';
  timeout?: number;
}

// Enhanced message wrapper
export interface ExtensionMessage<T = unknown> extends BaseMessage {
  context?: MessageContext;
  data?: T;
}

// Request/Response Pattern Messages
export interface ExtractFramesRequest extends BaseRequest {
  type: 'EXTRACT_FRAMES_REQUEST';
  data: {
    videoElement: {
      currentTime: number;
      duration: number;
      videoWidth: number;
      videoHeight: number;
      videoUrl: string;
    };
    settings: {
      startTime: number;
      endTime: number;
      frameRate: number;
      quality: 'low' | 'medium' | 'high';
    };
  };
}

export interface ExtractFramesResponse extends BaseResponse {
  type: 'EXTRACT_FRAMES_RESPONSE';
  data?: {
    frames: ImageData[];
    frameCount: number;
    totalDuration: number;
  };
}

export interface EncodeGifRequest extends BaseRequest {
  type: 'ENCODE_GIF_REQUEST';
  data: {
    frames: ImageData[];
    settings: GifSettings;
    metadata: {
      title: string;
      description?: string;
      youtubeUrl: string;
      startTime: number;
      endTime: number;
      textOverlays?: TextOverlay[];
    };
  };
}

export interface EncodeGifResponse extends BaseResponse {
  type: 'ENCODE_GIF_RESPONSE';
  data?: {
    gifBlob: Blob;
    thumbnailBlob?: Blob;
    metadata: {
      fileSize: number;
      duration: number;
      width: number;
      height: number;
      frameCount: number;
    };
  };
}

export interface GetVideoStateRequest extends BaseRequest {
  type: 'GET_VIDEO_STATE_REQUEST';
  data?: {
    includeMetadata?: boolean;
    includeTimestamp?: boolean;
  };
}

export interface GetVideoStateResponse extends BaseResponse {
  type: 'GET_VIDEO_STATE_RESPONSE';
  data?: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    videoUrl: string;
    title: string;
    metadata?: {
      channel: string;
      uploadDate?: string;
      viewCount?: number;
    };
  };
}

// Event Broadcasting Messages (no response expected)
export interface ShowTimelineEvent extends ExtensionMessage {
  type: 'SHOW_TIMELINE_EVENT';
  data: {
    videoDuration: number;
    currentTime: number;
    initialSelection?: TimelineSelection;
  };
}

export interface HideTimelineEvent extends ExtensionMessage {
  type: 'HIDE_TIMELINE_EVENT';
}

export interface TimelineSelectionUpdate extends ExtensionMessage {
  type: 'TIMELINE_SELECTION_UPDATE';
  data: TimelineSelection;
}

export interface OpenEditorEvent extends ExtensionMessage {
  type: 'OPEN_EDITOR_EVENT';
  data: {
    videoUrl: string;
    selection: TimelineSelection;
    gifData?: Partial<GifData>;
  };
}

export interface JobProgressUpdate extends ExtensionMessage {
  type: 'JOB_PROGRESS_UPDATE';
  data: {
    jobId: string;
    progress: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    stage?: string;
    estimatedTimeRemaining?: number;
  };
}

// Logging and Debugging Messages
export interface LogMessage extends ExtensionMessage {
  type: 'LOG_MESSAGE';
  data: {
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    context?: Record<string, unknown>;
    component: string;
  };
}

// Job Management Messages
export interface GetJobStatusRequest extends BaseRequest {
  type: 'GET_JOB_STATUS_REQUEST';
  data: {
    jobId: string;
  };
}

export interface GetJobStatusResponse extends BaseResponse {
  type: 'GET_JOB_STATUS_RESPONSE';
  data?: {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
    createdAt: string;
    completedAt?: string;
    result?: unknown;
  };
}

export interface CancelJobRequest extends BaseRequest {
  type: 'CANCEL_JOB_REQUEST';
  data: {
    jobId: string;
    reason?: string;
  };
}

export interface CancelJobResponse extends BaseResponse {
  type: 'CANCEL_JOB_RESPONSE';
  data?: {
    jobId: string;
    cancelled: boolean;
  };
}

// Storage Operations
export interface SaveGifRequest extends BaseRequest {
  type: 'SAVE_GIF_REQUEST';
  data: {
    gifData: GifData;
    overwrite?: boolean;
  };
}

export interface SaveGifResponse extends BaseResponse {
  type: 'SAVE_GIF_RESPONSE';
  data?: {
    gifId: string;
    savedAt: string;
  };
}

export interface GetGifLibraryRequest extends BaseRequest {
  type: 'GET_GIF_LIBRARY_REQUEST';
  data?: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: 'createdAt' | 'title' | 'duration' | 'size';
    sortOrder?: 'asc' | 'desc';
  };
}

export interface GetGifLibraryResponse extends BaseResponse {
  type: 'GET_GIF_LIBRARY_RESPONSE';
  data?: {
    gifs: GifData[];
    totalCount: number;
    hasMore: boolean;
  };
}

// Union Types for Type Safety
export type RequestMessage = 
  | ExtractFramesRequest
  | EncodeGifRequest
  | GetVideoStateRequest
  | GetJobStatusRequest
  | CancelJobRequest
  | SaveGifRequest
  | GetGifLibraryRequest;

export type ResponseMessage = 
  | ExtractFramesResponse
  | EncodeGifResponse
  | GetVideoStateResponse
  | GetJobStatusResponse
  | CancelJobResponse
  | SaveGifResponse
  | GetGifLibraryResponse;

export type EventMessage = 
  | ShowTimelineEvent
  | HideTimelineEvent
  | TimelineSelectionUpdate
  | OpenEditorEvent
  | JobProgressUpdate
  | LogMessage;

export type AllMessages = RequestMessage | ResponseMessage | EventMessage;

// Type Guards for Message Validation
export function isRequest(message: BaseMessage): message is RequestMessage {
  return 'requestId' in message && !('success' in message);
}

export function isResponse(message: BaseMessage): message is ResponseMessage {
  return 'requestId' in message && 'success' in message;
}

export function isEvent(message: BaseMessage): message is EventMessage {
  return !('requestId' in message) || !('success' in message);
}

// Specific type guards
export function isExtractFramesRequest(message: BaseMessage): message is ExtractFramesRequest {
  return message.type === 'EXTRACT_FRAMES_REQUEST';
}

export function isEncodeGifRequest(message: BaseMessage): message is EncodeGifRequest {
  return message.type === 'ENCODE_GIF_REQUEST';
}

export function isGetVideoStateRequest(message: BaseMessage): message is GetVideoStateRequest {
  return message.type === 'GET_VIDEO_STATE_REQUEST';
}

export function isShowTimelineEvent(message: BaseMessage): message is ShowTimelineEvent {
  return message.type === 'SHOW_TIMELINE_EVENT';
}

export function isTimelineSelectionUpdate(message: BaseMessage): message is TimelineSelectionUpdate {
  return message.type === 'TIMELINE_SELECTION_UPDATE';
}

export function isJobProgressUpdate(message: BaseMessage): message is JobProgressUpdate {
  return message.type === 'JOB_PROGRESS_UPDATE';
}

export function isLogMessage(message: BaseMessage): message is LogMessage {
  return message.type === 'LOG_MESSAGE';
}

// Response Helper Functions
export function createSuccessResponse<TReq extends BaseRequest, TRes extends BaseResponse>(
  request: TReq,
  responseType: TRes['type'],
  data?: unknown
): TRes {
  return {
    type: responseType,
    id: generateMessageId(),
    requestId: request.requestId,
    success: true,
    data,
    timestamp: Date.now()
  } as unknown as TRes;
}

export function createErrorResponse<TReq extends BaseRequest, TRes extends BaseResponse>(
  request: TReq,
  responseType: TRes['type'],
  error: string | { code: string; message: string; details?: Record<string, unknown> }
): TRes {
  const errorObj = typeof error === 'string' 
    ? { code: 'UNKNOWN_ERROR', message: error }
    : error;

  return {
    type: responseType,
    id: generateMessageId(),
    requestId: request.requestId,
    success: false,
    error: errorObj,
    timestamp: Date.now()
  } as TRes;
}

// Utility Functions
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createBaseMessage<T extends BaseMessage>(
  type: T['type'],
  data?: unknown,
  context?: MessageContext
): T {
  return {
    type,
    id: generateMessageId(),
    data,
    context,
    timestamp: Date.now()
  } as unknown as T;
}

export function createRequest<T extends BaseRequest>(
  type: T['type'],
  data: unknown,
  context?: MessageContext
): T {
  return {
    type,
    id: generateMessageId(),
    requestId: generateRequestId(),
    data,
    context,
    timestamp: Date.now()
  } as unknown as T;
}

// Message Validation
export function validateMessage(message: unknown): message is BaseMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  const msg = message as Record<string, unknown>;
  return typeof msg.type === 'string' && typeof msg.id === 'string';
}

export function sanitizeMessage(message: BaseMessage): BaseMessage {
  const sanitized: BaseMessage = {
    type: message.type,
    id: message.id
  };

  if (message.timestamp) {
    sanitized.timestamp = message.timestamp;
  }

  if ('data' in message && (message as { data?: unknown }).data !== undefined) {
    // Basic sanitization - remove functions and undefined values
    (sanitized as { data?: unknown }).data = JSON.parse(JSON.stringify((message as { data: unknown }).data));
  }

  return sanitized;
}