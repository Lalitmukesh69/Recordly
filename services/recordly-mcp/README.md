# Recordly Editor MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that equips AI agents (Claude Desktop, Cursor, Antigravity, Cline, Windsurf) with comprehensive video editing capabilities for **Recordly** projects.

With this MCP server, an AI agent can:
- **Inspect projects**: read timeline duration, active clips, zoom keyframes, subtitles, and canvas settings.
- **Auto-Zoom**: analyze mouse telemetry (`.cursor.json`) to cluster click points and automatically generate zoom keyframes.
- **Trim & Cut**: split clips at exact timestamps, trim dead air, reorder clips, or adjust playback speed (e.g., 1.5x for repetitive screens).
- **Subtitles & Captions**: add, edit, format, or bulk-import synchronized subtitles.
- **Canvas & Framing**: reformat aspect ratios (16:9 widescreen $\to$ 9:16 vertical TikTok/Reels/Shorts, 1:1, etc.), add padding, adjust border radiuses, and change wallpaper backgrounds.
- **Simulated Cursor**: customize cursor style (macOS, Windows 11, Tahoe, Dot), size, smoothing, motion blur, and click ripple/spotlight animations.

---

## Installation & Build

From the Recordly repository root:

```bash
cd services/recordly-mcp
npm install
npm run build
```

The compiled binary will be placed at `services/recordly-mcp/dist/index.js`.

---

## Configuration

### 1. Claude Desktop

Add the server to your `claude_desktop_config.json`:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "recordly-editor": {
      "command": "node",
      "args": [
        "/home/lalitmukesh/Downloads/Recordly/services/recordly-mcp/dist/index.js"
      ]
    }
  }
}
```

### 2. Cursor IDE

Add to `.cursor/mcp.json` or Global Cursor Settings:

```json
{
  "mcpServers": {
    "recordly-editor": {
      "command": "node",
      "args": [
        "/home/lalitmukesh/Downloads/Recordly/services/recordly-mcp/dist/index.js"
      ]
    }
  }
}
```

### 3. Antigravity / Gemini

Add to your MCP settings or run directly via `stdio`:

```json
{
  "command": "node",
  "args": ["/home/lalitmukesh/Downloads/Recordly/services/recordly-mcp/dist/index.js"]
}
```

---

## Available Tools

### 📁 Project Management
* `recordly_list_projects`: Discover `.recordly` files across the library and custom directories.
* `recordly_load_project`: Read and summarize a project's full state.
* `recordly_create_project`: Initialize a new `.recordly` project pointing to a video file.
* `recordly_save_project`: Atomically write changes to a project with automatic backup.

### ✂️ Timeline & Clip Editing
* `recordly_get_timeline`: Inspect clips, splits, trims, speeds, and total timeline duration.
* `recordly_split_clip`: Split a video clip at any millisecond timestamp $t$ into two adjoining clips.
* `recordly_trim_clip`: Trim start and end times of a clip.
* `recordly_delete_clip`: Remove a clip and automatically recalibrate the timeline sequence.
* `recordly_reorder_clips`: Move clips into a new sequence order.
* `recordly_set_clip_properties`: Apply speed multipliers (e.g. 1.25x, 1.5x, 2.0x), volume, or mute.

### 🔍 Zoom & Camera
* `recordly_list_zoom_regions`: Inspect existing zoom keyframes and focus points.
* `recordly_add_zoom_region`: Add a zoom region with start/end time, depth (1-6), normalized focus coordinates `(cx, cy)`, and mode.
* `recordly_update_zoom_region`: Modify focus point, zoom level, or duration of an existing zoom.
* `recordly_delete_zoom_region`: Delete a single zoom region or clear all zooms.
* `recordly_auto_suggest_zooms`: Analyze cursor click telemetry (`.cursor.json`), cluster clicks, and automatically generate/apply auto-zoom regions.

### 💬 Captions & Subtitles
* `recordly_get_captions`: Retrieve all subtitle cues and visual styling.
* `recordly_set_captions`: Bulk-import or replace all subtitles.
* `recordly_add_caption_cue`: Add a single subtitle cue.
* `recordly_update_caption_cue`: Edit subtitle text or timestamps.
* `recordly_delete_caption_cue`: Remove a subtitle cue.
* `recordly_set_caption_style`: Configure font family, font size, text color, position, and badge animation.

### 🎨 Canvas & Styling
* `recordly_set_canvas_background`: Set wallpaper preset, solid color, gradient, or blur level.
* `recordly_set_canvas_layout`: Change aspect ratio (`16:9`, `9:16`, `1:1`, `4:5`, etc.), padding margins, and corner border radius.
* `recordly_set_cursor_effects`: Configure simulated cursor style (`macos`, `windows11`, `tahoe`, `dot`), size, motion blur, and click ripple/spotlight animations.
* `recordly_set_webcam_overlay`: Position, scale, roundness, and mirror webcam footage.

### 🔎 Analysis & Probes
* `recordly_probe_video`: Get video resolution, duration, framerate, and audio tracks.
* `recordly_get_cursor_telemetry`: Inspect recorded mouse telemetry coordinates and click timestamps.

---

## Example Prompts for AI Agents

Once connected, you can instruct your AI assistant naturally:

* *"Find the latest recording in Recordly, auto-detect mouse clicks, and apply auto-zoom to all interactions."*
* *"Reformat my project to 9:16 vertical aspect ratio for TikTok, increase the padding to 48px, and use the 'aurora' gradient wallpaper."*
* *"Cut out the silent pause between 00:15 and 00:23 on the timeline."*
* *"Speed up clip #2 by 1.75x and mute its audio."*
* *"Add modern bold yellow captions at the bottom-center with highlight animation."*
* *"Make the mouse cursor 1.4x larger and enable the blue spotlight click ripple."*
