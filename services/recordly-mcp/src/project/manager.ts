import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import type {
  EditorProjectData,
  ProjectEditorState,
  CursorTelemetryFile,
  CursorTelemetryPoint,
} from "../types.js";

export function getDefaultRecordlyUserDataDir(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Recordly");
  }
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Recordly");
  }
  // Linux / default
  return path.join(os.homedir(), ".config", "Recordly");
}

export function getDefaultRecordingsDir(): string {
  return path.join(getDefaultRecordlyUserDataDir(), "recordings");
}

export function getDefaultProjectsDir(): string {
  return path.join(getDefaultRecordlyUserDataDir(), "projects");
}

export interface ProjectSummary {
  filePath: string;
  name: string;
  videoPath: string;
  version: number;
  zoomRegionCount: number;
  clipCount: number;
  captionCount: number;
  aspectRatio: string;
  lastModifiedMs: number;
}

export async function listProjects(searchDir?: string): Promise<ProjectSummary[]> {
  const dirsToSearch = searchDir
    ? [searchDir]
    : [getDefaultProjectsDir(), getDefaultRecordingsDir(), process.cwd()];

  const results: ProjectSummary[] = [];
  const visitedPaths = new Set<string>();

  for (const dir of dirsToSearch) {
    if (!existsSync(dir)) continue;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".recordly")) {
          const fullPath = path.resolve(dir, entry.name);
          if (visitedPaths.has(fullPath)) continue;
          visitedPaths.add(fullPath);

          try {
            const stat = await fs.stat(fullPath);
            const content = await fs.readFile(fullPath, "utf-8");
            const data = JSON.parse(content) as EditorProjectData;

            results.push({
              filePath: fullPath,
              name: path.basename(entry.name, ".recordly"),
              videoPath: data.videoPath || "",
              version: data.version || 2,
              zoomRegionCount: data.editor?.zoomRegions?.length || 0,
              clipCount: data.editor?.clipRegions?.length || 0,
              captionCount: data.editor?.autoCaptions?.length || 0,
              aspectRatio: data.editor?.aspectRatio || "16:9",
              lastModifiedMs: stat.mtimeMs,
            });
          } catch {
            // Ignore parse errors on individual files
          }
        }
      }
    } catch {
      // Ignore unreadable directories
    }
  }

  return results.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);
}

export async function loadProject(projectPath: string): Promise<EditorProjectData> {
  const resolved = path.resolve(projectPath);
  if (!existsSync(resolved)) {
    throw new Error(`Project file not found: ${resolved}`);
  }

  const raw = await fs.readFile(resolved, "utf-8");
  const data = JSON.parse(raw) as EditorProjectData;
  if (!data || typeof data !== "object") {
    throw new Error(`Invalid project payload in: ${resolved}`);
  }

  // Ensure default structures exist
  if (!data.editor) data.editor = {};
  if (!data.editor.zoomRegions) data.editor.zoomRegions = [];
  if (!data.editor.clipRegions) data.editor.clipRegions = [];
  if (!data.editor.trimRegions) data.editor.trimRegions = [];
  if (!data.editor.autoCaptions) data.editor.autoCaptions = [];
  if (!data.editor.speedRegions) data.editor.speedRegions = [];

  return data;
}

export async function saveProject(
  projectPath: string,
  projectData: EditorProjectData,
): Promise<{ success: boolean; filePath: string }> {
  const resolved = path.resolve(projectPath);
  const dir = path.dirname(resolved);
  await fs.mkdir(dir, { recursive: true });

  // Backup existing file if present
  if (existsSync(resolved)) {
    const backupPath = `${resolved}.bak`;
    try {
      await fs.copyFile(resolved, backupPath);
    } catch {
      // Ignore backup error
    }
  }

  const tempPath = path.join(dir, `.tmp-${path.basename(resolved)}-${Date.now()}`);
  const serialized = JSON.stringify(projectData, null, 2);

  await fs.writeFile(tempPath, serialized, "utf-8");
  await fs.rename(tempPath, resolved);

  return { success: true, filePath: resolved };
}

export function createDefaultEditorState(): Partial<ProjectEditorState> {
  return {
    wallpaper: "mesh-gradient-1",
    shadowIntensity: 40,
    backgroundBlur: 0,
    zoomMotionBlur: 0.5,
    connectZooms: true,
    zoomInDurationMs: 400,
    zoomInOverlapMs: 100,
    zoomOutDurationMs: 400,
    connectedZoomGapMs: 1500,
    connectedZoomDurationMs: 500,
    zoomInEasing: "recordly",
    zoomOutEasing: "recordly",
    connectedZoomEasing: "recordly",
    showCursor: true,
    loopCursor: false,
    cursorStyle: "macos",
    cursorClickEffect: "spotlight",
    cursorClickEffectColor: "#2563EB",
    cursorClickEffectScale: 1,
    cursorClickEffectOpacity: 1,
    cursorClickEffectDurationMs: 600,
    cursorSize: 1,
    cursorSmoothing: 0.5,
    cursorMotionBlur: 0.5,
    cursorClickBounce: 1,
    cursorClickBounceDuration: 250,
    cursorSway: 0.2,
    borderRadius: process.platform === "darwin" ? 8 : 0,
    padding: { top: 32, right: 32, bottom: 32, left: 32 },
    cropRegion: { x: 0, y: 0, width: 1, height: 1 },
    zoomRegions: [],
    trimRegions: [],
    clipRegions: [],
    speedRegions: [],
    autoCaptions: [],
    autoCaptionSettings: {
      position: "bottom-center",
      style: "highlight",
      color: "#FFFFFF",
    },
    webcam: {
      enabled: false,
      sourcePath: null,
      timeOffsetMs: 0,
      mirror: false,
      positionPreset: "bottom-right",
      size: 0.25,
      roundness: 100,
    },
    aspectRatio: "16:9",
  };
}

export async function createProject(options: {
  videoPath: string;
  projectName?: string;
  targetDir?: string;
}): Promise<{ projectData: EditorProjectData; filePath: string }> {
  const resolvedVideo = path.resolve(options.videoPath);
  if (!existsSync(resolvedVideo)) {
    throw new Error(`Video file does not exist: ${resolvedVideo}`);
  }

  const baseName = options.projectName || path.basename(resolvedVideo, path.extname(resolvedVideo));
  const targetDir = options.targetDir || getDefaultProjectsDir();
  const filePath = path.join(targetDir, `${baseName}.recordly`);

  const projectData: EditorProjectData = {
    version: 2,
    projectId: randomUUID(),
    videoPath: resolvedVideo,
    editor: createDefaultEditorState(),
  };

  await saveProject(filePath, projectData);
  return { projectData, filePath };
}

export function getTelemetryPathForVideo(videoPath: string): string {
  return `${videoPath}.cursor.json`;
}

export async function loadCursorTelemetry(
  videoPath: string,
): Promise<CursorTelemetryPoint[]> {
  const telemetryPath = getTelemetryPathForVideo(videoPath);
  if (!existsSync(telemetryPath)) {
    return [];
  }

  try {
    const raw = await fs.readFile(telemetryPath, "utf-8");
    const parsed = JSON.parse(raw) as CursorTelemetryFile | CursorTelemetryPoint[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed?.samples)) {
      return parsed.samples;
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveCursorTelemetry(
  videoPath: string,
  samples: CursorTelemetryPoint[],
): Promise<string> {
  const telemetryPath = getTelemetryPathForVideo(videoPath);
  const payload: CursorTelemetryFile = {
    version: 1,
    samples,
  };
  await fs.writeFile(telemetryPath, JSON.stringify(payload, null, 2), "utf-8");
  return telemetryPath;
}
