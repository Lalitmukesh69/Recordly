import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  listProjects,
  loadProject,
  saveProject,
  createProject,
  getDefaultProjectsDir,
  getDefaultRecordingsDir,
} from "../project/manager.js";

export function registerProjectTools(server: McpServer) {
  // 1. List Projects
  server.tool(
    "recordly_list_projects",
    "List Recordly video editing projects (.recordly files) in library directories or a specified directory.",
    {
      searchDir: z
        .string()
        .optional()
        .describe("Optional directory path to search for .recordly projects. Defaults to Recordly projects & recordings folders."),
    },
    async ({ searchDir }) => {
      try {
        const projects = await listProjects(searchDir);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  count: projects.length,
                  searchLocations: [
                    searchDir || "Default library directories",
                    getDefaultProjectsDir(),
                    getDefaultRecordingsDir(),
                  ],
                  projects,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error listing projects: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 2. Load Project
  server.tool(
    "recordly_load_project",
    "Load and inspect a Recordly project (.recordly file) to see its full state, clips, zoom keyframes, captions, and canvas settings.",
    {
      projectPath: z.string().describe("Absolute or relative path to the .recordly project file."),
    },
    async ({ projectPath }) => {
      try {
        const data = await loadProject(projectPath);
        const editor = data.editor || {};
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  filePath: projectPath,
                  version: data.version,
                  projectId: data.projectId,
                  videoPath: data.videoPath,
                  summary: {
                    aspectRatio: editor.aspectRatio ?? "16:9",
                    zoomRegionsCount: editor.zoomRegions?.length ?? 0,
                    clipsCount: editor.clipRegions?.length ?? 0,
                    trimRegionsCount: editor.trimRegions?.length ?? 0,
                    captionsCount: editor.autoCaptions?.length ?? 0,
                    wallpaper: editor.wallpaper ?? "mesh-gradient-1",
                    showCursor: editor.showCursor ?? true,
                    cursorStyle: editor.cursorStyle ?? "macos",
                    webcamEnabled: editor.webcam?.enabled ?? false,
                  },
                  fullState: data,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error loading project: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 3. Create Project
  server.tool(
    "recordly_create_project",
    "Create a new Recordly project (.recordly file) pointing to a recorded or imported video.",
    {
      videoPath: z.string().describe("Path to the source video file (.mp4, .webm, .mov)."),
      projectName: z.string().optional().describe("Optional custom project name. Defaults to video filename."),
      targetDir: z.string().optional().describe("Optional target directory to save the .recordly file. Defaults to projects directory."),
    },
    async ({ videoPath, projectName, targetDir }) => {
      try {
        const result = await createProject({ videoPath, projectName, targetDir });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Project successfully created.",
                  filePath: result.filePath,
                  projectId: result.projectData.projectId,
                  videoPath: result.projectData.videoPath,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error creating project: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );

  // 4. Save Project
  server.tool(
    "recordly_save_project",
    "Atomically save project state to a .recordly project file (with automatic backup).",
    {
      projectPath: z.string().describe("Target .recordly project file path."),
      projectData: z.any().describe("Full EditorProjectData object to save."),
    },
    async ({ projectPath, projectData }) => {
      try {
        const result = await saveProject(projectPath, projectData);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Project saved successfully.",
                  filePath: result.filePath,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error saving project: ${String(error)}` }],
          isError: true,
        };
      }
    },
  );
}
