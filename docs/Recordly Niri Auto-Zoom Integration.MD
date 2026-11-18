
1. Project Purpose & Business Justification

Recordly positions itself as a free, open-source cross-platform tool for product demos and walkthroughs. Linux tiling Wayland compositors (like Hyprland, Sway, and Niri) make up a highly active developer demographic likely to create technical demos and contribute code. Fixing Issue #1169 unblocks Niri users immediately and establishes a reusable libinput-based fallback that can also solve auto-zoom for Sway, River, and Cosmic Wayland users.

2. Scope Definition


In Scope

• Forking webadderallorg/Recordly and setting up a local Linux development build on Niri.
• Building a modular NiriCursorTracker class in TypeScript (Electron main process) backed by libinput / $NIRI_SOCKET.
• Handling single-monitor and fractional-scaling coordinate normalization.
• Documenting Linux input group prerequisites and Niri floating window rules for the recording HUD.
• Submitting an upstream Pull Request referencing Issue #1169.

Out of Scope

• Kernel-level virtual device creation (uinput) or root/polkit privilege escalation prompts inside Electron.
• Upstream patches to the Niri compositor itself (e.g., adding a new Wayland protocol to Smithay).

3. Work Breakdown Structure (WBS) & Milestones

• Phase 1: Discovery & Environment Setup (~1.5 hrs)
	• Fork and clone Recordly; run local dev build on Niri.
	• Locate existing Linux/X11/Hyprland cursor tracking files and inspect the exact telemetry TypeScript interface.
• Phase 2: Standalone Telemetry Prototype (~2.5 hrs)
	• Write a standalone Node/TS script connecting to $NIRI_SOCKET to parse monitor bounds.
	• Pipe libinput debug-events output into a parser that tracks (x, y) coordinates and logs BTN_LEFT events.
• Phase 3: Recordly Integration & Calibration (~3 hrs)
	• Wire NiriCursorTracker into Recordly's recording lifecycle (start, pause, resume, stop).
	• Add cursor start-position calibration (e.g., reading initial click/hover coordinates on the Recordly "Start" button before pointer leaves the window).
	• Add graceful error handling when /dev/input permissions are missing.
• Phase 4: Testing, Polish & Upstream PR (~2 hrs)
	• Test at 1.0x and fractional scaling (e.g., 1.25x / 1.5x) across 5-minute recordings.
	• Verify clean child-process termination and lint/typecheck compliance.
	• Open PR against webadderallorg/Recordly with demo video recorded on Niri.

4. Roles & Stakeholders

• Lead Developer & QA: You (Implementation, local Niri testing, PR submission).
• Upstream Maintainers: webadderallorg/Recordly core team (Code review, architecture alignment, merge approval).
• Community Testers: Users subscribed to GitHub Issue #1169 (Multi-monitor and hardware edge-case validation).

5. Risk Register & Mitigations


Risk	Impact	Likelihood	Mitigation Strategy
Relative motion drift (libinput deltas desync from actual Niri cursor over time)	High	Medium	Initialize (x, y) from the exact screen coordinates of the "Record" button click in Recordly's window, apply libinput's accelerated deltas (dx, dy rather than dx_unaccel), and strictly clamp at [0, outputWidth] and [0, outputHeight].
Missing input group permission on user machines	High	High	Check group/device readability before capture starts and display a one-time actionable toast/modal with the sudo usermod -aG input $USER command.
libinput-tools binary not installed on user's distro	Medium	Medium	Check binary existence via which libinput; if missing, either prompt user to install libinput-tools/libinput or read /dev/input/event* directly via a lightweight buffer parser.
Touchpad vs. Mouse speed differences	Medium	Medium	Rely on libinput debug-events default accelerated pixel deltas rather than raw evdev counts, as both Niri (Smithay) and libinput debug-events use libinput under the hood.


6. Definition of Done (DoD)

1. Recording a 3-minute Niri session with 10+ clicks across native Wayland apps produces accurate auto-zooms in Recordly's editor without manual adjustment.
2. All existing TypeScript build checks and linters pass (npm run typecheck / npm run build).
3. Upstream PR is submitted with setup notes and linked to Issue #1169