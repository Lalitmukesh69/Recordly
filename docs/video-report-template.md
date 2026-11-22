# Recordly Video Analysis & Edit Report Template

Use this template to provide a structured editing report for any raw screen recording or demo video. When you submit this report, the AI assistant can apply all cuts, click auto-zooms, cinematic motion blur, cursor spotlight effects, and canvas styling in a single instant operation.

---

## 📋 1. Project Information

- **Project File:** `/home/lalitmukesh/.config/Recordly/recordings/Projects/linux rice demo today.recordly`
- **Raw Video:** `/home/lalitmukesh/.config/Recordly/recordings/recording-1795091474316.webm`
- **Target Output:** 1080p Widescreen (16:9)

---

## ✂️ 2. Cuts & Exclusions (Segments to Remove)

List all dead air, mistakes, sensitive personal information, or recorder UI interactions to cut out of the final video:

| # | Time Range (Source) | Duration | What to Remove / Reason |
| :-: | :--- | :-: | :--- |
| **1** | `00:09.70` – `00:29.80` (9700ms – 29800ms) | ~20.1s | Hardware specs (AMD Ryzen 3), personal username, local IP, private browser tabs |
| **2** | `00:46.00` – `00:50.34` (46000ms – 50335ms) | ~4.3s | Floating recorder bar HUD popup and "Stop Recording" button click |

---

## 🔍 3. Mouse Clicks & Auto-Zoom Targets

List key interactions where the camera should smoothly zoom in on the action. Coordinates can be normalized `0.0 - 1.0` or raw pixel coordinates `(X, Y)`:

| # | Timestamp | Normalized (X, Y) | Target Element | Zoom Depth |
| :-: | :--- | :--- | :--- | :-: |
| **1** | `00:02.70` (2700ms) | `(0.03, 0.03)` | Top-panel wallpaper switcher icon | 2 (1.5x) |
| **2** | `00:04.10` (4100ms) | `(0.34, 0.52)` | Wallpaper picker item `misty.jpg` | 2 (1.5x) |
| **3** | `00:06.50` (6500ms) | `(0.03, 0.03)` | Top-panel wallpaper switcher icon (reopen) | 2 (1.5x) |
| **4** | `00:07.70` (7700ms) | `(0.80, 0.54)` | Wallpaper picker item `peaks.jpg` | 2 (1.5x) |
| **5** | `00:34.15` (34150ms) | `(0.48, 0.18)` | Noctalia app launcher "Providers" tab | 2 (1.5x) |

> **Zoom Depths:** `1` = 1.25x (subtle), `2` = 1.5x (standard/recommended), `3` = 1.8x, `4` = 2.2x (prominent), `5` = 2.8x, `6` = 3.5x.

---

## 🎨 4. Effects, Motion Blur & Canvas Styling

- **Motion Blur:**
  - `zoomMotionBlur`: `0.5` *(Cinematic camera glide during zoom transitions)*
  - `cursorMotionBlur`: `0.6` *(Smooth cursor trailing)*
  - `connectZooms`: `true` *(Consecutive zooms pan smoothly into each other)*
- **Cursor Effects:**
  - `showCursor`: `true`
  - `cursorStyle`: `"windows11"` *(or `"macos"`, `"tahoe"`, `"dot"`)*
  - `cursorSize`: `2.5`
  - `clickEffect`: `"spotlight"` *(or `"ripple"`, `"echo"`)*
  - `clickEffectColor`: `"#2563EB"` *(Recordly Blue)*
- **Canvas Framing:**
  - `wallpaper`: `"/wallpapers/wallpaper10.jpg"` *(or `"aurora"`, `"mesh-gradient-1"`)*
  - `backgroundBlur`: `5` *(0–8 px)*
  - `shadowIntensity`: `38` *(0–100%)*
  - `borderRadius`: `3.7` *(rounded window corners)*
  - `aspectRatio`: `"16:9"` *(or `"9:16"` for Shorts/TikTok)*

---

## ⚡ 5. Ready-to-Execute JSON Payload (Optional)

You can also directly provide this JSON snippet to the AI agent to execute `recordly_apply_video_report` in under 100ms:

```json
{
  "projectPath": "/home/lalitmukesh/.config/Recordly/recordings/Projects/linux rice demo today.recordly",
  "cuts": [
    {
      "startMs": 9700,
      "endMs": 29800,
      "reason": "Laptop specs, real name, local IP, browser tabs, recorder interaction"
    },
    {
      "startMs": 46000,
      "endMs": 50335,
      "reason": "Recorder HUD popup and stop button click"
    }
  ],
  "clicks": [
    { "timestampMs": 2700, "x": 0.03, "y": 0.03, "label": "Wallpaper switcher icon", "depth": 2 },
    { "timestampMs": 4100, "x": 0.34, "y": 0.52, "label": "misty.jpg selection", "depth": 2 },
    { "timestampMs": 6500, "x": 0.03, "y": 0.03, "label": "Wallpaper switcher icon", "depth": 2 },
    { "timestampMs": 7700, "x": 0.80, "y": 0.54, "label": "peaks.jpg selection", "depth": 2 },
    { "timestampMs": 34150, "x": 0.48, "y": 0.18, "label": "Noctalia launcher Providers tab", "depth": 2 }
  ],
  "motionBlur": {
    "zoomMotionBlur": 0.5,
    "cursorMotionBlur": 0.6,
    "connectZooms": true
  },
  "cursorEffect": {
    "showCursor": true,
    "cursorStyle": "windows11",
    "cursorSize": 2.5,
    "clickEffect": "spotlight",
    "clickEffectColor": "#2563EB"
  },
  "canvas": {
    "wallpaper": "/wallpapers/wallpaper10.jpg",
    "backgroundBlur": 5,
    "shadowIntensity": 38,
    "borderRadius": 3.7,
    "aspectRatio": "16:9"
  }
}
```
