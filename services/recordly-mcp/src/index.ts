#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerProjectTools } from "./tools/projectTools.js";
import { registerTimelineTools } from "./tools/timelineTools.js";
import { registerZoomTools } from "./tools/zoomTools.js";
import { registerCaptionTools } from "./tools/captionTools.js";
import { registerCanvasTools } from "./tools/canvasTools.js";
import { registerProbeTools } from "./tools/probeTools.js";

async function main() {
  const server = new McpServer(
    {
      name: "recordly-editor",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register all editing capabilities
  registerProjectTools(server);
  registerTimelineTools(server);
  registerZoomTools(server);
  registerCaptionTools(server);
  registerCanvasTools(server);
  registerProbeTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[Recordly MCP] Server started successfully on stdio.");
}

main().catch((error) => {
  console.error("[Recordly MCP] Fatal server error:", error);
  process.exit(1);
});
