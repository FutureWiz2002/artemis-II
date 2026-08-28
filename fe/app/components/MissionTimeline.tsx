"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ARTEMIS_ROUTE_MARKERS,
  ARTEMIS_ROUTE_META,
  ARTEMIS_ROUTE_SAMPLES,
} from "../data/artemisRoute";
import type { ArtemisRouteViewSample } from "../data/artemisRoute";

const PLAYBACK_SPEED = 8;
type RouteMarker = (typeof ARTEMIS_ROUTE_MARKERS)[number];

function formatElapsed(totalSeconds: number) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    return `T+${days}d ${hours}h ${minutes}m`;
  }

  return `T+${hours}h ${minutes}m`;
}

function formatUtc(timestamp: string) {
  return timestamp.replace("T", " ").slice(0, 19);
}

function nearestSampleIndexByMissionSeconds(missionSeconds: number) {
  let bestIndex = 0;
  let bestDelta = Number.POSITIVE_INFINITY;

  ARTEMIS_ROUTE_SAMPLES.forEach((sample, index) => {
    const delta = Math.abs(sample.missionSeconds - missionSeconds);

    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function interpolateRouteSample(missionSeconds: number): ArtemisRouteViewSample {
  const firstSample = ARTEMIS_ROUTE_SAMPLES[0];
  const lastSample = ARTEMIS_ROUTE_SAMPLES[ARTEMIS_ROUTE_SAMPLES.length - 1];

  if (missionSeconds <= firstSample.missionSeconds) {
    return firstSample;
  }

  if (missionSeconds >= lastSample.missionSeconds) {
    return lastSample;
  }

  const upperIndex = ARTEMIS_ROUTE_SAMPLES.findIndex(
    (sample) => sample.missionSeconds >= missionSeconds,
  );
  const lowerSample = ARTEMIS_ROUTE_SAMPLES[Math.max(upperIndex - 1, 0)];
  const upperSample = ARTEMIS_ROUTE_SAMPLES[upperIndex];
  const spanSeconds = upperSample.missionSeconds - lowerSample.missionSeconds;
  const t = spanSeconds > 0 ? (missionSeconds - lowerSample.missionSeconds) / spanSeconds : 0;
  const lerp = (start: number, end: number) => start + (end - start) * t;

  return {
    timestamp: lowerSample.timestamp,
    missionSeconds,
    normalizedPosition: [
      Number(lerp(lowerSample.normalizedPosition[0], upperSample.normalizedPosition[0]).toFixed(3)),
      Number(lerp(lowerSample.normalizedPosition[1], upperSample.normalizedPosition[1]).toFixed(3)),
      Number(lerp(lowerSample.normalizedPosition[2], upperSample.normalizedPosition[2]).toFixed(3)),
    ],
    distanceFromEarthKm: Math.round(
      lerp(lowerSample.distanceFromEarthKm, upperSample.distanceFromEarthKm),
    ),
    speedKmS: lerp(lowerSample.speedKmS, upperSample.speedKmS),
  };
}

export function MissionTimeline({
  visible,
  onSampleChange,
}: {
  visible: boolean;
  onSampleChange?: (sample: ArtemisRouteViewSample) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeSample = ARTEMIS_ROUTE_SAMPLES[activeIndex];
  const lastSample = ARTEMIS_ROUTE_SAMPLES[ARTEMIS_ROUTE_SAMPLES.length - 1];
  const progress =
    lastSample.missionSeconds > 0
      ? (activeSample.missionSeconds / lastSample.missionSeconds) * 100
      : 0;

  const activeMarker = useMemo(() => {
    let closestMarker: RouteMarker = ARTEMIS_ROUTE_MARKERS[0];
    let closestDistance = Number.POSITIVE_INFINITY;

    ARTEMIS_ROUTE_MARKERS.forEach((marker) => {
      const distance = Math.abs(marker.sampleIndex - activeIndex);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestMarker = marker;
      }
    });

    return closestMarker;
  }, [activeIndex]);

  useEffect(() => {
    onSampleChange?.(activeSample);
  }, [activeSample, onSampleChange]);

  useEffect(() => {
    if (!isPlaying || !visible) {
      return;
    }

    let frame = 0;
    let lastTime = performance.now();
    let missionSeconds: number = activeSample.missionSeconds;

    const tick = (time: number) => {
      const deltaSeconds = ((time - lastTime) / 1000) * PLAYBACK_SPEED;
      lastTime = time;
      missionSeconds = Math.min(lastSample.missionSeconds, missionSeconds + deltaSeconds);
      onSampleChange?.(interpolateRouteSample(missionSeconds));
      const nextIndex = nearestSampleIndexByMissionSeconds(missionSeconds);
      setActiveIndex(nextIndex);

      if (missionSeconds >= lastSample.missionSeconds) {
        setIsPlaying(false);
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [activeSample.missionSeconds, isPlaying, lastSample.missionSeconds, onSampleChange, visible]);

  return (
    <section
      className={visible ? "mission-timeline is-visible" : "mission-timeline"}
      aria-label="Artemis II mission timeline"
      aria-hidden={!visible}
    >
      <div className="timeline-summary">
        <p className="mission-kicker">Mission timeline</p>
        <h3>{activeMarker.label}</h3>
        <p>
          <span>{formatElapsed(activeSample.missionSeconds)}</span>
          {activeMarker.detail}
        </p>
      </div>

      <div className="timeline-controls">
        <button
          type="button"
          className="timeline-play"
          onClick={() => setIsPlaying((playing) => !playing)}
          aria-pressed={isPlaying}
        >
          {isPlaying ? "Pause" : "Play"} {PLAYBACK_SPEED}x
        </button>
        <input
          aria-label="Scrub Artemis II timeline"
          className="timeline-scrubber"
          type="range"
          min="0"
          max={ARTEMIS_ROUTE_SAMPLES.length - 1}
          value={activeIndex}
          onChange={(event) => {
            setIsPlaying(false);
            setActiveIndex(Number(event.target.value));
          }}
        />
      </div>

      <div className="timeline-rail" aria-hidden="true">
        <div className="timeline-progress" style={{ width: `${progress}%` }} />
      </div>

      <div className="timeline-events">
        {ARTEMIS_ROUTE_MARKERS.map((event) => (
          <button
            type="button"
            className={
              event.sampleIndex === activeMarker.sampleIndex
                ? "timeline-event active"
                : "timeline-event"
            }
            key={event.label}
            onClick={() => {
              setIsPlaying(false);
              setActiveIndex(event.sampleIndex);
            }}
            aria-pressed={event.sampleIndex === activeMarker.sampleIndex}
          >
            <span>{event.label}</span>
            <small>{formatElapsed(ARTEMIS_ROUTE_SAMPLES[event.sampleIndex].missionSeconds)}</small>
          </button>
        ))}
      </div>

      <dl className="timeline-telemetry">
        <div>
          <dt>UTC</dt>
          <dd>{formatUtc(activeSample.timestamp)}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{activeSample.distanceFromEarthKm.toLocaleString()} km</dd>
        </div>
        <div>
          <dt>Velocity</dt>
          <dd>{activeSample.speedKmS.toFixed(3)} km/s</dd>
        </div>
        <div>
          <dt>Normalized XYZ</dt>
          <dd>[{activeSample.normalizedPosition.join(", ")}]</dd>
        </div>
      </dl>

      <p className="timeline-note">
        OEM route normalized with one uniform scale: max Earth-centered radius{" "}
        {ARTEMIS_ROUTE_META.maxRadiusKm.toLocaleString()} km ={" "}
        {ARTEMIS_ROUTE_META.normalizedMaxRadius} scene units.
      </p>
    </section>
  );
}
