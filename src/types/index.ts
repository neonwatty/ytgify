// Re-export all storage types as the canonical definitions
export {
  GifData,
  GifSettings,
  TextOverlay,
  TimelineSelection,
  
} from './storage';

// Re-export all message types for Chrome extension communication
export {
  
  ExtractFramesRequest,
  ExtractFramesResponse,
  EncodeGifRequest,
  EncodeGifResponse,
  GetVideoStateRequest,
  GetVideoStateResponse,
  ShowTimelineRequest,
  HideTimelineRequest,
  
  TimelineSelectionUpdate,
  
  LogMessage,
  ErrorResponse,
  SuccessResponse,
  DownloadGifRequest,
  GetJobStatusRequest,
  
  
  
  JobProgressUpdate,
  RequestVideoDataForGif,
  VideoDataResponse,
  GifCreationComplete,
  SaveGifRequest,
  SaveGifResponse,
  ExtensionMessage,
  isExtractFramesRequest,
  isEncodeGifRequest,
  isGetVideoStateRequest,
  
  
  isTimelineSelectionUpdate,
  
  isLogMessage,
  isDownloadGifRequest,
  isGetJobStatusRequest,
  
} from './messages';