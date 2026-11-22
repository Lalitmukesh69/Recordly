import { describe, expect, it, vi } from "vitest";
import type { AudioRegion } from "../types";
import { useAudioRegionCommands } from "./useAudioRegionCommands";

vi.mock("react", async (importOriginal) => ({
	...(await importOriginal<typeof import("react")>()),
	useCallback: (callback: unknown) => callback,
}));

describe("useAudioRegionCommands", () => {
	it("defaults new audio region volume to 0.25 (25% background level)", () => {
		let audioRegions: AudioRegion[] = [];
		let selectedAudioId: string | null = null;
		let activeEffectSection = "";
		const nextAudioIdRef = { current: 1 };

		const commands = useAudioRegionCommands({
			setSelectedClipId: vi.fn(),
			setAudioRegions: (update) => {
				audioRegions = typeof update === "function" ? update(audioRegions) : update;
			},
			selectedAudioId,
			setSelectedAudioId: (id) => {
				selectedAudioId = typeof id === "function" ? id(selectedAudioId) : id;
			},
			setSelectedZoomId: vi.fn(),
			setSelectedAnnotationId: vi.fn(),
			setSelectedCaptionId: vi.fn(),
			setActiveEffectSection: (section) => {
				activeEffectSection = typeof section === "function" ? section(activeEffectSection as any) : (section as string);
			},
			nextAudioIdRef,
		});

		commands.handleAudioAdded({ start: 1000, end: 5000 }, "/music/background.mp3", 0);

		expect(audioRegions).toHaveLength(1);
		expect(audioRegions[0]).toEqual({
			id: "audio-1",
			startMs: 1000,
			endMs: 5000,
			audioPath: "/music/background.mp3",
			volume: 0.25,
			normalize: false,
			trackIndex: 0,
		});
		expect(selectedAudioId).toBe("audio-1");
		expect(activeEffectSection).toBe("audio");
	});

	it("adjusts audio volume and clamps between 0 and 1", () => {
		let audioRegions: AudioRegion[] = [
			{
				id: "audio-1",
				startMs: 0,
				endMs: 5000,
				audioPath: "/music/bg.mp3",
				volume: 0.25,
			},
		];
		let selectedAudioId: string | null = "audio-1";

		const commands = useAudioRegionCommands({
			setSelectedClipId: vi.fn(),
			setAudioRegions: (update) => {
				audioRegions = typeof update === "function" ? update(audioRegions) : update;
			},
			selectedAudioId,
			setSelectedAudioId: (id) => {
				selectedAudioId = typeof id === "function" ? id(selectedAudioId) : id;
			},
			setSelectedZoomId: vi.fn(),
			setSelectedAnnotationId: vi.fn(),
			setSelectedCaptionId: vi.fn(),
			setActiveEffectSection: vi.fn(),
			nextAudioIdRef: { current: 2 },
		});

		commands.handleAudioVolumeChange(0.5);
		expect(audioRegions[0].volume).toBe(0.5);

		commands.handleAudioVolumeChange(1.5);
		expect(audioRegions[0].volume).toBe(1.0);

		commands.handleAudioVolumeChange(-0.2);
		expect(audioRegions[0].volume).toBe(0);
	});

	it("updates sourceStartMs when user selects a song section", () => {
		let audioRegions: AudioRegion[] = [
			{
				id: "audio-1",
				startMs: 0,
				endMs: 20000,
				audioPath: "/music/song.mp3",
				volume: 0.25,
				sourceStartMs: 0,
			},
		];
		let selectedAudioId: string | null = "audio-1";

		const commands = useAudioRegionCommands({
			setSelectedClipId: vi.fn(),
			setAudioRegions: (update) => {
				audioRegions = typeof update === "function" ? update(audioRegions) : update;
			},
			selectedAudioId,
			setSelectedAudioId: (id) => {
				selectedAudioId = typeof id === "function" ? id(selectedAudioId) : id;
			},
			setSelectedZoomId: vi.fn(),
			setSelectedAnnotationId: vi.fn(),
			setSelectedCaptionId: vi.fn(),
			setActiveEffectSection: vi.fn(),
			nextAudioIdRef: { current: 2 },
		});

		commands.handleAudioSourceStartMsChange(75000); // 1:15 into song
		expect(audioRegions[0].sourceStartMs).toBe(75000);
	});

	it("adjusts sourceStartMs when left-trimming and preserves it when moving", () => {
		let audioRegions: AudioRegion[] = [
			{
				id: "audio-1",
				startMs: 0,
				endMs: 20000,
				audioPath: "/music/song.mp3",
				volume: 0.25,
				sourceStartMs: 10000,
			},
		];

		const commands = useAudioRegionCommands({
			setSelectedClipId: vi.fn(),
			setAudioRegions: (update) => {
				audioRegions = typeof update === "function" ? update(audioRegions) : update;
			},
			selectedAudioId: "audio-1",
			setSelectedAudioId: vi.fn(),
			setSelectedZoomId: vi.fn(),
			setSelectedAnnotationId: vi.fn(),
			setSelectedCaptionId: vi.fn(),
			setActiveEffectSection: vi.fn(),
			nextAudioIdRef: { current: 2 },
		});

		// Moving clip (both start and end shift by +5000)
		commands.handleAudioSpanChange("audio-1", { start: 5000, end: 25000 });
		expect(audioRegions[0].startMs).toBe(5000);
		expect(audioRegions[0].endMs).toBe(25000);
		expect(audioRegions[0].sourceStartMs).toBe(10000); // preserved

		// Left-trimming clip (start moves forward from 5000 to 8000, end stays 25000)
		commands.handleAudioSpanChange("audio-1", { start: 8000, end: 25000 });
		expect(audioRegions[0].startMs).toBe(8000);
		expect(audioRegions[0].sourceStartMs).toBe(13000); // 10000 + 3000
	});
});
