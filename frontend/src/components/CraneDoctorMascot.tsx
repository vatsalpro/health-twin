import React from 'react';

export type MascotExpression = 'friendly' | 'caring' | 'attentive' | 'alert' | 'encouraging';
export type MascotState = 'idle' | 'speaking' | 'thinking' | 'alert';

interface CraneDoctorMascotProps {
  expression?: MascotExpression;
  state?: MascotState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBadge?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export const CraneDoctorMascot: React.FC<CraneDoctorMascotProps> = ({
  expression = 'friendly',
  state = 'idle',
  size = 'md',
  className = '',
  showBadge = true,
  interactive = false,
  onClick,
}) => {
  // Dimension mapping
  const sizeMap = {
    sm: { width: 48, height: 48, badgeText: 'text-[9px]' },
    md: { width: 96, height: 96, badgeText: 'text-[11px]' },
    lg: { width: 140, height: 140, badgeText: 'text-xs' },
    xl: { width: 200, height: 200, badgeText: 'text-sm' },
  };

  const { width, height } = sizeMap[size];

  // Expression-based eye & eyebrow rendering
  const renderEyes = () => {
    switch (expression) {
      case 'alert':
        return (
          <g>
            {/* Worried / focused alert eyebrows */}
            <path d="M 64 56 Q 72 61 78 59" stroke="#581C87" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 86 59 Q 92 61 100 56" stroke="#581C87" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            {/* Wide alert eyes */}
            <ellipse cx="72" cy="67" rx="5.5" ry="6" fill="#1E1B4B" />
            <ellipse cx="92" cy="67" rx="5.5" ry="6" fill="#1E1B4B" />
            <circle cx="70" cy="65" r="2" fill="#FFFFFF" />
            <circle cx="90" cy="65" r="2" fill="#FFFFFF" />
          </g>
        );
      case 'caring':
      case 'encouraging':
        return (
          <g>
            {/* Gentle happy eye arcs */}
            <path d="M 66 68 Q 72 62 78 68" stroke="#1E1B4B" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M 86 68 Q 92 62 98 68" stroke="#1E1B4B" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Rosy cheeks */}
            <ellipse cx="64" cy="74" rx="4" ry="2.5" fill="#F472B6" fillOpacity="0.5" />
            <ellipse cx="100" cy="74" rx="4" ry="2.5" fill="#F472B6" fillOpacity="0.5" />
          </g>
        );
      case 'attentive':
        return (
          <g>
            {/* Attentive listening eyes with upper brow curve */}
            <path d="M 66 58 Q 72 56 78 57" stroke="#6B21A8" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M 86 57 Q 92 56 98 58" stroke="#6B21A8" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="72" cy="67" r="4.8" fill="#1E1B4B" />
            <circle cx="92" cy="67" r="4.8" fill="#1E1B4B" />
            <circle cx="70.5" cy="65" r="1.8" fill="#FFFFFF" />
            <circle cx="90.5" cy="65" r="1.8" fill="#FFFFFF" />
          </g>
        );
      case 'friendly':
      default:
        return (
          <g>
            {/* Friendly sparkling eyes */}
            <circle cx="72" cy="67" r="4.5" fill="#1E1B4B" />
            <circle cx="92" cy="67" r="4.5" fill="#1E1B4B" />
            <circle cx="70.5" cy="65" r="1.8" fill="#FFFFFF" />
            <circle cx="90.5" cy="65" r="1.8" fill="#FFFFFF" />
            <circle cx="73.5" cy="68.5" r="0.9" fill="#FFFFFF" />
            <circle cx="93.5" cy="68.5" r="0.9" fill="#FFFFFF" />
          </g>
        );
    }
  };

  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking';
  const isAlert = state === 'alert' || expression === 'alert';

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col items-center justify-center relative select-none ${
        interactive ? 'cursor-pointer group hover:scale-105 transition-transform' : ''
      } ${className}`}
    >
      <div className={`relative ${isSpeaking ? 'animate-wing-flutter' : 'animate-mascot-bob'}`}>
        <svg
          width={width}
          height={height}
          viewBox="0 0 160 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible drop-shadow-[0_8px_16px_rgba(124,58,237,0.12)]"
        >
          <defs>
            {/* Crane plumage gradients */}
            <linearGradient id="bodyPlumage" x1="80" y1="30" x2="80" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.85" stopColor="#F5F3FF" />
              <stop offset="1" stopColor="#E9D5FF" />
            </linearGradient>

            <linearGradient id="wingGradient" x1="30" y1="90" x2="130" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.6" stopColor="#E9D5FF" />
              <stop offset="1" stopColor="#9333EA" />
            </linearGradient>

            <linearGradient id="coatGradient" x1="50" y1="95" x2="110" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="0.9" stopColor="#F8FAFC" />
              <stop offset="1" stopColor="#E2E8F0" />
            </linearGradient>

            <linearGradient id="stethoscopeGrad" x1="60" y1="90" x2="100" y2="135" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7C3AED" />
              <stop offset="1" stopColor="#4C1D95" />
            </linearGradient>

            <linearGradient id="bagGrad" x1="120" y1="110" x2="155" y2="150" gradientUnits="userSpaceOnUse">
              <stop stopColor="#9333EA" />
              <stop offset="1" stopColor="#6B21A8" />
            </linearGradient>

            {/* Soft shadow filter */}
            <filter id="craneShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#7C3AED" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Halo / Aura for state */}
          {isAlert ? (
            <circle cx="82" cy="80" r="68" fill="#FEE2E2" fillOpacity="0.6" className="animate-pulse" />
          ) : (
            <circle cx="82" cy="80" r="64" fill="#F5F3FF" fillOpacity="0.5" />
          )}

          {/* 1. Tail Feathers & Wing Tips (Silhouette purple accents) */}
          <path
            d="M 38 128 C 30 134, 25 146, 20 152 C 28 147, 36 143, 44 142 Z"
            fill="#7C3AED"
            fillOpacity="0.85"
          />
          <path
            d="M 44 135 C 38 143, 34 150, 30 156 C 40 152, 48 147, 54 144 Z"
            fill="#9333EA"
          />

          {/* 2. Crane Torso & Head Foundation */}
          {/* Slender graceful neck & round friendly head */}
          <path
            d="M 72 105 C 72 88, 70 70, 70 60 C 70 42, 78 32, 84 32 C 90 32, 98 42, 98 60 C 98 70, 96 88, 96 105 Z"
            fill="url(#bodyPlumage)"
          />
          <circle cx="84" cy="56" r="22" fill="url(#bodyPlumage)" filter="url(#craneShadow)" />

          {/* Japanese Red-Crowned Crest (Cute small coral-red cap) */}
          <path
            d="M 77 35 Q 84 30 91 35 Q 84 38 77 35 Z"
            fill="#EF4444"
          />
          <circle cx="84" cy="35" r="4.5" fill="#DC2626" />

          {/* 3. Eyes & Expressions */}
          {renderEyes()}

          {/* 4. Elegant Amber Beak */}
          <path
            d="M 80 72 L 84 84 L 88 72 Z"
            fill="#F59E0B"
            stroke="#D97706"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          {/* Mouth crease - opens if speaking */}
          {isSpeaking ? (
            <path d="M 82 76 Q 84 80 86 76" stroke="#92400E" strokeWidth="1.2" fill="#78350F" />
          ) : (
            <line x1="82" y1="74" x2="86" y2="74" stroke="#B45309" strokeWidth="0.9" />
          )}

          {/* 5. Doctor's Crisp White Lab Coat */}
          {/* Main body of coat */}
          <path
            d="M 60 102 C 60 98, 108 98, 108 102 L 116 150 C 116 154, 52 154, 52 150 Z"
            fill="url(#coatGradient)"
            stroke="#E2E8F0"
            strokeWidth="1.2"
          />
          {/* V-Neck Lapels */}
          <path
            d="M 66 102 L 84 122 L 68 132 L 64 105 Z"
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth="0.8"
          />
          <path
            d="M 102 102 L 84 122 L 100 132 L 104 105 Z"
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth="0.8"
          />
          {/* Coat Buttons & Seam */}
          <line x1="84" y1="122" x2="84" y2="150" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 2" />
          <circle cx="84" cy="130" r="1.5" fill="#7C3AED" />
          <circle cx="84" cy="138" r="1.5" fill="#7C3AED" />
          <circle cx="84" cy="145" r="1.5" fill="#7C3AED" />

          {/* Coat Pocket with Mini Stethoscope Tip or Pen */}
          <rect x="66" y="132" width="10" height="11" rx="1.5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.8" />
          <line x1="69" y1="130" x2="69" y2="135" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="72" y1="129" x2="72" y2="135" stroke="#059669" strokeWidth="1.2" strokeLinecap="round" />

          {/* Miniature Doctor ID Badge on Lapel */}
          <rect x="94" y="125" width="8" height="6" rx="1" fill="#7C3AED" />
          <rect x="95" y="127" width="6" height="3" rx="0.5" fill="#FFFFFF" />

          {/* 6. Medical Stethoscope */}
          {/* Tubing looping gently around neck */}
          <path
            d="M 72 95 C 68 108, 70 125, 80 131 C 82 132, 86 132, 88 131"
            stroke="url(#stethoscopeGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Stethoscope Chest Piece / Bell */}
          <circle cx="84" cy="132" r="4.5" fill="#E2E8F0" stroke="#64748B" strokeWidth="1" />
          <circle cx="84" cy="132" r="2.5" fill="#7C3AED" />

          {/* 7. Crane Wings folded like arms */}
          {/* Left Wing (patient view) */}
          <path
            d="M 52 105 C 44 116, 46 135, 54 144 C 58 138, 59 122, 60 108 Z"
            fill="url(#wingGradient)"
            stroke="#CBD5E1"
            strokeWidth="0.8"
          />
          {/* Right Wing resting on medical bag */}
          <path
            d="M 116 105 C 124 116, 122 135, 114 144 C 110 138, 109 122, 108 108 Z"
            fill="url(#wingGradient)"
            stroke="#CBD5E1"
            strokeWidth="0.8"
          />

          {/* 8. Classic Doctor's Gladstone Bag */}
          <g className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]">
            {/* Bag Handle */}
            <path
              d="M 132 122 Q 137 116 142 122"
              stroke="#581C87"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            {/* Bag Body */}
            <rect
              x="125"
              y="122"
              width="24"
              height="20"
              rx="4"
              fill="url(#bagGrad)"
              stroke="#581C87"
              strokeWidth="1.2"
            />
            {/* Vintage Brass Clasp */}
            <rect x="135" y="121" width="4" height="3" rx="0.8" fill="#FBBF24" />
            {/* Medical Cross Emblem */}
            <circle cx="137" cy="132" r="5" fill="#FFFFFF" />
            <rect x="134.5" y="130" width="5" height="4" fill="#DC2626" />
            <rect x="135" y="129.5" width="4" height="5" fill="#DC2626" />
          </g>

          {/* 9. Interactive Speaking / Thinking Bubble Indicator */}
          {isThinking && (
            <g className="animate-pulse">
              <circle cx="118" cy="46" r="3" fill="#A855F7" />
              <circle cx="126" cy="38" r="4.5" fill="#9333EA" />
              <circle cx="136" cy="28" r="7" fill="#7C3AED" />
              <text x="136" y="31" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">...</text>
            </g>
          )}

          {isAlert && (
            <g className="animate-bounce">
              <circle cx="120" cy="36" r="8" fill="#DC2626" />
              <text x="120" y="40" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="extrabold">!</text>
            </g>
          )}
        </svg>
      </div>

      {/* Optional Name & Role Badge below Mascot */}
      {showBadge && (
        <div className="mt-1 text-center">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/80 border border-purple-200/80 shadow-2xs backdrop-blur-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`font-bold text-purple-950 ${sizeMap[size].badgeText}`}>
              Dr. Crane, MD
            </span>
            <span className="text-[9px] text-purple-600 font-medium">AI Clinician</span>
          </div>
        </div>
      )}
    </div>
  );
};
