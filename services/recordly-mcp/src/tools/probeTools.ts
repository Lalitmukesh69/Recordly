import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadProject, loadCursorTelemetry } from "../project/manager.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);

export function registerProbeTools(server: McpServer) {
  // 1. Probe Video
  server.tool(
    "recordly_probe_video",
    "Probe video file metadata (resolution, duration, fps, codecs, file size) via ffprobe or filesystem stats.",
    {
      filePath: z.string().describe("Path to the video file or .recordly project file."),
    },
    async ({ filePath }) => {
      try {
        let videoTarget = filePath;

        // If a .recordly file was passed, resolve its source video path
        if (filePath.endsWith(".recordly")) {
          const project = await loadProject(filePath);
          videoTarget = project.videoPath;
        }

        if (!existsSync(videoTarget)) {
          throw new Error(`Video file does not exist: ${videoTarget}`);
        }

        const stat = await fs.stat(videoTarget);

        let probeData: Record<string, unknown> | null = null;
        try {
          const { stdout } = await execFileAsync("ffprobe", [
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            videoTarget,
          ]);
          probeData = JSON.parse(stdout);
        } catch {
          // ffprobe optional fallback
        }

        const videoStream = (probeData?.streams as Array<Record<string, unknown>> | undefined)?.find(
          (s) => s.codec_type === "video",
        );
        const audioStream = (probeData?.streams as Array<Record<string, unknown>> | undefined)?.find(
          (s) => s.codec_type === "audio",
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  filePath: videoTarget,
                  fileSizeBytes: stat.size,
                  fileSizeMB: (stat.size / (1024 * 1024)).toFixed(2),
                  lastModified: stat.mtime.toISOString(),
                  format: probeData?.format
                    ? {
                        durationSec: (probeData.format as Record<string, unknown>).duration,
                        bitrate: (probeData.format as Record<string, unknown>).bit_rate,
                        formatName: (probeData.format as Record<string, unknown>).format_name,
                      }
                    : undefined,
                  videoStream: videoStream
                    ? {
                        codec: videoStream.codec_name,
                        width: videoStream.width,
                        height: videoStream.height,
                        fps: videoStream.avg_frame_rate,
                        pixelFormat: videoStream.pix_fmt,
                      }
                    : undefined,
                  audioStream: audioStream
                    ? {
                        codec: audioStream.codec_name,
                        channels: audioStream.channels,
                        sampleRate: audioStream.sample_rate,
                      }
                    : undefined,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error probing video: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 2. Get Cursor Telemetry
  server.tool(
    "recordly_get_cursor_telemetry",
    "Inspect the recorded cursor telemetry (.cursor.json) to analyze user mouse movements, click timestamps, and screen coordinates.",
    {
      targetPath: z.string().describe("Path to either the video file or the .recordly project file."),
      limitSamples: z
        .number()
        .optional()
        .default(100)
        .describe("Maximum number of raw sample points to return in the preview snippet."),
    },
    async ({ targetPath, limitSamples }) => {
      try {
        let videoTarget = targetPath;
        if (targetPath.endsWith(".recordly")) {
          const project = await loadProject(targetPath);
          videoTarget = project.videoPath;
        }

        const samples = await loadCursorTelemetry(videoTarget);

        const clicks = samples.filter((s) => {
          const t = s.interactionType;
          return t === "click" || t === "double-click" || t === "right-click" || t === "middle-click";
        });

        const moves = samples.filter((s) => s.interactionType === "move" || !s.interactionType);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  videoPath: videoTarget,
                  telemetryFilePath: `${videoTarget}.cursor.json`,
                  totalSamplesCount: samples.length,
                  clicksCount: clicks.length,
                  movesCount: moves.length,
                  recordedDurationSec:
                    samples.length > 0
                      ? ((samples[samples.length - 1].timeMs - samples[0].timeMs) / 1000).toFixed(2)
                      : "0.00",
                  clicksSummary: clicks.map((c) => ({
                    timeSec: (c.timeMs / 1000).toFixed(2),
                    timeMs: c.timeMs,
                    interactionType: c.interactionType,
                    coordinate: `cx: ${c.cx.toFixed(3)}, cy: ${c.cy.toFixed(3)}`,
                  })),
                  previewSamples: samples.slice(0, limitSamples),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error reading telemetry: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
