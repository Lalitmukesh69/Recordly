import type { CursorTelemetryPoint, ZoomRegion, ZoomDepth, ZoomFocus } from "../types.js";
import { randomUUID } from "node:crypto";

export interface AutoZoomOptions {
  mergeGapMs?: number;
  padMs?: number;
  defaultDepth?: ZoomDepth;
  totalDurationMs?: number;
  minDurationMs?: number;
}

export function generateAutoZoomsFromTelemetry(
  samples: CursorTelemetryPoint[],
  options?: AutoZoomOptions,
): ZoomRegion[] {
  const mergeGapMs = options?.mergeGapMs ?? 2500;
  const padMs = options?.padMs ?? 600;
  const defaultDepth = options?.defaultDepth ?? 2;
  const minDurationMs = options?.minDurationMs ?? 1500;
  const totalDurationMs = options?.totalDurationMs ?? (samples[samples.length - 1]?.timeMs || 0) + 2000;

  // Filter explicit clicks
  const clicks = samples.filter((s) => {
    const it = s.interactionType;
    return it === "click" || it === "double-click" || it === "right-click" || it === "middle-click";
  });

  if (clicks.length === 0) {
    return [];
  }

  // Sort clicks chronologically
  clicks.sort((a, b) => a.timeMs - b.timeMs);

  // Group clicks into clusters
  interface ClickCluster {
    firstMs: number;
    lastMs: number;
    clicks: { cx: number; cy: number }[];
  }

  const clusters: ClickCluster[] = [];
  let currentCluster: ClickCluster | null = null;

  for (const click of clicks) {
    if (!currentCluster) {
      currentCluster = {
        firstMs: click.timeMs,
        lastMs: click.timeMs,
        clicks: [{ cx: click.cx, cy: click.cy }],
      };
      continue;
    }

    if (click.timeMs - currentCluster.lastMs <= mergeGapMs) {
      currentCluster.lastMs = click.timeMs;
      currentCluster.clicks.push({ cx: click.cx, cy: click.cy });
    } else {
      clusters.push(currentCluster);
      currentCluster = {
        firstMs: click.timeMs,
        lastMs: click.timeMs,
        clicks: [{ cx: click.cx, cy: click.cy }],
      };
    }
  }

  if (currentCluster) {
    clusters.push(currentCluster);
  }

  const suggestions: ZoomRegion[] = [];
  let lastEndMs = 0;

  for (const cluster of clusters) {
    let startMs = Math.max(0, cluster.firstMs - padMs);
    let endMs = cluster.lastMs + padMs;

    // Ensure minimum display duration
    if (endMs - startMs < minDurationMs) {
      endMs = startMs + minDurationMs;
    }

    if (totalDurationMs > 0 && endMs > totalDurationMs) {
      endMs = totalDurationMs;
    }

    // Prevent overlap with previous zoom region
    if (startMs < lastEndMs) {
      startMs = lastEndMs + 200; // Small breather gap
      if (endMs <= startMs) {
        continue;
      }
    }

    // Calculate cluster centroid focus (average of click positions)
    const avgCx = cluster.clicks.reduce((acc, c) => acc + c.cx, 0) / cluster.clicks.length;
    const avgCy = cluster.clicks.reduce((acc, c) => acc + c.cy, 0) / cluster.clicks.length;

    // Clamp focus so camera doesn't center into black borders
    const clampedFocus: ZoomFocus = {
      cx: Math.max(0.15, Math.min(0.85, avgCx)),
      cy: Math.max(0.15, Math.min(0.85, avgCy)),
    };

    suggestions.push({
      id: randomUUID(),
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
      depth: defaultDepth,
      focus: clampedFocus,
      mode: "auto",
    });

    lastEndMs = endMs;
  }

  return suggestions;
}
