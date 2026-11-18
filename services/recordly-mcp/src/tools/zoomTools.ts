import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadProject, saveProject, loadCursorTelemetry } from "../project/manager.js";
import { generateAutoZoomsFromTelemetry } from "../algorithms/autoZoom.js";
import type { ZoomRegion, ZoomDepth } from "../types.js";
import { randomUUID } from "node:crypto";

export function registerZoomTools(server: McpServer) {
  // 1. List Zoom Regions
  server.tool(
    "recordly_list_zoom_regions",
    "List all zoom keyframe regions on the project timeline.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
    },
    async ({ projectPath }) => {
      try {
        const data = await loadProject(projectPath);
        const zooms = data.editor.zoomRegions || [];

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  projectPath,
                  count: zooms.length,
                  connectZooms: data.editor.connectZooms ?? true,
                  zoomMotionBlur: data.editor.zoomMotionBlur ?? 0.5,
                  zoomInDurationMs: data.editor.zoomInDurationMs ?? 400,
                  zoomOutDurationMs: data.editor.zoomOutDurationMs ?? 400,
                  zoomRegions: zooms.map((z) => ({
                    id: z.id,
                    timeRange: `${(z.startMs / 1000).toFixed(2)}s - ${(z.endMs / 1000).toFixed(2)}s`,
                    durationSec: ((z.endMs - z.startMs) / 1000).toFixed(2),
                    startMs: z.startMs,
                    endMs: z.endMs,
                    depth: z.depth,
                    focus: z.focus,
                    mode: z.mode || "manual",
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
          content: [{ type: "text", text: `Error listing zoom regions: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 2. Add Zoom Region
  server.tool(
    "recordly_add_zoom_region",
    "Add a zoom keyframe to zoom in on a specific UI element or area during a time interval.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      startMs: z.number().describe("Start time in milliseconds."),
      endMs: z.number().describe("End time in milliseconds."),
      focusX: z
        .number()
        .min(0)
        .max(1)
        .describe("Normalized horizontal center coordinate [0.0 = left edge, 1.0 = right edge]."),
      focusY: z
        .number()
        .min(0)
        .max(1)
        .describe("Normalized vertical center coordinate [0.0 = top edge, 1.0 = bottom edge]."),
      depth: z
        .number()
        .min(1)
        .max(6)
        .default(2)
        .describe("Zoom intensity depth (1 = 1.25x, 2 = 1.5x, 3 = 1.8x, 4 = 2.2x, 5 = 2.8x, 6 = 3.5x). Default is 2."),
      mode: z.enum(["manual", "auto"]).default("manual").describe("Zoom mode."),
    },
    async ({ projectPath, startMs, endMs, focusX, focusY, depth, mode }) => {
      try {
        if (endMs <= startMs) {
          throw new Error(`endMs (${endMs}) must be strictly greater than startMs (${startMs}).`);
        }

        const data = await loadProject(projectPath);
        const zooms = [...(data.editor.zoomRegions || [])];

        const newZoom: ZoomRegion = {
          id: randomUUID(),
          startMs: Math.round(startMs),
          endMs: Math.round(endMs),
          depth: depth as ZoomDepth,
          focus: {
            cx: Math.max(0, Math.min(1, focusX)),
            cy: Math.max(0, Math.min(1, focusY)),
          },
          mode,
        };

        zooms.push(newZoom);
        zooms.sort((a, b) => a.startMs - b.startMs);

        data.editor.zoomRegions = zooms;
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Zoom region added successfully.",
                  zoomRegion: newZoom,
                  totalZoomRegionsCount: zooms.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error adding zoom region: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 3. Update Zoom Region
  server.tool(
    "recordly_update_zoom_region",
    "Update the focus coordinates, timing, or depth of an existing zoom keyframe.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      zoomId: z.string().describe("ID of the zoom region to modify."),
      startMs: z.number().optional().describe("New start time in milliseconds."),
      endMs: z.number().optional().describe("New end time in milliseconds."),
      focusX: z.number().min(0).max(1).optional().describe("New focus cx [0.0 to 1.0]."),
      focusY: z.number().min(0).max(1).optional().describe("New focus cy [0.0 to 1.0]."),
      depth: z.number().min(1).max(6).optional().describe("New zoom depth level (1 to 6)."),
    },
    async ({ projectPath, zoomId, startMs, endMs, focusX, focusY, depth }) => {
      try {
        const data = await loadProject(projectPath);
        const zooms = [...(data.editor.zoomRegions || [])];
        const target = zooms.find((z) => z.id === zoomId);

        if (!target) {
          throw new Error(`Zoom region with ID "${zoomId}" not found.`);
        }

        if (startMs !== undefined) target.startMs = Math.round(startMs);
        if (endMs !== undefined) target.endMs = Math.round(endMs);
        if (target.endMs <= target.startMs) {
          throw new Error(`endMs (${target.endMs}) must be greater than startMs (${target.startMs}).`);
        }

        if (focusX !== undefined) target.focus.cx = Math.max(0, Math.min(1, focusX));
        if (focusY !== undefined) target.focus.cy = Math.max(0, Math.min(1, focusY));
        if (depth !== undefined) target.depth = depth as ZoomDepth;

        zooms.sort((a, b) => a.startMs - b.startMs);
        data.editor.zoomRegions = zooms;
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Zoom region updated successfully.",
                  zoomRegion: target,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating zoom region: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 4. Delete Zoom Region
  server.tool(
    "recordly_delete_zoom_region",
    "Delete a single zoom region by ID, or clear all zoom regions if clearAll is true.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      zoomId: z.string().optional().describe("ID of the zoom region to delete."),
      clearAll: z.boolean().optional().default(false).describe("If true, removes all zoom regions from project."),
    },
    async ({ projectPath, zoomId, clearAll }) => {
      try {
        const data = await loadProject(projectPath);

        if (clearAll) {
          const removedCount = data.editor.zoomRegions?.length || 0;
          data.editor.zoomRegions = [];
          await saveProject(projectPath, data);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ message: `Cleared all ${removedCount} zoom regions.` }),
              },
            ],
          };
        }

        if (!zoomId) {
          throw new Error("Must provide either zoomId or clearAll: true.");
        }

        const initialCount = data.editor.zoomRegions?.length || 0;
        const filtered = (data.editor.zoomRegions || []).filter((z) => z.id !== zoomId);

        if (filtered.length === initialCount) {
          throw new Error(`Zoom region "${zoomId}" not found.`);
        }

        data.editor.zoomRegions = filtered;
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: `Zoom region "${zoomId}" deleted.`,
                remainingCount: filtered.length,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error deleting zoom region: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 5. Auto Suggest & Apply Zooms
  server.tool(
    "recordly_auto_suggest_zooms",
    "Analyze recorded mouse click telemetry (.cursor.json) to automatically detect clicks, group them into clusters, and generate/apply auto-zoom regions.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      applyToProject: z
        .boolean()
        .default(true)
        .describe("If true, automatically saves the generated zoom keyframes directly into the project."),
      replaceExisting: z
        .boolean()
        .default(false)
        .describe("If true, removes existing zoom regions before adding auto-zooms. If false, appends to existing."),
      mergeGapMs: z
        .number()
        .default(2500)
        .describe("Max time gap between consecutive clicks to merge into one zoom sequence (default 2500ms)."),
      depth: z
        .number()
        .min(1)
        .max(6)
        .default(2)
        .describe("Default zoom depth for suggested zooms (default 2 = 1.5x)."),
    },
    async ({ projectPath, applyToProject, replaceExisting, mergeGapMs, depth }) => {
      try {
        const data = await loadProject(projectPath);
        const telemetry = await loadCursorTelemetry(data.videoPath);

        if (telemetry.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "no-telemetry",
                    message: `No cursor telemetry found for video: ${data.videoPath}. Expected telemetry at: ${data.videoPath}.cursor.json`,
                    suggestions: [],
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const suggestions = generateAutoZoomsFromTelemetry(telemetry, {
          mergeGapMs,
          defaultDepth: depth as ZoomDepth,
        });

        if (applyToProject && suggestions.length > 0) {
          let updatedZooms = replaceExisting ? [] : [...(data.editor.zoomRegions || [])];
          updatedZooms = [...updatedZooms, ...suggestions].sort((a, b) => a.startMs - b.startMs);
          data.editor.zoomRegions = updatedZooms;
          await saveProject(projectPath, data);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: suggestions.length > 0 ? "success" : "no-clicks-found",
                  telemetrySamplesCount: telemetry.length,
                  suggestedZoomsCount: suggestions.length,
                  appliedToProject: applyToProject && suggestions.length > 0,
                  suggestions,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error generating auto-zooms: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
