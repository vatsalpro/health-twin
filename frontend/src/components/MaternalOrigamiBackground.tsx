import React, { useState } from 'react';
import { Sparkles, EyeOff } from 'lucide-react';

interface MaternalOrigamiBackgroundProps {
  className?: string;
}

export const MaternalOrigamiBackground: React.FC<MaternalOrigamiBackgroundProps> = ({
  className = '',
}) => {
  // Vibrancy modes: 'vivid' (rich, bold violet artwork) | 'soft' (gentle translucent) | 'hidden'
  const [vibrancy, setVibrancy] = useState<'vivid' | 'soft' | 'hidden'>('vivid');

  if (vibrancy === 'hidden') {
    return (
      <div className="fixed bottom-3 right-4 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={() => setVibrancy('vivid')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 hover:bg-purple-50 text-purple-700 text-[10px] font-semibold border border-purple-200/80 shadow-md backdrop-blur-md transition-all cursor-pointer"
          title="Restore Maternal Origami Background Art"
        >
          <Sparkles className="w-3 h-3 text-purple-600" />
          <span>Show Background Art</span>
        </button>
      </div>
    );
  }

  const opacityClass = vibrancy === 'vivid' ? 'opacity-100' : 'opacity-60';

  return (
    <div
      className={`fixed inset-y-0 right-0 left-0 md:left-68 top-16 pointer-events-none z-0 overflow-hidden select-none transition-opacity duration-500 ${opacityClass} ${className}`}
      aria-hidden="true"
    >
      {/* Dynamic Keyframe Animations for Smooth Arm Motion, Flight Path, Wings & Starlight */}
      <style>{`
        /* 1. Arm and Open Hand Graceful Breathing & Lift Cycle (8s) */
        @keyframes maternalHandLiftBreath {
          0%, 100% {
            transform: translate(0px, 0px) rotate(0deg);
          }
          25% {
            transform: translate(-2px, -3px) rotate(-1deg);
          }
          45% {
            transform: translate(-4px, -8px) rotate(-2.5deg);
          }
          58%, 84% {
            /* Hand lifted gracefully to receive and cradle the landing crane */
            transform: translate(-4px, -8px) rotate(-2.5deg);
          }
          92% {
            transform: translate(-1px, -2px) rotate(-0.5deg);
          }
        }

        /* 2. 2D Origami Crane Flight Path (8s) */
        @keyframes origamiCraneFlightPath {
          0% {
            /* High at top-right of the viewport */
            transform: translate(700px, -340px) scale(0.62) rotate(-22deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translate(560px, -270px) scale(0.72) rotate(-18deg);
          }
          28% {
            transform: translate(360px, -170px) scale(0.85) rotate(-13deg);
          }
          44% {
            transform: translate(160px, -80px) scale(0.95) rotate(-7deg);
          }
          54% {
            transform: translate(30px, -15px) scale(1.0) rotate(-2deg);
          }
          58%, 84% {
            /* LANDED AND PERCHED IN LOCKSTEP WITH HER HAND! */
            transform: translate(-4px, -8px) scale(1.0) rotate(0deg);
            opacity: 1;
          }
          88% {
            /* Pre-liftoff flutter */
            transform: translate(15px, -25px) scale(0.97) rotate(-6deg);
            opacity: 0.95;
          }
          94% {
            transform: translate(150px, -130px) scale(0.82) rotate(-16deg);
            opacity: 0.65;
          }
          100% {
            transform: translate(320px, -240px) scale(0.66) rotate(-22deg);
            opacity: 0;
          }
        }

        /* 3. Origami Wing 8-Second Cycle: Flaps in flight, folds & rests when perched, flutters on liftoff */
        @keyframes origamiWing8sCycle {
          /* Flight down from sky: flapping */
          0%, 6%, 12%, 18%, 24%, 30%, 36%, 42%, 48% {
            transform: scaleY(1.0) rotate(0deg);
          }
          3%, 9%, 15%, 21%, 27%, 33%, 39%, 45%, 51% {
            transform: scaleY(0.35) rotate(16deg);
          }
          /* Touchdown & Wing Fold: 54% to 56% */
          54% {
            transform: scaleY(0.7) rotate(6deg);
          }
          56%, 84% {
            /* FOLDED & PEACEFULLY RESTING ON HER PALM */
            transform: scaleY(1.0) rotate(0deg);
          }
          /* Pre-flight flutter */
          86% {
            transform: scaleY(0.4) rotate(14deg);
          }
          88% {
            transform: scaleY(1.0) rotate(0deg);
          }
          /* Liftoff flapping */
          91%, 97% {
            transform: scaleY(0.35) rotate(16deg);
          }
          94%, 100% {
            transform: scaleY(1.0) rotate(0deg);
          }
        }

        /* 4. Golden Starlight Bloom upon Landing (Synchronized at -4px, -8px) */
        @keyframes landingSparkleBloomBig {
          0%, 54%, 87%, 100% {
            opacity: 0;
            transform: translate(0px, 0px) scale(0.3);
          }
          58% {
            opacity: 1;
            transform: translate(-4px, -8px) scale(1.4);
          }
          64%, 82% {
            opacity: 0.8;
            transform: translate(-4px, -8px) scale(1.1);
          }
        }

        /* 5. Gentle Maternal Torso & Profile Breath */
        @keyframes maternalGentleBreath {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        /* 6. Soft Ambient Particles Floating */
        @keyframes ambientFloatParticle {
          0% {
            transform: translateY(0px) translateX(0px);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-20px) translateX(10px);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-40px) translateX(-5px);
            opacity: 0.1;
          }
        }
      `}</style>

      {/* BIG BACKGROUND SVG CANVAS */}
      <svg
        viewBox="0 0 1400 900"
        preserveAspectRatio="xMinYMax meet"
        className="w-full h-full overflow-visible"
      >
        <defs>
          {/* Main Violet & Purple Silhouette Gradient */}
          <linearGradient id="bgWomanSilhouetteGrad" x1="0%" y1="100%" x2="60%" y2="0%">
            <stop offset="0%" stopColor="#4C1D95" stopOpacity="1.0" />
            <stop offset="35%" stopColor="#6D28D9" stopOpacity="0.98" />
            <stop offset="70%" stopColor="#7C3AED" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#9333EA" stopOpacity="0.92" />
          </linearGradient>

          {/* Delicate Profile Face & Hand Gradient */}
          <linearGradient id="bgWomanProfileGrad" x1="0%" y1="0%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="1.0" />
            <stop offset="50%" stopColor="#9333EA" stopOpacity="0.95" />
            <stop offset="85%" stopColor="#A855F7" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#C084FC" stopOpacity="0.88" />
          </linearGradient>

          {/* Hair & Crown Shadow Gradient */}
          <linearGradient id="bgWomanHairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2E1065" stopOpacity="1.0" />
            <stop offset="60%" stopColor="#3B0764" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#581C87" stopOpacity="0.95" />
          </linearGradient>

          {/* Origami Paper Crane Facets (Crisp White & Lavender Creases) */}
          <linearGradient id="bgOrigamiFacetWhite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#F5F3FF" stopOpacity="0.92" />
          </linearGradient>

          <linearGradient id="bgOrigamiFacetLavender" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#EDE9FE" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#DDD6FE" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="bgOrigamiFacetPurple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#A855F7" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id="bgOrigamiGoldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="1" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.95" />
          </linearGradient>

          {/* Soft Luminescence Filter */}
          <filter id="bgSoftPurpleGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="bgSubtleShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#7C3AED" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* BACKGROUND AMBIENT GLOW AURAS */}
        <g opacity="0.85">
          {/* Large soft aura behind woman */}
          <circle cx="260" cy="500" r="340" fill="#9333EA" opacity="0.25" filter="blur(65px)" />
          {/* Soft aura around hand landing zone */}
          <circle cx="640" cy="400" r="220" fill="#C084FC" opacity="0.3" filter="blur(50px)" />
          {/* Soft sky radiance */}
          <circle cx="1000" cy="200" r="320" fill="#A855F7" opacity="0.22" filter="blur(75px)" />
        </g>

        {/* ETHEREAL CONSTELLATION & ORIGAMI FOLD CREASE GUIDES IN BACKGROUND */}
        <g stroke="#C084FC" strokeWidth="1" strokeDasharray="3 4" opacity="0.22">
          {/* Subtle geometric diagonal arcs guiding gaze */}
          <path d="M 1200 80 Q 900 240 640 400" fill="none" />
          <path d="M 640 400 L 400 320" fill="none" />
          <path d="M 640 400 L 520 600" fill="none" />
          <circle cx="640" cy="400" r="4" fill="#A855F7" />
          <circle cx="950" cy="210" r="3" fill="#C084FC" />
          <circle cx="1200" cy="80" r="3.5" fill="#DDD6FE" />
        </g>

        {/* 2D PURPLE WOMAN IN SIDE PROFILE (Located on the Left where sidebar ends) */}
        <g
          filter="url(#bgSubtleShadow)"
          style={{ animation: 'maternalGentleBreath 6s ease-in-out infinite' }}
        >
          {/* Lower Torso, Chest & Shoulder Base (Rising from the Bottom Left) */}
          <path
            d="M 0 900 
               L 420 900 
               C 390 760 360 660 310 590 
               C 280 550 240 520 200 500 
               L 160 520 
               C 100 600 40 730 0 900 Z"
            fill="url(#bgWomanSilhouetteGrad)"
          />

          {/* Graceful Chignon Bun & Flowing Hair Behind Head */}
          <path
            d="M 170 200 
               C 90 190 30 270 50 360 
               C 65 420 120 460 170 420 
               C 160 380 150 310 170 200 Z"
            fill="url(#bgWomanHairGrad)"
          />
          <ellipse cx="110" cy="330" rx="42" ry="54" transform="rotate(-15 110 330)" fill="#2E1065" opacity="0.95" />

          {/* Back of Neck Column */}
          <path
            d="M 160 380 C 150 440 160 500 185 550"
            stroke="#581C87"
            strokeWidth="5"
            fill="none"
            opacity="0.8"
          />

          {/* HEAD & SERENE SIDE PROFILE FACE (Looking to the Right toward Main App) */}
          {/* True anatomical profile: Forehead -> Brow -> Nose -> Lips -> Chin -> Throat */}
          <path
            d="M 170 170 
               C 230 170 270 200 282 235 
               C 288 250 295 260 302 268 
               L 338 290 
               L 316 304 
               C 326 310 330 316 324 324 
               C 318 328 314 330 320 336 
               C 328 340 326 348 318 354 
               C 314 358 324 372 326 384 
               C 324 400 304 414 284 420 
               C 278 445 274 485 280 535 
               C 285 565 305 585 330 605 
               L 260 610 
               C 220 560 200 500 195 440 
               C 190 380 180 300 170 170 Z"
            fill="url(#bgWomanProfileGrad)"
          />

          {/* Hair Framing the Face & Temple */}
          <path
            d="M 170 170 C 220 170 255 195 270 230 C 245 235 220 260 210 300 C 190 280 185 240 170 170 Z"
            fill="#3B0764"
          />

          {/* Peaceful Eyelash in Profile (Gentle Closed Eye Smiling) */}
          <path
            d="M 288 254 Q 300 259 308 253"
            fill="none"
            stroke="#3B0764"
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Soft Feminine Cheek Tint */}
          <ellipse
            cx="270"
            cy="310"
            rx="24"
            ry="14"
            transform="rotate(-10 270 310)"
            fill="#F472B6"
            opacity="0.38"
            filter="blur(6px)"
          />

          {/* Contoured Lips Arc */}
          <path
            d="M 318 328 Q 324 331 330 326"
            fill="none"
            stroke="#581C87"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Delicate Tendril of Hair along Neck */}
          <path
            d="M 185 380 C 195 430 190 480 200 510"
            fill="none"
            stroke="#581C87"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.75"
          />
        </g>

        {/* ANIMATED ARM AND OUTSTRETCHED HAND (Lifting to catch the origami crane) */}
        <g
          filter="url(#bgSubtleShadow)"
          style={{
            transformOrigin: '320px 600px',
            animation: 'maternalHandLiftBreath 8s cubic-bezier(0.35, 1, 0.4, 1) infinite',
          }}
        >
          {/* Upper Arm & Forearm Sweeping Gracefully Across */}
          <path
            d="M 320 600 
               C 380 590 440 560 500 520 
               C 535 495 570 465 600 435 
               C 585 455 550 485 515 515 
               C 455 565 390 605 320 615 Z"
            fill="url(#bgWomanSilhouetteGrad)"
          />

          {/* Open Delicate Hand & Outstretched Fingers (Palm Facing Upward at (640, 400)) */}
          <path
            d="M 600 435 
               C 612 422 626 410 642 400 
               C 656 392 670 386 684 380 
               C 684 384 670 395 658 404 
               C 672 396 686 388 694 384 
               C 692 390 678 402 666 410 
               C 678 404 690 396 695 394 
               C 692 400 680 412 664 420 
               C 645 430 622 438 600 442 Z"
            fill="url(#bgWomanProfileGrad)"
          />

          {/* GOLDEN STARLIGHT BLOOM / AURA (Blooms when crane lands on palm at ~4.6s) */}
          <g
            transform="translate(640, 400)"
            style={{ animation: 'landingSparkleBloomBig 8s ease-in-out infinite' }}
          >
            {/* Soft Radial Glow */}
            <circle cx="0" cy="0" r="38" fill="#C084FC" opacity="0.35" filter="blur(8px)" />
            <circle cx="0" cy="0" r="16" fill="#FEF08A" opacity="0.8" filter="blur(4px)" />
            <circle cx="0" cy="0" r="6" fill="#FFFFFF" />

            {/* Radiant Sparkle Beams */}
            <path
              d="M 0 -24 L 0 24 M -24 0 L 24 0"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M -14 -14 L 14 14 M -14 14 L 14 -14"
              stroke="#FEF08A"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* THE 2D ORIGAMI CRANE BIRD (Glides down from top-right and lands on woman's hand) */}
        <g
          style={{
            transformOrigin: '640px 400px',
            animation: 'origamiCraneFlightPath 8s cubic-bezier(0.25, 1, 0.35, 1) infinite',
          }}
        >
          {/* Centered at (640, 400) when landed */}
          <g transform="translate(640, 400) scale(1.65)">
            {/* ORIGAMI PAPER CRANE FACETS */}
            
            {/* Lower Body Paper Triangle */}
            <polygon
              points="0,0 24,18 -18,12"
              fill="url(#bgOrigamiFacetLavender)"
              stroke="#A855F7"
              strokeWidth="0.8"
            />

            {/* Central Fold Paper Spine */}
            <polygon
              points="0,0 28,-14 24,18"
              fill="url(#bgOrigamiFacetWhite)"
              stroke="#7C3AED"
              strokeWidth="0.8"
            />

            {/* Sharp Folded Paper Tail */}
            <polygon
              points="-18,12 -42,4 -10,0"
              fill="url(#bgOrigamiFacetLavender)"
              stroke="#C084FC"
              strokeWidth="0.8"
            />

            {/* Angular Origami Neck */}
            <polygon
              points="0,0 28,-14 20,-36"
              fill="url(#bgOrigamiFacetWhite)"
              stroke="#9333EA"
              strokeWidth="0.8"
            />

            {/* Crisp Golden Folded Beak */}
            <polygon
              points="20,-36 36,-48 28,-30"
              fill="url(#bgOrigamiGoldAccent)"
              stroke="#D97706"
              strokeWidth="0.7"
            />

            {/* Left Origami Wing (Synchronized 8s Flap & Fold Cycle) */}
            <g
              style={{
                transformOrigin: '0px 0px',
                animation: 'origamiWing8sCycle 8s ease-in-out infinite',
              }}
            >
              <polygon
                points="0,0 -16,-34 22,-10"
                fill="url(#bgOrigamiFacetWhite)"
                stroke="#C084FC"
                strokeWidth="0.8"
              />
              <polygon
                points="-16,-34 4,-54 22,-10"
                fill="#FFFFFF"
                stroke="#A855F7"
                strokeWidth="0.7"
              />
              {/* Paper Fold Crease Line */}
              <line
                x1="0"
                y1="0"
                x2="4"
                y2="-54"
                stroke="#DDD6FE"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
            </g>

            {/* Right Folded Wing Behind Body */}
            <polygon
              points="0,0 26,-24 34,8"
              fill="url(#bgOrigamiFacetPurple)"
              opacity="0.9"
              stroke="#7C3AED"
              strokeWidth="0.7"
            />

            {/* Spine Crease Line */}
            <line
              x1="-18"
              y1="12"
              x2="28"
              y2="-14"
              stroke="#C084FC"
              strokeWidth="0.8"
              strokeDasharray="1.5 1.5"
            />
          </g>
        </g>

        {/* FLOATING STARDUST PARTICLES */}
        <g opacity="0.45">
          <circle cx="580" cy="460" r="2" fill="#FEF08A" style={{ animation: 'ambientFloatParticle 5s ease-in-out infinite' }} />
          <circle cx="710" cy="360" r="2.5" fill="#E9D5FF" style={{ animation: 'ambientFloatParticle 6s ease-in-out 1s infinite' }} />
          <circle cx="650" cy="320" r="1.8" fill="#FFFFFF" style={{ animation: 'ambientFloatParticle 4.5s ease-in-out 2s infinite' }} />
          <circle cx="480" cy="420" r="2.2" fill="#C084FC" style={{ animation: 'ambientFloatParticle 7s ease-in-out 1.5s infinite' }} />
        </g>
      </svg>

      {/* Sleek, Unobtrusive Floating Vibrancy Control in bottom right */}
      <div className="fixed bottom-3 right-4 z-30 pointer-events-auto flex items-center gap-1.5 p-1 rounded-full bg-white/80 hover:bg-white border border-purple-200/80 shadow-md backdrop-blur-md transition-all text-[10px]">
        <span className="pl-2 pr-1 text-purple-900 font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
          <span>Art</span>
        </span>
        <button
          type="button"
          onClick={() => setVibrancy(vibrancy === 'vivid' ? 'soft' : 'vivid')}
          className={`px-2 py-0.5 rounded-full font-semibold transition-all cursor-pointer ${
            vibrancy === 'vivid'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'bg-purple-100/70 text-purple-700 hover:bg-purple-200/70'
          }`}
          title={vibrancy === 'vivid' ? 'Switch to Soft opacity' : 'Switch to Vivid opacity'}
        >
          {vibrancy === 'vivid' ? 'Vivid' : 'Soft'}
        </button>
        <button
          type="button"
          onClick={() => setVibrancy('hidden')}
          className="p-1 rounded-full text-slate-400 hover:text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer"
          title="Hide background art"
        >
          <EyeOff className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default MaternalOrigamiBackground;
