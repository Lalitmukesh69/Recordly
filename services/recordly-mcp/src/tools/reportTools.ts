import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  loadProject,
  saveProject,
  saveCursorTelemetry,
  loadCursorTelemetry,
} from "../project/manager.js";
import type {
  ClipRegion,
  TrimRegion,
  ZoomRegion,
  ZoomDepth,
  CursorTelemetryPoint,
} from "../types.js";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

const execFileAsync = promisify(execFile);

async function probeVideoMetadata(videoPath: string): Promise<{ durationMs: number | null; rotation: number | null }> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream_side_data=rotation:stream=rotation:format=duration",
      "-of",
      "json",
      videoPath,
    ]);
    const json = JSON.parse(stdout);
    const durationSec = parseFloat(json.format?.duration);
    const durationMs = Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : null;
    let rotation: number | null = null;
    for (const s of json.streams || []) {
      if (typeof s.rotation === "number") rotation = s.rotation;
      for (const sd of s.side_data_list || []) {
        if (typeof sd.rotation === "number") rotation = sd.rotation;
      }
    }
    return { durationMs, rotation };
  } catch {
    return { durationMs: null, rotation: null };
  }
}

async function normalizeVideoRotationIfNeeded(videoPath: string): Promise<string> {
  const { rotation } = await probeVideoMetadata(videoPath);
  if (!rotation || rotation === 0) return videoPath;

  // Video has container-level display matrix rotation (common in tablet/mobile screen recordings).
  // WebDemuxer + WebCodecs decoder strips container matrix during export, while HTML5 <video> auto-rotates in UI preview.
  // Normalize the video so rotation is physically baked into the pixels.
  const parsed = path.parse(videoPath);
  const normalizedPath = path.join(parsed.dir, `${parsed.name}.normalized${parsed.ext}`);
  if (fs.existsSync(normalizedPath)) {
    return normalizedPath;
  }
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "17",
      "-c:a",
      "copy",
      normalizedPath,
    ]);
    return normalizedPath;
  } catch (err) {
    console.warn("[ReportTools] Failed to normalize video rotation:", err);
    return videoPath;
  }
}

export function registerReportTools(server: McpServer) {
  server.tool(
    "recordly_apply_video_report",
    "Instantly edit a video project from a structured analysis report: cuts out unwanted/sensitive segments, generates smooth auto-zooms on clicks, applies cinematic motion blur, configures blue cursor spotlights, and formats canvas layout in a single fast operation.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      cuts: z
        .array(
          z.object({
            startMs: z.number().describe("Source start time to cut out in milliseconds."),
            endMs: z.number().describe("Source end time to cut out in milliseconds."),
            reason: z.string().optional().describe("Description of what is being removed (e.g. 'laptop specs', 'recorder hud')."),
          }),
        )
        .optional()
        .describe("List of time ranges in the raw video to remove."),
      clicks: z
        .array(
          z.object({
            timestampMs: z.number().describe("Source timestamp in milliseconds when click occurred."),
            x: z.number().min(0).max(1).describe("Normalized X coordinate [0.0 to 1.0]."),
            y: z.number().min(0).max(1).describe("Normalized Y coordinate [0.0 to 1.0]."),
            label: z.string().optional().describe("Optional UI element label for the click."),
            depth: z.number().min(1).max(6).optional().describe("Zoom depth (1=1.25x, 2=1.5x, 3=1.8x, 4=2.2x). Default 2."),
          }),
        )
        .optional()
        .describe("Mouse clicks to auto-zoom on."),
      zooms: z
        .array(
          z.object({
            startMs: z.number().describe("Source start time in milliseconds."),
            endMs: z.number().describe("Source end time in milliseconds."),
            focusX: z.number().min(0).max(1).describe("Normalized horizontal center coordinate [0.0 to 1.0]."),
            focusY: z.number().min(0).max(1).describe("Normalized vertical center coordinate [0.0 to 1.0]."),
            depth: z.number().min(1).max(6).optional().describe("Zoom depth (1 to 6). Default is 2."),
            mode: z.enum(["manual", "auto"]).optional().describe("Zoom mode."),
          }),
        )
        .optional()
        .describe("Custom camera zoom regions."),
      motionBlur: z
        .object({
          zoomMotionBlur: z.number().min(0).max(2).optional().describe("Camera zoom motion blur intensity (e.g. 0.5 for realistic blur)."),
          cursorMotionBlur: z.number().min(0).max(1).optional().describe("Cursor motion blur trail intensity (0.0 to 1.0)."),
          connectZooms: z.boolean().optional().describe("Whether consecutive zooms smoothly pan between focus points."),
        })
        .optional()
        .describe("Motion blur configuration."),
      cursorEffect: z
        .object({
          showCursor: z.boolean().optional().describe("Whether virtual cursor is visible."),
          cursorStyle: z.string().optional().describe("Cursor visual style ('windows11', 'macos', 'tahoe', 'dot')."),
          cursorSize: z.number().min(0.2).max(4.0).optional().describe("Cursor scale multiplier."),
          clickEffect: z.enum(["spotlight", "ripple", "echo", "none"]).optional().describe("Click animation type."),
          clickEffectColor: z.string().optional().describe("Click animation hex color (e.g. #2563EB)."),
        })
        .optional()
        .describe("Cursor simulation and click spotlight effects."),
      canvas: z
        .object({
          wallpaper: z.string().optional().describe("Background wallpaper preset or image path."),
          backgroundBlur: z.number().min(0).max(8).optional().describe("Background blur radius."),
          shadowIntensity: z.number().min(0).max(100).optional().describe("Drop shadow intensity."),
          borderRadius: z.number().min(0).max(32).optional().describe("Window corner radius."),
          aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "4:3", "21:9", "custom"]).optional().describe("Target aspect ratio."),
        })
        .optional()
        .describe("Canvas layout, wallpaper, and framing options."),
    },
    async ({ projectPath, cuts = [], clicks = [], zooms = [], motionBlur, cursorEffect, canvas }) => {
      try {
        const data = await loadProject(projectPath);

        // 1. Determine total source duration and normalize rotation if needed
        const normalizedVideoPath = await normalizeVideoRotationIfNeeded(data.videoPath);
        if (normalizedVideoPath !== data.videoPath) {
          data.videoPath = normalizedVideoPath;
        }

        const meta = await probeVideoMetadata(data.videoPath);
        let totalDurationMs = meta.durationMs;
        if (!totalDurationMs || totalDurationMs <= 0) {
          const maxCutEnd = Math.max(0, ...cuts.map((c) => c.endMs));
          const maxClick = Math.max(0, ...clicks.map((c) => c.timestampMs));
          const maxZoom = Math.max(0, ...zooms.map((z) => z.endMs));
          totalDurationMs = Math.max(maxCutEnd, maxClick, maxZoom, 60000);
        }

        // 2. Compute kept intervals from cuts
        const sortedCuts = [...cuts]
          .filter((c) => c.endMs > c.startMs)
          .sort((a, b) => a.startMs - b.startMs);

        // Merge overlapping cuts
        const mergedCuts: Array<{ startMs: number; endMs: number; reason?: string }> = [];
        for (const cut of sortedCuts) {
          const last = mergedCuts[mergedCuts.length - 1];
          if (last && cut.startMs <= last.endMs) {
            last.endMs = Math.max(last.endMs, cut.endMs);
            if (cut.reason && !last.reason?.includes(cut.reason)) {
              last.reason = `${last.reason || ""}, ${cut.reason}`;
            }
          } else {
            mergedCuts.push({ ...cut });
          }
        }

        // Calculate kept spans
        const keptSpans: Array<{ startMs: number; endMs: number }> = [];
        let cursor = 0;
        for (const cut of mergedCuts) {
          const cutStart = Math.max(0, Math.min(cut.startMs, totalDurationMs));
          const cutEnd = Math.max(cutStart, Math.min(cut.endMs, totalDurationMs));
          if (cutStart > cursor) {
            keptSpans.push({ startMs: cursor, endMs: cutStart });
          }
          cursor = Math.max(cursor, cutEnd);
        }
        if (cursor < totalDurationMs) {
          keptSpans.push({ startMs: cursor, endMs: totalDurationMs });
        }

        // Generate contiguous ClipRegions
        let timelineCursor = 0;
        const newClips: ClipRegion[] = keptSpans.map((span, index) => {
          const duration = span.endMs - span.startMs;
          const clip: ClipRegion = {
            id: `clip-${index + 1}`,
            startMs: timelineCursor,
            endMs: timelineCursor + duration,
            sourceStartMs: span.startMs,
            timelineStartMs: timelineCursor,
            speed: 1,
            muted: false,
            showSourceAudio: false,
          };
          timelineCursor += duration;
          return clip;
        });

        // Generate TrimRegions (the cut gaps)
        const newTrims: TrimRegion[] = mergedCuts.map((cut, index) => ({
          id: `trim-gap-${index + 1}`,
          startMs: cut.startMs,
          endMs: cut.endMs,
        }));

        data.editor.clipRegions = newClips;
        data.editor.trimRegions = newTrims;

        // Helper: Map source time to timeline time
        function mapSourceToTimeline(sourceMs: number): { timelineMs: number; clip: ClipRegion } | null {
          for (const clip of newClips) {
            const clipSrcStart = clip.sourceStartMs ?? clip.startMs;
            const clipSrcEnd = clipSrcStart + (clip.endMs - clip.startMs);
            if (sourceMs >= clipSrcStart && sourceMs <= clipSrcEnd) {
              const offset = sourceMs - clipSrcStart;
              return { timelineMs: clip.startMs + offset, clip };
            }
          }
          return null;
        }

        // 3. Generate Zoom Regions from clicks and explicit zooms
        const newZooms: ZoomRegion[] = [];

        for (const click of clicks) {
          const mapped = mapSourceToTimeline(click.timestampMs);
          if (!mapped) continue; // Skip clicks in cut footage

          const { timelineMs, clip } = mapped;
          const zoomStart = Math.max(clip.startMs, timelineMs - 700);
          const zoomEnd = Math.min(clip.endMs, timelineMs + 800);

          if (zoomEnd > zoomStart + 200) {
            newZooms.push({
              id: `zoom-click-${randomUUID().slice(0, 8)}`,
              startMs: Math.round(zoomStart),
              endMs: Math.round(zoomEnd),
              depth: (click.depth ?? 2) as ZoomDepth,
              focus: {
                cx: Math.max(0, Math.min(1, click.x)),
                cy: Math.max(0, Math.min(1, click.y)),
              },
              mode: "auto",
            });
          }
        }

        for (const customZoom of zooms) {
          const mappedStart = mapSourceToTimeline(customZoom.startMs);
          const mappedEnd = mapSourceToTimeline(customZoom.endMs);
          if (mappedStart && mappedEnd && mappedStart.clip.id === mappedEnd.clip.id) {
            newZooms.push({
              id: `zoom-custom-${randomUUID().slice(0, 8)}`,
              startMs: Math.round(mappedStart.timelineMs),
              endMs: Math.round(mappedEnd.timelineMs),
              depth: (customZoom.depth ?? 2) as ZoomDepth,
              focus: {
                cx: Math.max(0, Math.min(1, customZoom.focusX)),
                cy: Math.max(0, Math.min(1, customZoom.focusY)),
              },
              mode: customZoom.mode ?? "manual",
            });
          }
        }

        newZooms.sort((a, b) => a.startMs - b.startMs);
        data.editor.zoomRegions = newZooms;

        // 4. Motion Blur
        if (motionBlur) {
          if (motionBlur.zoomMotionBlur !== undefined) data.editor.zoomMotionBlur = motionBlur.zoomMotionBlur;
          if (motionBlur.cursorMotionBlur !== undefined) data.editor.cursorMotionBlur = motionBlur.cursorMotionBlur;
          if (motionBlur.connectZooms !== undefined) data.editor.connectZooms = motionBlur.connectZooms;
        } else {
          // Default to high quality cinematic motion blur
          data.editor.zoomMotionBlur = 0.5;
          data.editor.connectZooms = true;
        }

        // 5. Cursor Effects
        if (cursorEffect) {
          if (cursorEffect.showCursor !== undefined) data.editor.showCursor = cursorEffect.showCursor;
          if (cursorEffect.cursorStyle) data.editor.cursorStyle = cursorEffect.cursorStyle;
          if (cursorEffect.cursorSize !== undefined) data.editor.cursorSize = cursorEffect.cursorSize;
          if (cursorEffect.clickEffect) data.editor.cursorClickEffect = cursorEffect.clickEffect;
          if (cursorEffect.clickEffectColor) data.editor.cursorClickEffectColor = cursorEffect.clickEffectColor;
        }

        // 6. Canvas Layout
        if (canvas) {
          if (canvas.wallpaper) data.editor.wallpaper = canvas.wallpaper;
          if (canvas.backgroundBlur !== undefined) data.editor.backgroundBlur = canvas.backgroundBlur;
          if (canvas.shadowIntensity !== undefined) {
            data.editor.shadowIntensity =
              canvas.shadowIntensity > 1 ? canvas.shadowIntensity / 100 : canvas.shadowIntensity;
          }
          if (canvas.borderRadius !== undefined) data.editor.borderRadius = canvas.borderRadius;
          if (canvas.aspectRatio) data.editor.aspectRatio = canvas.aspectRatio;
        }

        // 7. Update cursor telemetry file if clicks exist
        if (clicks.length > 0) {
          const telemetryPoints: CursorTelemetryPoint[] = clicks.map((c) => ({
            timeMs: Math.round(c.timestampMs),
            cx: Math.max(0, Math.min(1, c.x)),
            cy: Math.max(0, Math.min(1, c.y)),
            interactionType: "click",
            cursorType: "pointer",
          }));
          await saveCursorTelemetry(data.videoPath, telemetryPoints);
        }

        // 8. Save Project
        await saveProject(projectPath, data);

        const totalTimelineDurationSec = (timelineCursor / 1000).toFixed(2);
        const originalDurationSec = (totalDurationMs / 1000).toFixed(2);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Video report applied successfully.",
                  summary: {
                    projectPath,
                    originalDurationSec,
                    editedTimelineDurationSec: totalTimelineDurationSec,
                    clipsCount: newClips.length,
                    cutsCount: mergedCuts.length,
                    zoomsCount: newZooms.length,
                    motionBlur: {
                      zoomMotionBlur: data.editor.zoomMotionBlur,
                      cursorMotionBlur: data.editor.cursorMotionBlur,
                      connectZooms: data.editor.connectZooms,
                    },
                    cursorEffect: {
                      showCursor: data.editor.showCursor,
                      clickEffect: data.editor.cursorClickEffect,
                      clickEffectColor: data.editor.cursorClickEffectColor,
                    },
                  },
                  clips: newClips.map((c) => ({
                    id: c.id,
                    timelineRange: `${(c.startMs / 1000).toFixed(2)}s - ${(c.endMs / 1000).toFixed(2)}s`,
                    sourceRange: `${((c.sourceStartMs ?? 0) / 1000).toFixed(2)}s - ${(((c.sourceStartMs ?? 0) + (c.endMs - c.startMs)) / 1000).toFixed(2)}s`,
                  })),
                  zoomRegions: newZooms.map((z) => ({
                    id: z.id,
                    timelineRange: `${(z.startMs / 1000).toFixed(2)}s - ${(z.endMs / 1000).toFixed(2)}s`,
                    focus: z.focus,
                    depth: z.depth,
                  })),
                  cutsApplied: mergedCuts.map((c) => ({
                    sourceRange: `${(c.startMs / 1000).toFixed(2)}s - ${(c.endMs / 1000).toFixed(2)}s`,
                    reason: c.reason,
                  })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error applying video report: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
