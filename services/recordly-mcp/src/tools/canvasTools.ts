import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadProject, saveProject } from "../project/manager.js";
import type {
  AspectRatio,
  CursorClickEffectStyle,
  CursorStyle,
  WebcamPositionPreset,
} from "../types.js";

export function registerCanvasTools(server: McpServer) {
  // 1. Set Canvas Background
  server.tool(
    "recordly_set_canvas_background",
    "Configure background wallpaper, color, blur, or shadow for the video canvas.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      wallpaper: z
        .string()
        .optional()
        .describe("Wallpaper preset (e.g. 'mesh-gradient-1', 'aurora', 'obsidian', 'sunset', or a hex color '#0F172A')."),
      backgroundBlur: z.number().min(0).max(100).optional().describe("Background blur intensity (0 to 100)."),
      shadowIntensity: z.number().min(0).max(100).optional().describe("Drop shadow intensity under the captured screen (0 to 100)."),
    },
    async ({ projectPath, wallpaper, backgroundBlur, shadowIntensity }) => {
      try {
        const data = await loadProject(projectPath);

        if (wallpaper !== undefined) data.editor.wallpaper = wallpaper;
        if (backgroundBlur !== undefined) data.editor.backgroundBlur = backgroundBlur;
        if (shadowIntensity !== undefined) data.editor.shadowIntensity = shadowIntensity;

        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Canvas background settings updated.",
                  settings: {
                    wallpaper: data.editor.wallpaper,
                    backgroundBlur: data.editor.backgroundBlur,
                    shadowIntensity: data.editor.shadowIntensity,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error setting canvas background: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 2. Set Canvas Layout & Aspect Ratio
  server.tool(
    "recordly_set_canvas_layout",
    "Change canvas aspect ratio (16:9 widescreen, 9:16 vertical Shorts/TikTok, 1:1 square, 4:5 Instagram), border radius, and screen padding margins.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      aspectRatio: z
        .enum(["16:9", "9:16", "1:1", "4:5", "4:3", "21:9", "custom"])
        .optional()
        .describe("Target canvas aspect ratio."),
      padding: z
        .union([
          z.number().describe("Uniform padding on all four sides in pixels."),
          z.object({
            top: z.number(),
            right: z.number(),
            bottom: z.number(),
            left: z.number(),
          }),
        ])
        .optional()
        .describe("Padding margin between recorded screen and canvas border."),
      borderRadius: z.number().min(0).max(50).optional().describe("Corner roundness of recorded screen window."),
    },
    async ({ projectPath, aspectRatio, padding, borderRadius }) => {
      try {
        const data = await loadProject(projectPath);

        if (aspectRatio !== undefined) data.editor.aspectRatio = aspectRatio as AspectRatio;
        if (borderRadius !== undefined) data.editor.borderRadius = borderRadius;
        if (padding !== undefined) {
          if (typeof padding === "number") {
            data.editor.padding = { top: padding, right: padding, bottom: padding, left: padding };
          } else {
            data.editor.padding = padding;
          }
        }

        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Canvas layout updated.",
                  aspectRatio: data.editor.aspectRatio,
                  padding: data.editor.padding,
                  borderRadius: data.editor.borderRadius,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating canvas layout: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 3. Set Cursor Effects & Simulation
  server.tool(
    "recordly_set_cursor_effects",
    "Configure simulated cursor appearance: cursor style (macOS, Windows 11, Tahoe, Dot), size, smoothing, motion blur, and click ripple/spotlight effects.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      showCursor: z.boolean().optional().describe("Whether the virtual cursor is visible."),
      cursorStyle: z
        .enum(["macos", "windows11", "tahoe", "tahoe-inverted", "dot", "figma"])
        .optional()
        .describe("Visual asset pack for the cursor pointer."),
      cursorSize: z.number().min(0.2).max(4.0).optional().describe("Cursor scale multiplier (1.0 = normal, 1.5 = prominent)."),
      cursorSmoothing: z.number().min(0).max(1).optional().describe("Cursor trajectory smoothing amount (0 = raw, 1 = maximum smooth glide)."),
      clickEffect: z
        .enum(["none", "spotlight", "ripple", "echo"])
        .optional()
        .describe("Visual animation spawned when a mouse click occurs."),
      clickEffectColor: z.string().optional().describe("Hex color for the click animation (e.g. #2563EB, #EF4444)."),
      cursorMotionBlur: z.number().min(0).max(1).optional().describe("Motion blur trail behind fast cursor movements."),
      clickBounce: z.number().min(0).max(2).optional().describe("Micro-bounce animation intensity on click press."),
    },
    async ({
      projectPath,
      showCursor,
      cursorStyle,
      cursorSize,
      cursorSmoothing,
      clickEffect,
      clickEffectColor,
      cursorMotionBlur,
      clickBounce,
    }) => {
      try {
        const data = await loadProject(projectPath);

        if (showCursor !== undefined) data.editor.showCursor = showCursor;
        if (cursorStyle !== undefined) data.editor.cursorStyle = cursorStyle as CursorStyle;
        if (cursorSize !== undefined) data.editor.cursorSize = cursorSize;
        if (cursorSmoothing !== undefined) data.editor.cursorSmoothing = cursorSmoothing;
        if (clickEffect !== undefined) data.editor.cursorClickEffect = clickEffect as CursorClickEffectStyle;
        if (clickEffectColor !== undefined) data.editor.cursorClickEffectColor = clickEffectColor;
        if (cursorMotionBlur !== undefined) data.editor.cursorMotionBlur = cursorMotionBlur;
        if (clickBounce !== undefined) data.editor.cursorClickBounce = clickBounce;

        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Cursor visual effects updated.",
                  settings: {
                    showCursor: data.editor.showCursor,
                    cursorStyle: data.editor.cursorStyle,
                    cursorSize: data.editor.cursorSize,
                    cursorSmoothing: data.editor.cursorSmoothing,
                    cursorClickEffect: data.editor.cursorClickEffect,
                    cursorClickEffectColor: data.editor.cursorClickEffectColor,
                    cursorMotionBlur: data.editor.cursorMotionBlur,
                    cursorClickBounce: data.editor.cursorClickBounce,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating cursor effects: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 4. Set Webcam Overlay
  server.tool(
    "recordly_set_webcam_overlay",
    "Configure camera/webcam PIP overlay position, size, corner roundness, or mirror flip.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      enabled: z.boolean().optional().describe("Whether webcam overlay is shown."),
      positionPreset: z
        .enum([
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
          "top-center",
          "center-left",
          "center",
          "center-right",
          "bottom-center",
        ])
        .optional()
        .describe("Screen corner or position preset for the webcam box."),
      size: z.number().min(0.05).max(1.0).optional().describe("Size scale relative to screen width (e.g. 0.25)."),
      roundness: z.number().min(0).max(100).optional().describe("Corner roundness (0 = square, 100 = full circle/pill)."),
      mirror: z.boolean().optional().describe("Horizontally flip webcam video."),
    },
    async ({ projectPath, enabled, positionPreset, size, roundness, mirror }) => {
      try {
        const data = await loadProject(projectPath);
        if (!data.editor.webcam) {
          data.editor.webcam = {
            enabled: false,
            sourcePath: null,
            timeOffsetMs: 0,
            mirror: false,
            positionPreset: "bottom-right",
            size: 0.25,
            roundness: 100,
          };
        }

        if (enabled !== undefined) data.editor.webcam.enabled = enabled;
        if (positionPreset !== undefined) data.editor.webcam.positionPreset = positionPreset as WebcamPositionPreset;
        if (size !== undefined) data.editor.webcam.size = size;
        if (roundness !== undefined) data.editor.webcam.roundness = roundness;
        if (mirror !== undefined) data.editor.webcam.mirror = mirror;

        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Webcam overlay updated.",
                  webcam: data.editor.webcam,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating webcam overlay: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 5. Set Motion Blur
  server.tool(
    "recordly_set_motion_blur",
    "Configure cinematic motion blur for camera auto-zooms, camera transitions, and rapid cursor movements.",
    {
      projectPath: z.string().describe("Path to the .recordly project file."),
      zoomMotionBlur: z
        .number()
        .min(0)
        .max(2)
        .optional()
        .describe("Zoom transition motion blur intensity (0 = disabled, 0.35 = subtle, 0.5 = natural cinematic, 1.0 = prominent)."),
      cursorMotionBlur: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Cursor movement motion blur trail intensity (0.0 to 1.0)."),
      connectZooms: z
        .boolean()
        .optional()
        .describe("Whether consecutive zooms smoothly pan between focus points with motion blur."),
    },
    async ({ projectPath, zoomMotionBlur, cursorMotionBlur, connectZooms }) => {
      try {
        const data = await loadProject(projectPath);

        if (zoomMotionBlur !== undefined) data.editor.zoomMotionBlur = zoomMotionBlur;
        if (cursorMotionBlur !== undefined) data.editor.cursorMotionBlur = cursorMotionBlur;
        if (connectZooms !== undefined) data.editor.connectZooms = connectZooms;

        await saveProject(projectPath, data);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Motion blur settings updated successfully.",
                  settings: {
                    zoomMotionBlur: data.editor.zoomMotionBlur ?? 0.5,
                    cursorMotionBlur: data.editor.cursorMotionBlur ?? 0,
                    connectZooms: data.editor.connectZooms ?? true,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error updating motion blur: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
