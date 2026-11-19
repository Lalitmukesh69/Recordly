/**
 * Core type definitions for Recordly projects and editing operations.
 * Mirrors Recordly's internal schema (version 2).
 */

export type ZoomDepth = 1 | 2 | 3 | 4 | 5 | 6;

export interface ZoomFocus {
  cx: number; // Normalized horizontal center [0, 1]
  cy: number; // Normalized vertical center [0, 1]
}

export type ZoomMode = "auto" | "manual";

export type ZoomTransitionEasing = "recordly" | "glide" | "smooth" | "snappy" | "linear";

export interface ZoomRegion {
  id: string;
  startMs: number;
  endMs: number;
  depth: ZoomDepth;
  focus: ZoomFocus;
  mode?: ZoomMode;
}

export interface TrimRegion {
  id: string;
  startMs: number;
  endMs: number;
}

export interface ClipRegion {
  id: string;
  sourcePath?: string;
  startMs: number;
  endMs: number;
  timelineStartMs?: number;
  sourceStartMs?: number;
  sourceMinMs?: number;
  sourceMaxMs?: number;
  speed?: number;
  volume?: number;
  muted?: boolean;
  showSourceAudio?: boolean;
}

export interface ZoomMotionBlurTuning {
  panVelocityThreshold?: number;
  zoomVelocityThreshold?: number;
  maxDirectionalBlurPx?: number;
  maxRadialBlurStrength?: number;
  panResponsePerSecond?: number;
  zoomResponsePerSecond?: number;
  zoomSafeZoneRadiusPx?: number;
}

export interface SpeedRegion {
  id: string;
  startMs: number;
  endMs: number;
  speed: number;
}

export interface CaptionCue {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface AutoCaptionSettings {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  position?: "bottom-center" | "top-center" | "center";
  style?: "classic" | "highlight" | "karaoke" | "minimal";
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5" | "4:3" | "21:9" | "custom";

export type CursorStyle =
  | "macos"
  | "tahoe"
  | "tahoe-inverted"
  | "windows11"
  | "dot"
  | "figma"
  | string;

export type CursorClickEffectStyle = "none" | "spotlight" | "ripple" | "echo";

export type WebcamPositionPreset =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-center"
  | "custom";

export interface WebcamOverlaySettings {
  enabled: boolean;
  sourcePath: string | null;
  timeOffsetMs: number;
  mirror: boolean;
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  positionPreset: WebcamPositionPreset;
  positionX?: number;
  positionY?: number;
  size: number;
  width?: number;
  height?: number;
  roundness?: number;
}

export interface ProjectEditorState {
  wallpaper: string;
  shadowIntensity: number;
  backgroundBlur: number;
  zoomMotionBlur: number;
  zoomMotionBlurTuning?: ZoomMotionBlurTuning;
  connectZooms: boolean;
  zoomInDurationMs: number;
  zoomInOverlapMs: number;
  zoomOutDurationMs: number;
  connectedZoomGapMs: number;
  connectedZoomDurationMs: number;
  zoomInEasing: ZoomTransitionEasing;
  zoomOutEasing: ZoomTransitionEasing;
  connectedZoomEasing: ZoomTransitionEasing;
  showCursor: boolean;
  loopCursor: boolean;
  cursorStyle: CursorStyle;
  cursorClickEffect: CursorClickEffectStyle;
  cursorClickEffectColor: string;
  cursorClickEffectScale: number;
  cursorClickEffectOpacity: number;
  cursorClickEffectDurationMs: number;
  cursorSize: number;
  cursorSmoothing: number;
  cursorMotionBlur: number;
  cursorClickBounce: number;
  cursorClickBounceDuration: number;
  cursorSway: number;
  borderRadius: number;
  padding: Padding;
  cropRegion: CropRegion;
  zoomRegions: ZoomRegion[];
  trimRegions: TrimRegion[];
  clipRegions: ClipRegion[];
  speedRegions: SpeedRegion[];
  autoCaptions: CaptionCue[];
  autoCaptionSettings: AutoCaptionSettings;
  webcam: WebcamOverlaySettings;
  aspectRatio: AspectRatio;
}

export interface EditorProjectData {
  version: number;
  projectId?: string;
  videoPath: string;
  editor: Partial<ProjectEditorState>;
}

export interface CursorTelemetryPoint {
  timeMs: number;
  cx: number;
  cy: number;
  interactionType?:
    | "move"
    | "click"
    | "double-click"
    | "right-click"
    | "middle-click"
    | "mouseup";
  cursorType?: string;
}

export interface CursorTelemetryFile {
  version: number;
  samples: CursorTelemetryPoint[];
}

export interface VideoReportCut {
  startMs: number;
  endMs: number;
  reason?: string;
}

export interface VideoReportClick {
  timestampMs: number;
  x: number;
  y: number;
  label?: string;
  depth?: ZoomDepth;
}

export interface VideoReportZoom {
  startMs: number;
  endMs: number;
  focusX: number;
  focusY: number;
  depth?: ZoomDepth;
  mode?: ZoomMode;
}

export interface VideoReportPayload {
  cuts?: VideoReportCut[];
  clicks?: VideoReportClick[];
  zooms?: VideoReportZoom[];
  motionBlur?: {
    zoomMotionBlur?: number;
    cursorMotionBlur?: number;
    tuning?: Partial<ZoomMotionBlurTuning>;
  };
  cursorEffect?: {
    showCursor?: boolean;
    cursorStyle?: CursorStyle;
    cursorSize?: number;
    clickEffect?: CursorClickEffectStyle;
    clickEffectColor?: string;
  };
  canvas?: {
    wallpaper?: string;
    backgroundBlur?: number;
    shadowIntensity?: number;
    borderRadius?: number;
    aspectRatio?: AspectRatio;
  };
  captions?: Array<{
    startMs: number;
    endMs: number;
    text: string;
  }>;
}
