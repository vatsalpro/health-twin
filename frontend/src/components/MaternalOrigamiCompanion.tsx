import React, { useState } from 'react';
import { Sparkles, Heart, ChevronLeft, ChevronRight } from 'lucide-react';

interface MaternalOrigamiCompanionProps {
  className?: string;
}

export const MaternalOrigamiCompanion: React.FC<MaternalOrigamiCompanionProps> = ({
  className = '',
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative select-none pointer-events-auto transition-all duration-300 z-30 ${
        collapsed ? 'w-10' : 'w-72'
      } ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Dynamic Keyframes for Arm Lift, Origami Descent, and Perching */}
      <style>{`
        /* Arm and Hand Gracefully Lifting Upwards */
        @keyframes armLiftingGraceful {
          0%, 100% {
            transform: rotate(-8deg);
          }
          20% {
            transform: rotate(4deg);
          }
          45%, 85% {
            transform: rotate(6deg);
          }
        }

        /* 2D Origami Crane Flight: Glides down from top-right and lands on hand */
        @keyframes origamiFlightPath {
          0% {
            transform: translate3d(85px, -65px, 0) scale(0.65) rotate(-18deg);
            opacity: 0;
          }
          15% {
            opacity: 1;
            transform: translate3d(60px, -40px, 0) scale(0.8) rotate(-12deg);
          }
          35% {
            transform: translate3d(25px, -15px, 0) scale(0.95) rotate(-6deg);
          }
          50%, 82% {
            /* Landed firmly and perching gently on the open hand */
            transform: translate3d(0px, 0px, 0) scale(1.0) rotate(0deg);
            opacity: 1;
          }
          92% {
            /* Gentle liftoff flutter */
            transform: translate3d(15px, -20px, 0) scale(0.9) rotate(-10deg);
            opacity: 0.8;
          }
          100% {
            transform: translate3d(45px, -50px, 0) scale(0.7) rotate(-16deg);
            opacity: 0;
          }
        }

        /* Origami Folded Wing Flap Cycle */
        @keyframes origamiWingFoldCycle {
          0%, 100% {
            transform: scaleY(1.0) rotate(0deg);
          }
          25% {
            transform: scaleY(0.4) rotate(14deg);
          }
          50% {
            transform: scaleY(1.0) rotate(0deg);
          }
          75% {
            transform: scaleY(0.4) rotate(-12deg);
          }
        }

        /* Starlight Pulse upon Landing */
        @keyframes landingSparkleBloom {
          0%, 48%, 88%, 100% {
            opacity: 0;
            transform: scale(0.5);
          }
          52%, 80% {
            opacity: 0.9;
            transform: scale(1.1);
          }
        }

        /* Gentle Maternal Breathing of the Profile */
        @keyframes womanGentleBreath {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-2.5px);
          }
        }
      `}</style>

      {/* Main Glassmorphic Container Card (Right where sidebar ends) */}
      <div className="relative rounded-3xl bg-gradient-to-b from-white/90 via-purple-50/70 to-white/90 backdrop-blur-xl border border-purple-200/90 shadow-[0_8px_25px_rgba(124,58,237,0.08)] p-3 overflow-hidden">
        
        {/* Toggle Collapse Button on top edge */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-2.5 right-2.5 w-6 h-6 rounded-lg bg-purple-100/80 hover:bg-purple-200/80 text-purple-700 flex items-center justify-center transition-all cursor-pointer z-20"
          title={collapsed ? 'Expand Origami Companion' : 'Minimize Companion'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {collapsed ? (
          <div className="py-6 flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={() => setCollapsed(false)}>
            <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-purple-800 [writing-mode:vertical-lr] rotate-180">
              Origami Companion
            </span>
          </div>
        ) : (
          <div>
            {/* Header Caption */}
            <div className="flex items-center gap-2 mb-1 px-1">
              <div className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-purple-600 animate-pulse" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-950 block leading-tight">
                  Maternal Grace &bull; Origami Crane
                </span>
                <span className="text-[9px] text-purple-600 font-medium">
                  Symbol of safe delivery &amp; peaceful recovery
                </span>
              </div>
            </div>

            {/* ARTWORK CANVAS: 2D Purple Woman in Side Profile & Descending Origami Crane */}
            <div className="relative w-full aspect-[4/3] rounded-2xl bg-gradient-to-tr from-purple-100/50 via-white to-violet-50/60 border border-purple-100/80 overflow-hidden flex items-center justify-center">
              
              {/* Soft Ambient Radiance in Background */}
              <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full bg-purple-200/40 blur-2xl pointer-events-none" />

              <svg
                viewBox="0 0 280 210"
                className="w-full h-full overflow-visible"
              >
                <defs>
                  {/* Woman Silhouette Purple Gradient */}
                  <linearGradient id="womanPurpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#9333EA" />
                    <stop offset="50%" stop-color="#7C3AED" />
                    <stop offset="100%" stop-color="#581C87" />
                  </linearGradient>

                  {/* Soft Skin Shadow in Profile */}
                  <linearGradient id="profileFaceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#7C3AED" />
                    <stop offset="70%" stop-color="#A855F7" />
                    <stop offset="100%" stop-color="#C084FC" />
                  </linearGradient>

                  {/* Origami Paper Crane Facets (Folded Crease Highlights) */}
                  <linearGradient id="origamiPaper1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FFFFFF" />
                    <stop offset="100%" stop-color="#EDE9FE" />
                  </linearGradient>
                  <linearGradient id="origamiPaper2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#FAF5FF" />
                    <stop offset="100%" stop-color="#DDD6FE" />
                  </linearGradient>
                  <linearGradient id="origamiGoldAccent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#FEF08A" />
                    <stop offset="100%" stop-color="#F59E0B" />
                  </linearGradient>

                  <filter id="softPurpleGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#7C3AED" flood-opacity="0.18" />
                  </filter>
                </defs>

                {/* WOMAN IN SIDE PROFILE (Looking toward Right) */}
                <g style={{ animation: 'womanGentleBreath 4.5s ease-in-out infinite' }} filter="url(#softPurpleGlow)">
                  {/* Flowing Hair Silhouette / Chignon Bun Behind */}
                  <path
                    d="M 28 65 C 10 95 12 145 35 185 C 48 180 52 150 48 120 C 42 85 40 70 28 65 Z"
                    fill="#4C1D95"
                    opacity="0.85"
                  />
                  <ellipse cx="38" cy="95" rx="18" ry="24" transform="rotate(-15 38 95)" fill="#581C87" />

                  {/* Upper Torso & Shoulder Base */}
                  <path
                    d="M 35 185 C 55 178 85 182 110 205 L 125 210 L 20 210 Z"
                    fill="url(#womanPurpleGrad)"
                  />

                  {/* Back of Neck */}
                  <path
                    d="M 52 120 C 50 145 55 170 65 190"
                    stroke="#6D28D9"
                    strokeWidth="3"
                    fill="none"
                  />

                  {/* Delicate Side Profile Face & Throat */}
                  {/* Forehead -> Nose -> Lips -> Chin -> Neck -> Collarbone */}
                  <path
                    d="M 72 52 
                       C 88 56 102 70 106 84 
                       L 116 98 
                       L 109 104 
                       C 112 108 111 113 107 116 
                       C 111 122 108 128 101 130 
                       C 95 132 86 138 88 152 
                       C 90 166 98 182 106 195 
                       L 80 195 
                       C 72 175 66 150 64 128 
                       C 62 105 60 75 72 52 Z"
                    fill="url(#profileFaceGrad)"
                  />

                  {/* Elegant Eyelashes in Profile (Closed / Peaceful Smile) */}
                  <path
                    d="M 98 84 Q 103 89 106 85"
                    fill="none"
                    stroke="#4C1D95"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  {/* Soft Rosy Cheek Tint */}
                  <ellipse cx="92" cy="98" rx="8" ry="4" transform="rotate(-10 92 98)" fill="#F472B6" opacity="0.35" />

                  {/* Delicate Lips Arc */}
                  <path
                    d="M 104 109 Q 108 111 111 108"
                    fill="none"
                    stroke="#581C87"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />

                  {/* Crown Hair Sweep */}
                  <path
                    d="M 70 50 C 50 55 35 75 42 105 C 50 90 62 72 80 65 C 92 60 98 62 102 68 C 102 55 88 45 70 50 Z"
                    fill="#3B0764"
                  />

                  {/* Graceful Hair Tendril Framing Jaw */}
                  <path
                    d="M 68 75 C 72 95 70 120 74 135"
                    fill="none"
                    stroke="#581C87"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>

                {/* ANIMATED ARM AND HAND (Lifting to catch the origami crane) */}
                <g style={{ transformOrigin: '80px 190px', animation: 'armLiftingGraceful 6s cubic-bezier(0.35, 1, 0.4, 1) infinite' }}>
                  {/* Upper Arm & Forearm Sweeping Gracefully to the Right */}
                  <path
                    d="M 80 185 
                       C 105 178 135 170 160 155 
                       C 168 150 178 142 188 132 
                       C 184 140 172 152 158 162 
                       C 132 180 102 192 80 195 Z"
                    fill="url(#womanPurpleGrad)"
                  />

                  {/* Open Delicate Hand & Outstretched Fingers (Palm Facing Upward) */}
                  <path
                    d="M 188 132 
                       C 194 126 200 120 206 116 
                       C 207 118 203 124 198 128 
                       C 205 124 212 118 215 116 
                       C 215 119 208 126 202 131 
                       C 208 128 214 124 216 123 
                       C 215 126 209 132 201 136 
                       C 192 142 182 145 174 146 Z"
                    fill="url(#profileFaceGrad)"
                  />

                  {/* LANDING SPARKS / AURA (Fires when crane lands on palm at ~2.8s) */}
                  <g transform="translate(202, 116)" style={{ animation: 'landingSparkleBloom 6s ease-in-out infinite' }}>
                    <circle cx="0" cy="0" r="14" fill="#C084FC" opacity="0.3" filter="blur(4px)" />
                    <circle cx="0" cy="0" r="3.5" fill="#FEF08A" />
                    {/* Tiny Starlight Rays */}
                    <path d="M 0 -8 L 0 8 M -8 0 L 8 0" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M -5 -5 L 5 5 M -5 5 L 5 -5" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
                  </g>
                </g>

                {/* THE 2D ORIGAMI CRANE BIRD (Glides down from top-right and lands on hand) */}
                <g style={{ transformOrigin: '202px 116px', animation: 'origamiFlightPath 6s cubic-bezier(0.22, 1, 0.36, 1) infinite' }}>
                  <g transform="translate(182, 92) scale(0.85)">
                    {/* Folded Paper Origami Body Facets */}
                    {/* Lower Body Triangle */}
                    <polygon points="24,28 36,44 4,36" fill="url(#origamiPaper2)" stroke="#C084FC" strokeWidth="0.8" />
                    {/* Central Fold Spine */}
                    <polygon points="24,28 44,22 36,44" fill="url(#origamiPaper1)" stroke="#A855F7" strokeWidth="0.8" />
                    
                    {/* Pointed Geometric Origami Tail */}
                    <polygon points="4,36 14,28 -12,20" fill="url(#origamiPaper2)" stroke="#C084FC" strokeWidth="0.8" />

                    {/* Angular Neck and Sharp Beak */}
                    <polygon points="24,28 36,12 44,22" fill="url(#origamiPaper1)" stroke="#A855F7" strokeWidth="0.8" />
                    <polygon points="36,12 48,2 40,16" fill="url(#origamiGoldAccent)" stroke="#D97706" strokeWidth="0.7" />

                    {/* Left Wing (Geometric Origami Wing Flapping) */}
                    <g style={{ transformOrigin: '24px 28px', animation: 'origamiWingFoldCycle 0.5s ease-in-out infinite' }}>
                      <polygon points="24,28 10,-8 34,6" fill="url(#origamiPaper1)" stroke="#C084FC" strokeWidth="0.8" />
                      <polygon points="10,-8 22,-20 34,6" fill="#FFFFFF" stroke="#A855F7" strokeWidth="0.7" />
                    </g>

                    {/* Right Wing (Folded Facet) */}
                    <polygon points="24,28 38,-4 46,14" fill="url(#origamiPaper2)" opacity="0.9" stroke="#9333EA" strokeWidth="0.7" />

                    {/* Paper Fold Crease Line */}
                    <line x1="24" y1="28" x2="22" y2="-20" stroke="#DDD6FE" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
                  </g>
                </g>
              </svg>
            </div>

            {/* Footer Poetic Quote */}
            <div className="mt-2.5 px-2 py-1.5 rounded-xl bg-purple-50/80 border border-purple-100 flex items-center justify-between text-[10px]">
              <span className="text-purple-900 font-medium italic truncate">
                "May each pregnancy unfold in gentle peace."
              </span>
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500 shrink-0 ml-1.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaternalOrigamiCompanion;
