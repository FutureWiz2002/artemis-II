"use client";

import Lenis from "lenis";
import { useEffect } from "react";

export function SmoothScroll({
  onScroll,
  snapSelector = ".snap-section",
}: {
  onScroll: (scroll: number) => void;
  snapSelector?: string;
}) {
  useEffect(() => {
    let isSnapping = false;
    let unlockTimer = 0;
    let residualWheelTimer = 0;
    let allowNextSnapAt = 0;
    let wheelDelta = 0;
    const snapDuration = 1.65;
    const snapEasing = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const getSnapSections = () =>
      Array.from(document.querySelectorAll<HTMLElement>(snapSelector));

    const getClosestSnapIndex = (scroll: number, sections: HTMLElement[]) => {
      return sections.reduce(
        (closest, section, index) => {
          const distance = Math.abs(section.offsetTop - scroll);

          if (distance < closest.distance) {
            return { distance, index };
          }

          return closest;
        },
        { distance: Number.POSITIVE_INFINITY, index: 0 },
      ).index;
    };

    const lenis = new Lenis({
      duration: 1.18,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: false,
      touchMultiplier: 1.05,
    });

    const snapToSection = (target: HTMLElement) => {
      const targetTop = Math.round(target.offsetTop);

      isSnapping = true;
      allowNextSnapAt = performance.now() + snapDuration * 1000 + 420;
      window.clearTimeout(unlockTimer);

      lenis.scrollTo(targetTop, {
        duration: snapDuration,
        easing: snapEasing,
        force: true,
        lock: true,
        onComplete: () => {
          unlockTimer = window.setTimeout(() => {
            isSnapping = false;
          }, 220);
        },
      });

      unlockTimer = window.setTimeout(() => {
        isSnapping = false;
      }, snapDuration * 1000 + 650);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        return;
      }

      const sections = getSnapSections();
      const direction = Math.sign(event.deltaY);

      if (sections.length === 0 || direction === 0) {
        return;
      }

      const currentIndex = getClosestSnapIndex(window.scrollY, sections);
      const initialTargetIndex = Math.max(
        0,
        Math.min(sections.length - 1, currentIndex + direction),
      );

      if (initialTargetIndex === currentIndex) {
        return;
      }

      event.preventDefault();
      window.clearTimeout(residualWheelTimer);
      residualWheelTimer = window.setTimeout(() => {
        wheelDelta = 0;

        if (performance.now() >= allowNextSnapAt) {
          isSnapping = false;
        }
      }, 180);

      if (isSnapping || performance.now() < allowNextSnapAt) {
        return;
      }

      wheelDelta += event.deltaY;

      if (Math.abs(wheelDelta) < 28) {
        return;
      }

      const snapDirection = Math.sign(wheelDelta);
      const targetIndex = Math.max(
        0,
        Math.min(sections.length - 1, currentIndex + snapDirection),
      );

      wheelDelta = 0;
      snapToSection(sections[targetIndex]);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    const updateScroll = ({ scroll }: { scroll: number }) => {
      onScroll(scroll);
    };

    lenis.on("scroll", updateScroll);
    onScroll(lenis.scroll);

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };

    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(unlockTimer);
      window.clearTimeout(residualWheelTimer);
      window.removeEventListener("wheel", handleWheel);
      lenis.off("scroll", updateScroll);
      lenis.destroy();
    };
  }, [onScroll, snapSelector]);

  return null;
}
