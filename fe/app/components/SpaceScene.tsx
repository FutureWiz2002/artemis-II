"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Stars, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  MathUtils,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import type { RefObject } from "react";
import type { Group } from "three";
import type { ArtemisRouteViewSample } from "../data/artemisRoute";
import { publicPath } from "../lib/publicPath";

const EARTH_CENTER = [-2.35, -1.65, 2.75] as const;
const MOON_CENTER = [4.7, 0.95, -5.6] as const;
const DEFAULT_CAMERA_POSITION = [0.45, 0.18, 5.15] as const;
const MIN_ORION_VIEW_DISTANCE = 2.9;
const MAX_ORION_VIEW_DISTANCE = 12.5;
const MAX_ROUTE_RADIUS_KM = 413144;
const CAMERA_FPS = 18;
const ROUTE_LUNAR_DIRECTION = new Vector3(-958.132, -1369.062, -2491.516).normalize();
const VISUAL_MOON_DIRECTION = new Vector3(
  MOON_CENTER[0] - EARTH_CENTER[0],
  MOON_CENTER[1] - EARTH_CENTER[1],
  MOON_CENTER[2] - EARTH_CENTER[2],
).normalize();
const ROUTE_TO_SCENE_ROTATION = new Quaternion().setFromUnitVectors(
  ROUTE_LUNAR_DIRECTION,
  VISUAL_MOON_DIRECTION,
);

export const orionCameraPositions = [
  {
    timestamp: "2026-04-02T01:57:37.084",
    position: [0, 0, 0],
    lookAt: "earth",
    label: "Launch / early outbound",
  },
];

function useLowPowerRotation(
  ref: RefObject<Group | null>,
  speed: number,
  fps = 18,
) {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const frameMs = 1000 / fps;
    let lastTime = performance.now();

    const interval = window.setInterval(() => {
      if (document.hidden || !ref.current) {
        return;
      }

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      ref.current.rotation.y += delta * speed;
      invalidate();
    }, frameMs);

    return () => window.clearInterval(interval);
  }, [fps, invalidate, ref, speed]);
}

function Earth() {
  const earth = useGLTF(publicPath("/models/earth.glb"));
  const ref = useRef<Group>(null);
  useLowPowerRotation(ref, 0.035);

  return (
    <primitive
      ref={ref}
      object={earth.scene}
      position={[...EARTH_CENTER]}
      rotation={[0.18, -0.62, -0.1]}
      scale={0.023}
    />
  );
}

function Moon() {
  const moon = useGLTF(publicPath("/models/moon.glb"));
  const ref = useRef<Group>(null);
  useLowPowerRotation(ref, -0.015);

  return (
    <primitive
      ref={ref}
      object={moon.scene}
      position={[...MOON_CENTER]}
      rotation={[0.08, 0.18, -0.04]}
      scale={0.33}
    />
  );
}

function SceneObjects() {
  return (
    <>
      <color attach="background" args={["#02030a"]} />
      <fog attach="fog" args={["#02030a", 9, 23]} />
      <ambientLight intensity={0.44} />
      <directionalLight position={[0.45, 0.18, 8]} intensity={8.8} color="#ffffff" />
      <pointLight position={[0.45, 0.18, 5.15]} intensity={46} distance={46} decay={1.05} color="#ffffff" />
      <directionalLight position={[1.4, 0.7, 5.9]} intensity={1.2} color="#f5f5f5" />
      <Stars
        radius={80}
        depth={45}
        count={260}
        factor={2.1}
        saturation={0}
        fade
        speed={0}
      />
      <Suspense fallback={null}>
        <Earth />
        <Moon />
      </Suspense>
    </>
  );
}

function routeSampleToScenePosition(sample: ArtemisRouteViewSample) {
  const [x, y, z] = sample.normalizedPosition;
  const direction = new Vector3(x, z, y).applyQuaternion(ROUTE_TO_SCENE_ROTATION);
  const fallbackDirection = new Vector3(
    DEFAULT_CAMERA_POSITION[0] - EARTH_CENTER[0],
    DEFAULT_CAMERA_POSITION[1] - EARTH_CENTER[1],
    DEFAULT_CAMERA_POSITION[2] - EARTH_CENTER[2],
  );

  if (direction.lengthSq() < 0.0001) {
    direction.copy(fallbackDirection);
  }

  const distanceProgress = Math.min(
    Math.max((sample.distanceFromEarthKm - 6500) / (MAX_ROUTE_RADIUS_KM - 6500), 0),
    1,
  );
  const cameraDistance =
    MIN_ORION_VIEW_DISTANCE +
    Math.sqrt(distanceProgress) * (MAX_ORION_VIEW_DISTANCE - MIN_ORION_VIEW_DISTANCE);

  return new Vector3(...EARTH_CENTER).add(direction.normalize().multiplyScalar(cameraDistance));
}

function getMissionForwardDirection(
  sample: ArtemisRouteViewSample,
  fromPosition: Vector3,
) {
  const target =
    sample.distanceFromEarthKm > 180000 && sample.missionSeconds < 520000
      ? new Vector3(...MOON_CENTER)
      : new Vector3(...EARTH_CENTER);

  return target.sub(fromPosition).normalize();
}

function directionToYawPitch(direction: Vector3) {
  return {
    yaw: Math.atan2(direction.x, direction.z),
    pitch: Math.asin(MathUtils.clamp(direction.y, -1, 1)),
  };
}

function yawPitchToDirection(yaw: number, pitch: number) {
  const cosPitch = Math.cos(pitch);

  return new Vector3(
    Math.sin(yaw) * cosPitch,
    Math.sin(pitch),
    Math.cos(yaw) * cosPitch,
  );
}

function OrionCameraController({
  routeSample,
  interactive,
}: {
  routeSample: ArtemisRouteViewSample | null;
  interactive: boolean;
}) {
  const { camera, gl, invalidate } = useThree();
  const targetPosition = useRef(new Vector3(...DEFAULT_CAMERA_POSITION));
  const currentYaw = useRef(0);
  const currentPitch = useRef(0);
  const desiredYaw = useRef(0);
  const desiredPitch = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastFrameTime = useRef(0);
  const lastMissionSeconds = useRef<number | null>(null);
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!routeSample) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      return;
    }

    targetPosition.current = routeSampleToScenePosition(routeSample);
    const missionForward = getMissionForwardDirection(routeSample, targetPosition.current);
    const missionAngles = directionToYawPitch(missionForward);
    const previousMissionSeconds = lastMissionSeconds.current;
    const jumped =
      previousMissionSeconds === null ||
      Math.abs(routeSample.missionSeconds - previousMissionSeconds) > 20000;

    if (jumped) {
      desiredYaw.current = missionAngles.yaw;
      desiredPitch.current = missionAngles.pitch;

      if (previousMissionSeconds === null) {
        currentYaw.current = missionAngles.yaw;
        currentPitch.current = missionAngles.pitch;
      }
    }

    lastMissionSeconds.current = routeSample.missionSeconds;

    const animate = (time: number) => {
      const frameMs = 1000 / CAMERA_FPS;

      if (time - lastFrameTime.current >= frameMs) {
        lastFrameTime.current = time;
        camera.position.lerp(targetPosition.current, 0.14);
        currentYaw.current = MathUtils.lerp(currentYaw.current, desiredYaw.current, 0.18);
        currentPitch.current = MathUtils.lerp(
          currentPitch.current,
          desiredPitch.current,
          0.18,
        );
        camera.lookAt(
          camera.position.clone().add(
            yawPitchToDirection(currentYaw.current, currentPitch.current),
          ),
        );

        invalidate();
      }

      const isSettled =
        camera.position.distanceTo(targetPosition.current) < 0.01 &&
        Math.abs(currentYaw.current - desiredYaw.current) < 0.001 &&
        Math.abs(currentPitch.current - desiredPitch.current) < 0.001;

      if (!isSettled) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        frameRef.current = null;
      }
    };

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(animate);
    }
  }, [camera, invalidate, routeSample]);

  useEffect(() => {
    const canvas = gl.domElement;

    if (!interactive || !routeSample) {
      return;
    }

    const scheduleFrame = () => {
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame((time) => {
          lastFrameTime.current = 0;
          const frameMs = 1000 / CAMERA_FPS;

          if (time - lastFrameTime.current >= frameMs) {
            lastFrameTime.current = time;
            currentYaw.current = desiredYaw.current;
            currentPitch.current = desiredPitch.current;
            camera.lookAt(
              camera.position.clone().add(
                yawPitchToDirection(currentYaw.current, currentPitch.current),
              ),
            );
            invalidate();
          }

          frameRef.current = null;
        });
      } else {
        invalidate();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      isDragging.current = true;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging.current) {
        return;
      }

      const dx = event.clientX - lastPointer.current.x;
      const dy = event.clientY - lastPointer.current.y;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      desiredYaw.current -= dx * 0.004;
      desiredPitch.current = MathUtils.clamp(
        desiredPitch.current + dy * 0.004,
        -Math.PI / 2 + 0.04,
        Math.PI / 2 - 0.04,
      );
      scheduleFrame();
    };

    const onPointerUp = (event: PointerEvent) => {
      isDragging.current = false;

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (camera instanceof PerspectiveCamera) {
        camera.fov = MathUtils.clamp(camera.fov + event.deltaY * 0.015, 28, 58);
        camera.updateProjectionMatrix();
      }
      invalidate();
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [camera, gl.domElement, interactive, invalidate, routeSample]);

  return null;
}

export function SpaceScene({
  interactive,
  routeSample,
}: {
  interactive: boolean;
  routeSample: ArtemisRouteViewSample | null;
}) {
  return (
    <div className={interactive ? "space-canvas interactive" : "space-canvas"}>
      <Canvas
        frameloop="demand"
        camera={{ position: [...DEFAULT_CAMERA_POSITION], fov: 38, near: 0.01, far: 100 }}
        dpr={[0.5, 0.85]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "low-power",
          precision: "mediump",
          stencil: false,
          depth: true,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
      >
        <SceneObjects />
        <OrionCameraController routeSample={routeSample} interactive={interactive} />
      </Canvas>
    </div>
  );
}

useGLTF.preload(publicPath("/models/earth.glb"));
useGLTF.preload(publicPath("/models/moon.glb"));
