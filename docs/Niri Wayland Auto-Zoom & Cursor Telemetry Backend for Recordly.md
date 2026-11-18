
1. Overview & Problem Statement

Recordly generates automatic zoom keyframes and smooth cursor animations by recording real-time cursor coordinates and mouse click events alongside screen capture. On the Niri Wayland compositor, Wayland's security architecture isolates windows and prevents unprivileged background apps from reading global pointer coordinates or mouse clicks via X11 APIs (XQueryPointer / uiohook). As a result, users recording on Niri get video without auto-zoom keyframes.

2. Goals & Non-Goals


Goals

• Enable reliable mouse click detection (left, right, middle) across both native Wayland and XWayland windows on Niri.
• Track normalized cursor coordinates (0.0 to 1.0) mapped accurately to the active Niri output's logical geometry and fractional scale.
• Output telemetry directly into Recordly's existing JSON project schema without breaking X11, macOS, Windows, or Hyprland backends.
• Provide clear user feedback if required Linux permissions (input group access) are missing.

Non-Goals

• Hiding the native OS hardware cursor inside the PipeWire video stream (handled upstream by XDG Desktop Portal / PipeWire settings).
• Modifying Recordly's React/PixiJS timeline UI or MP4/GIF video export pipeline.
• Supporting non-Niri Wayland compositors in this specific adapter (though the libinput layer can be reused).

3. User Stories

• As a Niri user, I want Recordly to automatically zoom in where I click during a screen recording so I don't have to manually keyframe every zoom in the timeline editor.
• As a Linux user without input group permissions, I want Recordly to show a clear setup prompt explaining how to grant permission (usermod -aG input $USER) rather than silently failing to generate auto-zooms.
• As a multi-monitor or HiDPI Niri user, I want zoom targets to land accurately on the clicked UI element regardless of display scaling (e.g., 1.25x, 1.5x, 2.0x).

4. Functional Requirements


ID	Requirement	Priority
FR-1	Compositor Detection: Automatically detect an active Niri session at runtime via $NIRI_SOCKET or $XDG_CURRENT_DESKTOP=niri.	Must Have
FR-2	Output Geometry Resolution: Query Niri IPC (niri msg -j outputs or $NIRI_SOCKET JSON request) at recording start to retrieve logical width, height, x/y offset, and scale factor.	Must Have
FR-3	Click Event Capture: Capture global POINTER_BUTTON press/release events (BTN_LEFT, BTN_RIGHT) with millisecond timestamps synchronized to recording t=0.	Must Have
FR-4	Coordinate Tracking & Clamping: Accumulate libinput accelerated pointer deltas (dx, dy), clamp coordinates to Niri's logical output boundaries, and normalize to [0.0, 1.0].	Must Have
FR-5	Calibration / Drift Mitigation: Anchor initial cursor position at recording start (via a brief transparent click/hover sync or screen center default) and clamp against screen edges to prevent off-screen drift.	Should Have
FR-6	Permission Pre-check: Verify read access to /dev/input/event* or libinput before starting capture; surface a non-blocking UI warning if permission is denied.	Must Have


5. Technical Architecture & Data Flow

1. Trigger: User clicks "Start Recording" in Recordly Electron UI.
2. Environment Check: Electron Main Process checks process.env.NIRI_SOCKET. If present, initializes NiriCursorTracker instead of the default X11 tracker.
3. Geometry Fetch: NiriCursorTracker queries $NIRI_SOCKET for "Outputs" to map the selected PipeWire display's logical bounds (minX, minY, width, height).
4. Input Stream: Spawns libinput debug-events (or a lightweight Rust/Node evdev worker) as a child process, parsing POINTER_MOTION, POINTER_MOTION_ABSOLUTE (for tablets/VMs), and POINTER_BUTTON lines from stdout.
5. Telemetry Ingestion: Downsamples motion events to 60 Hz, preserves 100% of click events, normalizes (x, y) against logical output bounds, and appends entries to Recordly's .recordly project telemetry array.
6. Teardown: On "Stop Recording", cleanly kills the child process (SIGTERM) and flushes buffered telemetry to disk.

6. Acceptance Criteria & Success Metrics

• Click Capture Rate: 100% of left/right clicks inside native Wayland apps (e.g., Foot, Alacritty, Firefox Wayland) generate auto-zoom keyframes.
• Spatial Accuracy: Auto-zoom center lands within <= 5% screen width/height of the actual clicked target across a 5-minute continuous single-monitor recording.
• Performance Overhead: Input helper CPU usage remains < 1% on a single core during rapid mouse movement; zero dropped video frames.
• Clean Teardown: Zero orphaned libinput or helper processes left running after stopping a recording or closing Recordly.
