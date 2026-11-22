import type { Span } from "dnd-timeline";
import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";
import type { AudioRegion, EditorEffectSection } from "../types";

interface UseAudioRegionCommandsParams {
	setSelectedClipId: Dispatch<SetStateAction<string | null>>;
	setAudioRegions: Dispatch<SetStateAction<AudioRegion[]>>;
	selectedAudioId: string | null;
	setSelectedAudioId: Dispatch<SetStateAction<string | null>>;
	setSelectedZoomId: Dispatch<SetStateAction<string | null>>;
	setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
	setSelectedCaptionId: Dispatch<SetStateAction<string | null>>;
	setActiveEffectSection: Dispatch<SetStateAction<EditorEffectSection>>;
	nextAudioIdRef: MutableRefObject<number>;
}

export function useAudioRegionCommands({
	setSelectedClipId,
	setAudioRegions,
	selectedAudioId,
	setSelectedAudioId,
	setSelectedZoomId,
	setSelectedAnnotationId,
	setSelectedCaptionId,
	setActiveEffectSection,
	nextAudioIdRef,
}: UseAudioRegionCommandsParams) {
	const handleSelectAudio = useCallback(
		(id: string | null) => {
			setSelectedAudioId(id);
			if (id) {
				setSelectedZoomId(null);
				setSelectedAnnotationId(null);
				setSelectedClipId(null);
				setSelectedCaptionId(null);
				setActiveEffectSection("audio");
			}
		},
		[
			setActiveEffectSection,
			setSelectedAnnotationId,
			setSelectedClipId,
			setSelectedAudioId,
			setSelectedCaptionId,
			setSelectedZoomId,
		],
	);

	const handleAudioAdded = useCallback(
		(span: Span, audioPath: string, trackIndex?: number, initialVolume: number = 0.25) => {
			const id = `audio-${nextAudioIdRef.current++}`;
			const newRegion: AudioRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				audioPath,
				volume: Math.max(0, Math.min(1, initialVolume)),
				normalize: false,
				trackIndex,
			};
			setAudioRegions((current) => [...current, newRegion]);
			setSelectedAudioId(id);
			setSelectedZoomId(null);
			setSelectedAnnotationId(null);
			setSelectedClipId(null);
			setSelectedCaptionId(null);
			setActiveEffectSection("audio");
		},
		[
			nextAudioIdRef,
			setActiveEffectSection,
			setAudioRegions,
			setSelectedAnnotationId,
			setSelectedClipId,
			setSelectedAudioId,
			setSelectedCaptionId,
			setSelectedZoomId,
		],
	);

	const handleAudioSpanChange = useCallback(
		(id: string, span: Span, trackIndex?: number) => {
			const normalizedTrackIndex =
				typeof trackIndex === "number" && Number.isFinite(trackIndex)
					? Math.max(0, Math.floor(trackIndex))
					: undefined;
			setAudioRegions((current) =>
				current.map((region) => {
					if (region.id !== id) return region;
					const newStart = Math.round(span.start);
					const newEnd = Math.round(span.end);
					const isMove = newStart - region.startMs === newEnd - region.endMs;
					let sourceStartMs = region.sourceStartMs ?? 0;
					if (!isMove) {
						const startDelta = newStart - region.startMs;
						sourceStartMs = Math.max(0, sourceStartMs + startDelta);
					}
					return {
						...region,
						startMs: newStart,
						endMs: newEnd,
						sourceStartMs,
						...(normalizedTrackIndex === undefined
							? {}
							: { trackIndex: normalizedTrackIndex }),
					};
				}),
			);
		},
		[setAudioRegions],
	);

	const handleAudioSourceStartMsChange = useCallback(
		(sourceStartMs: number) => {
			if (!selectedAudioId || !Number.isFinite(sourceStartMs)) return;
			const nextSourceStartMs = Math.max(0, Math.round(sourceStartMs));
			setAudioRegions((current) =>
				current.map((region) =>
					region.id === selectedAudioId
						? { ...region, sourceStartMs: nextSourceStartMs }
						: region,
				),
			);
		},
		[selectedAudioId, setAudioRegions],
	);

	const handleAudioVolumeChange = useCallback(
		(volume: number) => {
			if (!selectedAudioId || !Number.isFinite(volume)) return;
			const nextVolume = Math.max(0, Math.min(1, volume));
			setAudioRegions((current) =>
				current.map((region) =>
					region.id === selectedAudioId ? { ...region, volume: nextVolume } : region,
				),
			);
		},
		[selectedAudioId, setAudioRegions],
	);

	const handleAudioDelete = useCallback(
		(id: string) => {
			setAudioRegions((current) => current.filter((region) => region.id !== id));
			if (selectedAudioId === id) setSelectedAudioId(null);
		},
		[selectedAudioId, setAudioRegions, setSelectedAudioId],
	);

	const handleAudioNormalizeChange = useCallback(
		(normalize: boolean) => {
			if (!selectedAudioId) return;
			setAudioRegions((current) =>
				current.map((region) =>
					region.id === selectedAudioId ? { ...region, normalize } : region,
				),
			);
		},
		[selectedAudioId, setAudioRegions],
	);

	return {
		handleSelectAudio,
		handleAudioAdded,
		handleAudioSpanChange,
		handleAudioVolumeChange,
		handleAudioDelete,
		handleAudioNormalizeChange,
		handleAudioSourceStartMsChange,
	};
}
