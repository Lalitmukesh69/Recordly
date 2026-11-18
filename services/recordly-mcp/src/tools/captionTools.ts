import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadProject, saveProject } from "../project/manager.js";
import type { CaptionCue, AutoCaptionSettings } from "../types.js";
import { randomUUID } from "node:crypto";

export function registerCaptionTools(server: McpServer) {
  // 1. Get Captions
  server.tool(
    "recordly_get_captions",
    "Retrieve all subtitle and caption cues on the project timeline, along with current typography and positioning styling.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
    },
    async ({ projectPath }) => {
      try {
        const data = await loadProject(projectPath);
        const captions = data.editor.autoCaptions || [];
        const settings = data.editor.autoCaptionSettings || {};

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  projectPath,
                  count: captions.length,
                  settings: {
                    position: settings.position ?? "bottom-center",
                    style: settings.style ?? "highlight",
                    color: settings.color ?? "#FFFFFF",
                    fontFamily: settings.fontFamily ?? "Inter",
                    fontSize: settings.fontSize ?? 24,
                  },
                  captions: captions.map((c) => ({
                    id: c.id,
                    timeRange: `${(c.startMs / 1000).toFixed(2)}s - ${(c.endMs / 1000).toFixed(2)}s`,
                    startMs: c.startMs,
                    endMs: c.endMs,
                    text: c.text,
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
          content: [{ type: "text", text: `Error reading captions: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 2. Set Captions (Bulk import / replace)
  server.tool(
    "recordly_set_captions",
    "Replace or bulk-import the complete list of subtitle/caption cues for the video project.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      cues: z
        .array(
          z.object({
            id: z.string().optional().describe("Optional unique ID. Auto-generated if omitted."),
            text: z.string().describe("Subtitle text content."),
            startMs: z.number().describe("Start time in milliseconds."),
            endMs: z.number().describe("End time in milliseconds."),
          }),
        )
        .describe("List of subtitle cues to apply."),
    },
    async ({ projectPath, cues }) => {
      try {
        const data = await loadProject(projectPath);
        const formattedCues: CaptionCue[] = cues.map((c) => ({
          id: c.id || randomUUID(),
          text: c.text.trim(),
          startMs: Math.round(c.startMs),
          endMs: Math.round(c.endMs),
        }));

        formattedCues.sort((a, b) => a.startMs - b.startMs);
        data.editor.autoCaptions = formattedCues;
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Successfully set ${formattedCues.length} subtitle cues.`,
                  count: formattedCues.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error setting captions: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 3. Add Caption Cue
  server.tool(
    "recordly_add_caption_cue",
    "Add a single subtitle/caption cue to the project.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      text: z.string().describe("The text subtitle to display."),
      startMs: z.number().describe("Start time in milliseconds."),
      endMs: z.number().describe("End time in milliseconds."),
    },
    async ({ projectPath, text, startMs, endMs }) => {
      try {
        if (endMs <= startMs) {
          throw new Error(`endMs (${endMs}) must be greater than startMs (${startMs}).`);
        }

        const data = await loadProject(projectPath);
        const captions = [...(data.editor.autoCaptions || [])];

        const newCue: CaptionCue = {
          id: randomUUID(),
          text: text.trim(),
          startMs: Math.round(startMs),
          endMs: Math.round(endMs),
        };

        captions.push(newCue);
        captions.sort((a, b) => a.startMs - b.startMs);

        data.editor.autoCaptions = captions;
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Caption cue added.",
                  cue: newCue,
                  totalCaptionsCount: captions.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error adding caption cue: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 4. Update Caption Cue
  server.tool(
    "recordly_update_caption_cue",
    "Update the text or timing of an existing subtitle/caption cue.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      cueId: z.string().describe("ID of the caption cue to update."),
      text: z.string().optional().describe("New text content."),
      startMs: z.number().optional().describe("New start time in milliseconds."),
      endMs: z.number().optional().describe("New end time in milliseconds."),
    },
    async ({ projectPath, cueId, text, startMs, endMs }) => {
      try {
        const data = await loadProject(projectPath);
        const captions = [...(data.editor.autoCaptions || [])];
        const target = captions.find((c) => c.id === cueId);

        if (!target) {
          throw new Error(`Caption cue with ID "${cueId}" not found.`);
        }

        if (text !== undefined) target.text = text.trim();
        if (startMs !== undefined) target.startMs = Math.round(startMs);
        if (endMs !== undefined) target.endMs = Math.round(endMs);

        if (target.endMs <= target.startMs) {
          throw new Error(`endMs (${target.endMs}) must be greater than startMs (${target.startMs}).`);
        }

        captions.sort((a, b) => a.startMs - b.startMs);
        data.editor.autoCaptions = captions;
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Caption cue updated.",
                  cue: target,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating caption cue: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 5. Delete Caption Cue
  server.tool(
    "recordly_delete_caption_cue",
    "Delete a single caption cue by ID, or clear all captions if clearAll is true.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      cueId: z.string().optional().describe("ID of the caption cue to delete."),
      clearAll: z.boolean().optional().default(false).describe("If true, removes all caption cues."),
    },
    async ({ projectPath, cueId, clearAll }) => {
      try {
        const data = await loadProject(projectPath);

        if (clearAll) {
          const count = data.editor.autoCaptions?.length || 0;
          data.editor.autoCaptions = [];
          await saveProject(projectPath, data);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ message: `Cleared all ${count} captions.` }),
              },
            ],
          };
        }

        if (!cueId) {
          throw new Error("Must provide cueId or clearAll: true.");
        }

        const initial = data.editor.autoCaptions?.length || 0;
        const filtered = (data.editor.autoCaptions || []).filter((c) => c.id !== cueId);

        if (filtered.length === initial) {
          throw new Error(`Caption cue "${cueId}" not found.`);
        }

        data.editor.autoCaptions = filtered;
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: `Caption cue "${cueId}" deleted.`,
                remainingCount: filtered.length,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error deleting caption cue: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 6. Set Caption Style
  server.tool(
    "recordly_set_caption_style",
    "Configure subtitle visual styling: font family, font size, text color, position, and animation style.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      position: z
        .enum(["bottom-center", "top-center", "center"])
        .optional()
        .describe("On-screen vertical alignment."),
      style: z
        .enum(["classic", "highlight", "karaoke", "minimal"])
        .optional()
        .describe("Subtitle animation and badge style."),
      color: z.string().optional().describe("Primary text color in HEX (e.g. #FFFFFF, #FACC15)."),
      fontFamily: z.string().optional().describe("Font family (e.g. Inter, Roboto, Helvetica)."),
      fontSize: z.number().optional().describe("Base font size (default 24)."),
    },
    async ({ projectPath, position, style, color, fontFamily, fontSize }) => {
      try {
        const data = await loadProject(projectPath);
        const current: AutoCaptionSettings = data.editor.autoCaptionSettings || {};

        if (position !== undefined) current.position = position;
        if (style !== undefined) current.style = style;
        if (color !== undefined) current.color = color;
        if (fontFamily !== undefined) current.fontFamily = fontFamily;
        if (fontSize !== undefined) current.fontSize = fontSize;

        data.editor.autoCaptionSettings = current;
        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Caption styles updated.",
                  settings: current,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating caption style: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
