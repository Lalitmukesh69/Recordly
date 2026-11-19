import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadProject, saveProject } from "../project/manager.js";
import type { ClipRegion } from "../types.js";
import { randomUUID } from "node:crypto";

function recalculateTimelinePositions(clips: ClipRegion[]): ClipRegion[] {
  let currentTimelineMs = 0;
  return clips.map((clip) => {
    const durationMs = Math.max(0, clip.endMs - clip.startMs);
    const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
    const effectiveDurationMs = Math.round(durationMs / speed);
    const sourceStartMs = clip.sourceStartMs ?? clip.startMs;
    const updated: ClipRegion = {
      ...clip,
      sourceStartMs,
      startMs: currentTimelineMs,
      endMs: currentTimelineMs + durationMs,
      timelineStartMs: currentTimelineMs,
      speed,
      muted: clip.muted ?? false,
      showSourceAudio: clip.showSourceAudio ?? false,
    };
    currentTimelineMs += effectiveDurationMs;
    return updated;
  });
}

export function registerTimelineTools(server: McpServer) {
  // 1. Get Timeline
  server.tool(
    "recordly_get_timeline",
    "Inspect the timeline layout: active video clips, split points, trims, speeds, and total timeline duration.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
    },
    async ({ projectPath }) => {
      try {
        const data = await loadProject(projectPath);
        const clips = data.editor.clipRegions || [];
        const trims = data.editor.trimRegions || [];
        const speeds = data.editor.speedRegions || [];

        let totalDurationMs = 0;
        const formattedClips = clips.map((c, index) => {
          const duration = Math.max(0, c.endMs - c.startMs);
          const speed = c.speed || 1;
          const timelineDuration = Math.round(duration / speed);
          totalDurationMs += timelineDuration;
          return {
            index,
            id: c.id,
            sourceRange: `${(c.startMs / 1000).toFixed(2)}s - ${(c.endMs / 1000).toFixed(2)}s`,
            sourceDurationSec: (duration / 1000).toFixed(2),
            timelineStartSec: (((c.timelineStartMs ?? c.startMs)) / 1000).toFixed(2),
            speed,
            volume: c.volume ?? 1,
            muted: c.muted ?? false,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  projectPath,
                  totalTimelineDurationSec: (totalDurationMs / 1000).toFixed(2),
                  totalTimelineDurationMs: totalDurationMs,
                  clipsCount: clips.length,
                  clips: formattedClips,
                  trimRegionsCount: trims.length,
                  trimRegions: trims,
                  speedRegions: speeds,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error reading timeline: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 2. Split Clip
  server.tool(
    "recordly_split_clip",
    "Split a video clip at a specific timestamp in milliseconds, creating two adjoining clips.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      clipId: z.string().describe("ID of the clip to split. If omitted, finds the clip containing timestampMs."),
      splitTimestampMs: z
        .number()
        .describe("Millisecond mark within the clip's source time where the cut should happen."),
    },
    async ({ projectPath, clipId, splitTimestampMs }) => {
      try {
        const data = await loadProject(projectPath);
        const clips = [...(data.editor.clipRegions || [])];
        const clipIndex = clips.findIndex((c) => c.id === clipId);

        if (clipIndex === -1) {
          throw new Error(`Clip with ID "${clipId}" not found in project.`);
        }

        const target = clips[clipIndex];
        if (splitTimestampMs <= target.startMs || splitTimestampMs >= target.endMs) {
          throw new Error(
            `Split mark ${splitTimestampMs}ms must be strictly between clip start (${target.startMs}ms) and end (${target.endMs}ms).`,
          );
        }

        const firstClip: ClipRegion = {
          ...target,
          id: randomUUID(),
          endMs: splitTimestampMs,
        };

        const secondClip: ClipRegion = {
          ...target,
          id: randomUUID(),
          startMs: splitTimestampMs,
        };

        clips.splice(clipIndex, 1, firstClip, secondClip);
        data.editor.clipRegions = recalculateTimelinePositions(clips);

        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Clip split successfully at ${splitTimestampMs}ms.`,
                  originalClipId: clipId,
                  newFirstClip: firstClip,
                  newSecondClip: secondClip,
                  totalClipsCount: data.editor.clipRegions.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error splitting clip: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 3. Trim Clip
  server.tool(
    "recordly_trim_clip",
    "Trim the start or end of a specific clip to remove unwanted footage or pauses.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      clipId: z.string().describe("ID of the clip to trim."),
      newStartMs: z.number().optional().describe("New source start time in milliseconds."),
      newEndMs: z.number().optional().describe("New source end time in milliseconds."),
    },
    async ({ projectPath, clipId, newStartMs, newEndMs }) => {
      try {
        const data = await loadProject(projectPath);
        const clips = [...(data.editor.clipRegions || [])];
        const target = clips.find((c) => c.id === clipId);

        if (!target) {
          throw new Error(`Clip with ID "${clipId}" not found.`);
        }

        if (newStartMs !== undefined) target.startMs = newStartMs;
        if (newEndMs !== undefined) target.endMs = newEndMs;

        if (target.endMs <= target.startMs) {
          throw new Error(`End time (${target.endMs}ms) must be greater than start time (${target.startMs}ms).`);
        }

        data.editor.clipRegions = recalculateTimelinePositions(clips);
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Clip trimmed successfully.",
                  clip: target,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error trimming clip: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 4. Delete Clip
  server.tool(
    "recordly_delete_clip",
    "Remove a clip from the timeline.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      clipId: z.string().describe("ID of the clip to remove."),
    },
    async ({ projectPath, clipId }) => {
      try {
        const data = await loadProject(projectPath);
        const initialCount = data.editor.clipRegions?.length || 0;
        const filtered = (data.editor.clipRegions || []).filter((c) => c.id !== clipId);

        if (filtered.length === initialCount) {
          throw new Error(`Clip "${clipId}" was not found.`);
        }

        data.editor.clipRegions = recalculateTimelinePositions(filtered);
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Clip "${clipId}" deleted.`,
                  remainingClipsCount: data.editor.clipRegions.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error deleting clip: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 5. Reorder Clips
  server.tool(
    "recordly_reorder_clips",
    "Reorder clips on the timeline by providing the array of clip IDs in the new sequence.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      orderedClipIds: z.array(z.string()).describe("List of all clip IDs in the desired playback order."),
    },
    async ({ projectPath, orderedClipIds }) => {
      try {
        const data = await loadProject(projectPath);
        const clips = [...(data.editor.clipRegions || [])];
        const clipMap = new Map(clips.map((c) => [c.id, c]));

        const reordered: ClipRegion[] = [];
        for (const id of orderedClipIds) {
          const found = clipMap.get(id);
          if (!found) throw new Error(`Clip ID "${id}" does not exist in project.`);
          reordered.push(found);
          clipMap.delete(id);
        }

        // Append any omitted clips at the end
        for (const remaining of clipMap.values()) {
          reordered.push(remaining);
        }

        data.editor.clipRegions = recalculateTimelinePositions(reordered);
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Clips reordered successfully.",
                  sequence: data.editor.clipRegions.map((c) => ({
                    id: c.id,
                    timelineStartSec: (((c.timelineStartMs ?? c.startMs)) / 1000).toFixed(2),
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
          content: [{ type: "text", text: `Error reordering clips: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 6. Set Clip Speed & Volume
  server.tool(
    "recordly_set_clip_properties",
    "Set playback speed multiplier (e.g. 1.25x, 1.5x, 2.0x), volume (0.0 to 1.0), or mute status on a clip.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      clipId: z.string().describe("Target clip ID."),
      speed: z.number().optional().describe("Speed multiplier (e.g. 1.0, 1.5, 2.0)."),
      volume: z.number().optional().describe("Volume level from 0.0 (silent) to 1.0 (full)."),
      muted: z.boolean().optional().describe("Whether clip audio is muted."),
    },
    async ({ projectPath, clipId, speed, volume, muted }) => {
      try {
        const data = await loadProject(projectPath);
        const clips = [...(data.editor.clipRegions || [])];
        const target = clips.find((c) => c.id === clipId);

        if (!target) throw new Error(`Clip "${clipId}" not found.`);

        if (speed !== undefined) target.speed = Math.max(0.25, Math.min(10, speed));
        if (volume !== undefined) target.volume = Math.max(0, Math.min(1, volume));
        if (muted !== undefined) target.muted = muted;

        data.editor.clipRegions = recalculateTimelinePositions(clips);
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Clip properties updated.",
                  clip: target,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating clip properties: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 7. Cut Range (Remove unwanted footage)
  server.tool(
    "recordly_cut_range",
    "Cut and remove a specific time segment from the video (e.g. sensitive data, mistakes, pauses, or recorder HUD interactions). Slices clips, adjusts timeline offsets, and records the trim gap.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      startMs: z.number().describe("Source start time in milliseconds where the cut begins."),
      endMs: z.number().describe("Source end time in milliseconds where the cut ends."),
      reason: z.string().optional().describe("Optional note for what was removed."),
    },
    async ({ projectPath, startMs, endMs, reason }) => {
      try {
        if (endMs <= startMs) {
          throw new Error(`endMs (${endMs}) must be strictly greater than startMs (${startMs}).`);
        }

        const data = await loadProject(projectPath);
        let clips = [...(data.editor.clipRegions || [])];

        // If no clips yet, initialize one full-length clip from 0 to endMs
        if (clips.length === 0) {
          clips = [
            {
              id: "clip-1",
              startMs: 0,
              endMs: Math.max(endMs + 10000, 60000),
              sourceStartMs: 0,
              speed: 1,
            },
          ];
        }

        const nextClips: ClipRegion[] = [];
        for (const clip of clips) {
          const clipSrcStart = clip.sourceStartMs ?? clip.startMs;
          const clipDuration = clip.endMs - clip.startMs;
          const clipSrcEnd = clipSrcStart + clipDuration;

          // Case 1: Cut is completely before or after this clip
          if (endMs <= clipSrcStart || startMs >= clipSrcEnd) {
            nextClips.push(clip);
            continue;
          }

          // Case 2: Cut completely encompasses this clip -> omit
          if (startMs <= clipSrcStart && endMs >= clipSrcEnd) {
            continue;
          }

          // Case 3: Cut splits this clip into two pieces
          if (startMs > clipSrcStart && endMs < clipSrcEnd) {
            const firstDuration = startMs - clipSrcStart;
            const secondDuration = clipSrcEnd - endMs;

            nextClips.push({
              ...clip,
              id: randomUUID(),
              startMs: clip.startMs,
              endMs: clip.startMs + firstDuration,
              sourceStartMs: clipSrcStart,
            });

            nextClips.push({
              ...clip,
              id: randomUUID(),
              startMs: clip.startMs + firstDuration,
              endMs: clip.startMs + firstDuration + secondDuration,
              sourceStartMs: endMs,
            });
            continue;
          }

          // Case 4: Cut overlaps start of clip
          if (startMs <= clipSrcStart && endMs < clipSrcEnd) {
            const remainingDuration = clipSrcEnd - endMs;
            nextClips.push({
              ...clip,
              sourceStartMs: endMs,
              endMs: clip.startMs + remainingDuration,
            });
            continue;
          }

          // Case 5: Cut overlaps end of clip
          if (startMs > clipSrcStart && endMs >= clipSrcEnd) {
            const remainingDuration = startMs - clipSrcStart;
            nextClips.push({
              ...clip,
              endMs: clip.startMs + remainingDuration,
            });
            continue;
          }
        }

        data.editor.clipRegions = recalculateTimelinePositions(nextClips);

        // Update trimRegions
        const existingTrims = [...(data.editor.trimRegions || [])];
        existingTrims.push({
          id: `trim-gap-${randomUUID().slice(0, 8)}`,
          startMs: Math.round(startMs),
          endMs: Math.round(endMs),
        });
        existingTrims.sort((a, b) => a.startMs - b.startMs);
        data.editor.trimRegions = existingTrims;

        // Ripple zoom regions: drop zooms in the cut, adjust zooms after the cut
        const cutDuration = endMs - startMs;
        const currentZooms = [...(data.editor.zoomRegions || [])];
        data.editor.zoomRegions = currentZooms
          .filter((z) => !(z.startMs >= startMs && z.endMs <= endMs))
          .map((z) => (z.startMs >= endMs ? { ...z, startMs: z.startMs - cutDuration, endMs: z.endMs - cutDuration } : z));

        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Cut applied successfully from ${startMs}ms to ${endMs}ms.`,
                  reason,
                  remainingClipsCount: data.editor.clipRegions.length,
                  totalTimelineDurationSec: (
                    (data.editor.clipRegions[data.editor.clipRegions.length - 1]?.endMs ?? 0) / 1000
                  ).toFixed(2),
                  clips: data.editor.clipRegions.map((c) => ({
                    id: c.id,
                    timelineRange: `${(c.startMs / 1000).toFixed(2)}s - ${(c.endMs / 1000).toFixed(2)}s`,
                    sourceRange: `${((c.sourceStartMs ?? 0) / 1000).toFixed(2)}s - ${(((c.sourceStartMs ?? 0) + (c.endMs - c.startMs)) / 1000).toFixed(2)}s`,
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
          content: [{ type: "text", text: `Error applying cut range: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
