import React, { useEffect, useRef } from 'react';

interface SilhouetteCrane {
  id: number;
  color: string;
  scale: number;
  startX: string;
  startY: string;
  endX: string;
  endY: string;
  durationSec: number;
  delayMs: number;
  wingSpeedSec: number;
  targetOpacity: number;
}

// 96 2D Silhouette Cranes in High-Contrast White & Vibrant Ultraviolet Purple
const SILHOUETTE_CLOUD: SilhouetteCrane[] = Array.from({ length: 96 }, (_, i) => {
  const wave = i < 24 ? 0 : i < 68 ? 1 : 2;

  const colors = [
    '#FFFFFF',
    '#FFFFFF',
    '#FAF5FF',
    '#E9D5FF',
    '#C084FC',
    '#A855F7',
    '#9333EA',
    '#7C3AED',
    '#6D28D9',
  ];
  const color = colors[i % colors.length];

  // Fly diagonally from bottom-left to top-right
  const startX = -25 - (i * 0.9);
  const startY = 70 + ((i * 7) % 55);
  const endX = 115 + (i * 0.6);
  const endY = -25 + ((i * 7) % 55);

  const delayMs =
    wave === 0
      ? i * 28
      : wave === 1
      ? 220 + (i - 24) * 20
      : 600 + (i - 68) * 22;

  const durationSec = 1.75 + (i % 6) * 0.12;
  const scale = 0.55 + ((i * 13) % 10) * 0.085;
  const wingSpeedSec = 0.3 + (i % 4) * 0.04;
  const targetOpacity = color === '#FFFFFF' ? 1.0 : 0.88 + (i % 3) * 0.05;

  return {
    id: i,
    color,
    scale,
    startX: `${startX}vw`,
    startY: `${startY}vh`,
    endX: `${endX}vw`,
    endY: `${endY}vh`,
    durationSec,
    delayMs,
    wingSpeedSec,
    targetOpacity,
  };
});

export interface CraneDeliveryTransitionProps {
  onMidpoint?: () => void;
  onComplete: () => void;
}

export const CraneDeliveryTransition: React.FC<CraneDeliveryTransitionProps> = ({
  onMidpoint,
  onComplete,
}) => {
  const purpleLayerRef = useRef<HTMLDivElement | null>(null);
  const bloomLayerRef = useRef<HTMLDivElement | null>(null);

  const onMidpointRef = useRef(onMidpoint);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onMidpointRef.current = onMidpoint;
  }, [onMidpoint]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let animId: number;
    const purpleEl = purpleLayerRef.current;
    const bloomEl = bloomLayerRef.current;

    const startTime = performance.now();
    let midpointTriggered = false;

    // Timeline Configuration:
    // 0.0s - 0.2s: White screen
    // 0.2s - 2.8s: Cranes stream across from bottom-left to top-right
    // 0.5s - 2.2s: Screen covers with rich vibrant purple
    // 2.2s: onMidpoint() fires -> loads dashboard in background
    // 2.2s - 2.9s: 700ms solid purple hold so app mounts cleanly with zero jitter
    // 2.9s - 4.9s: Ultra-smooth, slow 2.0-second radial aperture fade from center
    // 5.0s: onComplete() cleans up

    const updateFrame = (currentTime: number) => {
      const elapsed = currentTime - startTime;

      // 1. Purple cover sweep (0.5s to 2.1s)
      if (purpleEl) {
        if (elapsed < 500) {
          purpleEl.style.opacity = '0';
        } else if (elapsed < 2100) {
          const coverProgress = Math.min(1.0, (elapsed - 500) / 1500);
          purpleEl.style.opacity = `${coverProgress}`;
        } else {
          purpleEl.style.opacity = '1';
        }
      }

      // 2. Midpoint callback at 2.2s (switches route while screen is 100% covered in purple)
      if (elapsed >= 2200 && !midpointTriggered) {
        midpointTriggered = true;
        if (onMidpointRef.current) {
          onMidpointRef.current();
        }
      }

      // 3. Jitter-free, slow 2.0-second radial aperture fade from middle (2.9s to 4.9s)
      if (elapsed >= 2900 && purpleEl) {
        const fadeElapsed = elapsed - 2900;
        const fadeTotal = 2000; // Slow, luxurious 2.0-second aperture fade
        const progress = Math.min(1.0, fadeElapsed / fadeTotal);

        // Ultra-smooth 4th-degree cubic ease-out for zero jitter
        const ease = 1 - Math.pow(1 - progress, 4);
        const radius = ease * 155;

        // Directly update DOM style on compositor thread (zero React state overhead!)
        const mask = `radial-gradient(circle at 50% 50%, transparent ${radius}%, black ${radius + 28}%)`;
        purpleEl.style.webkitMaskImage = mask;
        purpleEl.style.maskImage = mask;

        if (bloomEl) {
          bloomEl.style.opacity = `${Math.sin(progress * Math.PI) * 0.6}`;
          const bloomSize = Math.min(1000, radius * 8);
          bloomEl.style.width = `${bloomSize}px`;
          bloomEl.style.height = `${bloomSize}px`;
        }
      }

      // 4. Completion at 5.0s
      if (elapsed >= 5000) {
        cancelAnimationFrame(animId);
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
        return;
      }

      animId = requestAnimationFrame(updateFrame);
    };

    animId = requestAnimationFrame(updateFrame);

    // Hard fallback safety timeout
    const safetyTimer = setTimeout(() => {
      cancelAnimationFrame(animId);
      if (onCompleteRef.current) onCompleteRef.current();
    }, 5500);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden pointer-events-none select-none">
      {/* GPU Keyframes for Butter-Smooth 60 FPS Diagonal Flight, Wing Flap & Bag Sway */}
      <style>{`
        @keyframes diagonalFlockFly {
          0% {
            transform: translate3d(var(--start-x), var(--start-y), 0) scale(var(--crane-scale));
            opacity: 0;
          }
          8% {
            opacity: var(--target-opacity);
          }
          88% {
            opacity: var(--target-opacity);
          }
          100% {
            transform: translate3d(var(--end-x), var(--end-y), 0) scale(var(--crane-scale));
            opacity: 0;
          }
        }

        @keyframes silhouetteWingFlap {
          0%, 100% {
            transform: rotate(0deg);
          }
          50% {
            transform: rotate(-35deg);
          }
        }

        @keyframes silhouetteBagSway {
          0%, 100% {
            transform: rotate(-9deg);
          }
          50% {
            transform: rotate(11deg);
          }
        }
      `}</style>

      {/* 1. INITIAL CRISP WHITE SCREEN */}
      <div className="absolute inset-0 bg-white" />

      {/* 2. VIBRANT PURPLE LAYER: Zero-jitter direct compositor mask update */}
      <div
        ref={purpleLayerRef}
        className="absolute inset-0 will-change-[mask-image,opacity]"
        style={{
          background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 35%, #A855F7 65%, #581C87 100%)',
          opacity: 0,
        }}
      >
        {/* Soft Starlight Bloom radiating as the purple screen opens from the center */}
        <div
          ref={bloomLayerRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none opacity-0 transition-opacity"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(216,180,254,0.3) 50%, transparent 75%)',
            filter: 'blur(36px)',
          }}
        />
      </div>

      {/* 3. CLOUD OF 96 CRANES (Bottom-Left to Top-Right) */}
      {SILHOUETTE_CLOUD.map((crane) => (
        <div
          key={crane.id}
          className="absolute will-change-transform"
          style={
            {
              '--start-x': crane.startX,
              '--start-y': crane.startY,
              '--end-x': crane.endX,
              '--end-y': crane.endY,
              '--crane-scale': crane.scale,
              '--target-opacity': crane.targetOpacity,
              animation: `diagonalFlockFly ${crane.durationSec}s cubic-bezier(0.25, 1, 0.4, 1) ${crane.delayMs}ms forwards`,
              transformOrigin: 'center center',
            } as React.CSSProperties
          }
        >
          {/* 2D SILHOUETTE CRANE WITH MOVIE-STYLE CLOTH BABY SWADDLE BAG */}
          <svg
            viewBox="0 0 160 100"
            className="w-28 h-20 overflow-visible drop-shadow-sm"
            style={{
              color: crane.color,
              filter: crane.color === '#FFFFFF' ? 'drop-shadow(0 2px 6px rgba(124,58,237,0.3))' : 'none',
            }}
          >
            {/* Trailing Legs */}
            <path
              d="M 45 48 L 5 62 M 42 50 L 12 70"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            {/* Sleek Aerodynamic 2D Body Silhouette */}
            <path
              d="M 38 48 C 25 45 15 38 22 46 C 30 52 48 54 75 48 C 95 43 115 32 125 24 C 110 38 88 50 55 52 Z"
              fill="currentColor"
            />

            {/* Curved S-Neck and Head */}
            <path
              d="M 75 48 C 95 40 110 28 122 18 C 126 14 132 16 130 22 C 122 30 105 40 85 48 Z"
              fill="currentColor"
            />

            {/* Pointed Beak */}
            <path d="M 128 17 L 152 20 L 126 23 Z" fill="currentColor" />

            {/* CLOTH BABY SACK HANGING FROM BEAK (MOVIE STYLE) */}
            <g
              style={{
                transformOrigin: '136px 20px',
                animation: `silhouetteBagSway 0.9s ease-in-out infinite`,
              }}
            >
              {/* Tied Ribbon from Beak to Knot */}
              <path
                d="M 136 20 L 132 32"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Knot & Bow Ears */}
              <circle cx="132" cy="33" r="2.6" fill="currentColor" />
              <path d="M 132 33 C 125 28 119 31 126 36 Z" fill="currentColor" />
              <path d="M 132 33 C 139 28 145 31 138 36 Z" fill="currentColor" />

              {/* Swaddle Cloth Pouch Carrying Baby */}
              <path
                d="M 132 34 C 118 40 112 54 124 65 C 135 74 148 65 145 52 C 143 43 138 38 132 34 Z"
                fill="currentColor"
              />
            </g>

            {/* 2D OUTSTRETCHED FLAPPING WING */}
            <g
              style={{
                transformOrigin: '68px 48px',
                animation: `silhouetteWingFlap ${crane.wingSpeedSec}s ease-in-out infinite`,
              }}
            >
              <path
                d="M 65 48 C 75 24 96 6 128 0 C 112 18 96 34 78 48 Z"
                fill="currentColor"
              />
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
};

export default CraneDeliveryTransition;
