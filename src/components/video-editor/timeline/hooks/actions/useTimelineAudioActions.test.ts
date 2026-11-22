import { describe, expect, it, vi } from "vitest";
import { useTimelineAudioActions } from "./useTimelineAudioActions";

vi.mock("react", async (importOriginal) => ({
	...(await importOriginal<typeof import("react")>()),
	useCallback: (callback: unknown) => callback,
	useMemo: (factory: () => unknown) => factory(),
}));

describe("useTimelineAudioActions", () => {
	it("opens file picker and adds audio at current playhead position", async () => {
		const onAudioAdded = vi.fn();
		const openFilePicker = vi.fn().mockResolvedValue({ success: true, path: "/music/song.mp3" });
		const probeAudioDurationMs = vi.fn().mockResolvedValue(5000);
		const reportError = vi.fn();

		const { handleAddAudio } = useTimelineAudioActions({
			timeline: { videoDuration: 10, totalMs: 10000, currentTimeMs: 2000 },
			regions: { audio: [] },
			onAudioAdded,
			deps: { openFilePicker, probeAudioDurationMs, reportError },
		});

		await handleAddAudio();

		expect(openFilePicker).toHaveBeenCalledTimes(1);
		expect(probeAudioDurationMs).toHaveBeenCalledWith("/music/song.mp3");
		expect(onAudioAdded).toHaveBeenCalledWith(
			{ start: 2000, end: 7000 },
			"/music/song.mp3",
			0,
		);
		expect(reportError).not.toHaveBeenCalled();
	});

	it("wraps around to start (0ms) when playhead is at the end of the video", async () => {
		const onAudioAdded = vi.fn();
		const openFilePicker = vi.fn().mockResolvedValue({ success: true, path: "/music/song.mp3" });
		const probeAudioDurationMs = vi.fn().mockResolvedValue(4000);
		const reportError = vi.fn();

		const { handleAddAudio } = useTimelineAudioActions({
			timeline: { videoDuration: 10, totalMs: 10000, currentTimeMs: 10000 },
			regions: { audio: [] },
			onAudioAdded,
			deps: { openFilePicker, probeAudioDurationMs, reportError },
		});

		await handleAddAudio();

		expect(onAudioAdded).toHaveBeenCalledWith(
			{ start: 0, end: 4000 },
			"/music/song.mp3",
			0,
		);
		expect(reportError).not.toHaveBeenCalled();
	});

	it("uses externalAudioPath and dropTimeMs directly without calling openFilePicker", async () => {
		const onAudioAdded = vi.fn();
		const openFilePicker = vi.fn();
		const probeAudioDurationMs = vi.fn().mockResolvedValue(3000);
		const approveAudioPath = vi.fn().mockResolvedValue({ success: true });
		const reportError = vi.fn();

		const { handleAddAudio } = useTimelineAudioActions({
			timeline: { videoDuration: 10, totalMs: 10000, currentTimeMs: 1000 },
			regions: { audio: [] },
			onAudioAdded,
			deps: { openFilePicker, probeAudioDurationMs, approveAudioPath, reportError },
		});

		await handleAddAudio(undefined, "/dropped/beat.wav", 4500);

		expect(openFilePicker).not.toHaveBeenCalled();
		expect(approveAudioPath).toHaveBeenCalledWith("/dropped/beat.wav");
		expect(probeAudioDurationMs).toHaveBeenCalledWith("/dropped/beat.wav");
		expect(onAudioAdded).toHaveBeenCalledWith(
			{ start: 4500, end: 7500 },
			"/dropped/beat.wav",
			0,
		);
	});

	it("reports error when audio file duration cannot be probed", async () => {
		const onAudioAdded = vi.fn();
		const openFilePicker = vi.fn().mockResolvedValue({ success: true, path: "/corrupt.mp3" });
		const probeAudioDurationMs = vi.fn().mockResolvedValue(0);
		const reportError = vi.fn();

		const { handleAddAudio } = useTimelineAudioActions({
			timeline: { videoDuration: 10, totalMs: 10000, currentTimeMs: 0 },
			regions: { audio: [] },
			onAudioAdded,
			deps: { openFilePicker, probeAudioDurationMs, reportError },
		});

		await handleAddAudio();

		expect(reportError).toHaveBeenCalledWith(
			"Could not read audio file",
			expect.any(String),
		);
		expect(onAudioAdded).not.toHaveBeenCalled();
	});
});
