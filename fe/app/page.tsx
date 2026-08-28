"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundAudio } from "./components/BackgroundAudio";
import { MissionTimeline } from "./components/MissionTimeline";
import { SpaceScene } from "./components/SpaceScene";
import { SmoothScroll } from "./components/SmoothScroll";
import type { ArtemisRouteViewSample } from "./data/artemisRoute";

const slides = [
  {
    kicker: "The long arc back",
    title: "We have not been this close in over half a century.",
    body: "Apollo 17 left lunar orbit in 1972. Artemis II carries the next crew of humans back around the Moon, turning a generation of plans, tests, and hardware into a flight people can see and feel again.",
  },
  {
    kicker: "The program",
    title: "Artemis is a return, but it is not a repeat.",
    body: "NASA is building a path for longer lunar missions with Orion, the Space Launch System, modern ground systems, international partners, and future surface hardware. Artemis II is the first crewed proving ground for that deep-space stack.",
  },
  {
    kicker: "The mission",
    title: "Artemis II sends Orion on a lunar flyby.",
    body: "The crew will test Orion's life support, navigation, communications, and handling while traveling farther from Earth than any humans have gone in decades. The flight sets up the confidence needed for later lunar landing missions.",
  },
  {
    kicker: "The crew",
    title: "Four astronauts carry the first crewed Artemis flight.",
    body: "Reid Wiseman commands the mission with Victor Glover as pilot. Christina Koch and Jeremy Hansen fly as mission specialists, bringing NASA and Canadian Space Agency experience into the first human voyage around the Moon in the Artemis era.",
  },
];

export default function Home() {
  const [interactive, setInteractive] = useState(false);
  const [orionSample, setOrionSample] = useState<ArtemisRouteViewSample | null>(null);
  const slideRefs = useRef<Array<HTMLElement | null>>([]);
  const updateSceneMode = useCallback((scroll: number) => {
    setInteractive(scroll >= window.innerHeight * (slides.length - 0.08));
  }, []);

  useEffect(() => {
    const updateFallbackSceneMode = () => {
      updateSceneMode(window.scrollY);
    };

    updateFallbackSceneMode();
    window.addEventListener("resize", updateFallbackSceneMode);

    return () => window.removeEventListener("resize", updateFallbackSceneMode);
  }, [updateSceneMode]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
        });
      },
      {
        rootMargin: "-30% 0px -30% 0px",
        threshold: 0.18,
      },
    );

    slideRefs.current.forEach((slide) => {
      if (slide) {
        observer.observe(slide);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <main className="mission-experience">
      <SmoothScroll onScroll={updateSceneMode} />
      <SpaceScene interactive={interactive} routeSample={interactive ? orionSample : null} />
      <BackgroundAudio />
      <MissionTimeline visible={interactive} onSampleChange={setOrionSample} />

      <nav className="site-nav" aria-label="Primary navigation">
        <a className="nav-brand" href="#top" aria-label="Artemis II home">
          <Image
            src="/artemis_logo.png"
            alt="Artemis logo"
            width={56}
            height={56}
            priority
          />
          <span>Artemis II</span>
        </a>
        <div className="nav-links">
          <a href="#program">Program</a>
          <a href="#crew">Crew</a>
          <a href="#flight-window">Explore</a>
        </div>
      </nav>

      <section id="top" className="story-deck" aria-label="Artemis II story slides">
        {slides.map((slide, index) => (
          <article
            id={index === 1 ? "program" : index === 3 ? "crew" : undefined}
            className="intro-panel snap-section"
            key={slide.title}
            ref={(node) => {
              slideRefs.current[index] = node;
            }}
          >
            <div className="mission-card">
              <p className="mission-kicker">{slide.kicker}</p>
              <h1>{slide.title}</h1>
              <p>{slide.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section
        id="flight-window"
        className="flight-window snap-section"
        aria-label="Interactive flight window"
      >
      </section>
    </main>
  );
}
