"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_VOLUME = 0.2;

export function BackgroundAudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = DEFAULT_VOLUME;
    audio.play().catch(() => {
      setIsPlaying(false);
    });
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  };

  return (
    <div className="audio-control" aria-label="Background music controls">
      <audio
        ref={audioRef}
        src="/audio/space-ambient.mp3"
        autoPlay
        loop
        preload="metadata"
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      <button
        type="button"
        className="audio-toggle"
        onClick={togglePlayback}
        aria-label={isPlaying ? "Pause background music" : "Play background music"}
        aria-pressed={isPlaying}
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <label className="volume-control">
        <span>Vol</span>
        <input
          aria-label="Background music volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
