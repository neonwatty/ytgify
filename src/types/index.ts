// Re-export all storage types as the canonical definitions
export { 
  GifData, 
  GifMetadata, 
  GifSettings, 
  TextOverlay, 
  TimelineSelection,
  UserPreferences,
  StorageQuota
} from './storage';

// Re-export all message types for Chrome extension communication
export {
  BaseMessage,
  ExtractFramesRequest,
  ExtractFramesResponse,
  EncodeGifRequest,
  EncodeGifResponse,
  GetVideoStateRequest,
  GetVideoStateResponse,
  ShowTimelineRequest,
  HideTimelineRequest,
  TimelineSelectionUpdate,
  OpenEditorRequest,
  LogMessage,
  ErrorResponse,
  GetJobStatusRequest,
  GetJobStatusResponse,
  CancelJobRequest,
  CancelJobResponse,
  JobProgressUpdate,
  ExtensionMessage,
  isExtractFramesRequest,
  isEncodeGifRequest,
  isGetVideoStateRequest,
  isShowTimelineRequest,
  isHideTimelineRequest,
  isTimelineSelectionUpdate,
  isOpenEditorRequest,
  isLogMessage,
  createResponse
} from './messages';