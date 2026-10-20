import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Activity, ShieldCheck, AlertCircle, RefreshCw, Eye, Sparkles } from 'lucide-react';

interface MaternalTwin3DProps {
  gestationalAgeWeeks?: number;
  sbp?: number;
  dbp?: number;
  riskCategory?: 'LOW' | 'MODERATE' | 'HIGH' | 'INSUFFICIENT_DATA' | 'UNKNOWN';
  isSimulated?: boolean;
  interactive?: boolean;
  className?: string;
}

// --- Shader A: Ambient Physiological Field (Multi-scale Organic Noise & Wave Field) ---
const ambientFieldVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    // Low-amplitude organic wave displacement
    vec3 pos = position;
    float wave = sin(pos.y * 3.0 + uTime * 0.8) * cos(pos.x * 3.0 + uTime * 0.6) * 0.04;
    pos += normal * wave;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const ambientFieldFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform vec3 uColorBase;
  uniform vec3 uColorAccent;
  uniform float uRiskFactor;

  void main() {
    // Multi-scale procedural noise / interference patterns
    float n1 = sin(vPosition.y * 8.0 + uTime * 0.6 + sin(vPosition.x * 6.0));
    float n2 = cos(vPosition.x * 12.0 - uTime * 0.9 + cos(vPosition.z * 10.0));
    float noise = (n1 + n2) * 0.25 + 0.5;
    
    // Fresnel rim light for ethereal biological luminescence
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
    
    // Dynamic blend based on physiological risk state
    vec3 col = mix(uColorBase, uColorAccent, noise * 0.7 + fresnel * 0.6);
    
    // If elevated risk, introduce subtle warm/amber warning glow into the rim
    if (uRiskFactor > 0.5) {
      col = mix(col, vec3(0.95, 0.4, 0.3), (uRiskFactor - 0.5) * fresnel * 1.2);
    }
    
    float alpha = clamp(fresnel * 0.85 + 0.15, 0.0, 0.95);
    gl_FragColor = vec4(col, alpha);
  }
`;

// --- Shader B: Data-Reactive Signal Ring Field ---
const signalRingVertexShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uPulseSpeed;
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Radial pulsing reactive to blood pressure / heart rhythm
    float pulse = sin(uTime * uPulseSpeed) * 0.03;
    pos.x *= (1.0 + pulse);
    pos.z *= (1.0 + pulse);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const signalRingFragmentShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uSignalColor;
  
  void main() {
    // Angular energy beam rotation around maternal axis
    float beam = sin(vUv.x * 6.28318 - uTime * 2.5) * 0.5 + 0.5;
    beam = pow(beam, 4.0);
    
    float alpha = beam * (1.0 - abs(vUv.y - 0.5) * 2.0) * 0.9;
    gl_FragColor = vec4(uSignalColor, alpha);
  }
`;

export const MaternalTwin3D: React.FC<MaternalTwin3DProps> = ({
  gestationalAgeWeeks = 28.0,
  sbp = 120,
  dbp = 80,
  riskCategory = 'LOW',
  isSimulated = false,
  interactive = true,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [currentViewMode, setCurrentViewMode] = useState<'ANTERIOR' | 'LATERAL' | 'AXIAL'>('ANTERIOR');
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Uniforms & Materials
    const riskFactor = riskCategory === 'HIGH' ? 0.9 : riskCategory === 'MODERATE' ? 0.5 : 0.1;
    const baseColor = new THREE.Color(0x0c1e3d); // Deep indigo
    const accentColor = isSimulated
      ? new THREE.Color(0xe9b96e) // Amber for simulation
      : riskCategory === 'HIGH'
      ? new THREE.Color(0xf43f5e) // Rose for alert
      : new THREE.Color(0x5be7e8); // Cyan signal

    const ambientMaterial = new THREE.ShaderMaterial({
      vertexShader: ambientFieldVertexShader,
      fragmentShader: ambientFieldFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uColorBase: { value: baseColor },
        uColorAccent: { value: accentColor },
        uRiskFactor: { value: riskFactor },
      },
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const signalMaterial = new THREE.ShaderMaterial({
      vertexShader: signalRingVertexShader,
      fragmentShader: signalRingFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uPulseSpeed: { value: 3.0 + (sbp > 140 ? 2.5 : 0.0) }, // Faster pulse if hypertensive
        uSignalColor: { value: accentColor },
      },
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // 3. Construct Stylized Anatomical Maternal Twin Form
    const twinGroup = new THREE.Group();
    scene.add(twinGroup);

    // Maternal Torso Silhouette Form
    const torsoGeo = new THREE.CylinderGeometry(0.55, 0.72, 1.8, 48, 32, true);
    // Deform torso to represent maternal profile gracefully
    const posAttr = torsoGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      // Gentle anterior abdominal curve scaling with gestational age progression (20w - 40w)
      const gestationScale = Math.min(1.4, Math.max(0.9, gestationalAgeWeeks / 28.0));
      if (z > 0 && y < 0.2 && y > -0.7) {
        const factor = Math.cos((y + 0.25) * 3.14) * 0.45 * gestationScale;
        posAttr.setZ(i, z + factor);
      }
    }
    torsoGeo.computeVertexNormals();
    const torsoMesh = new THREE.Mesh(torsoGeo, ambientMaterial);
    twinGroup.add(torsoMesh);

    // Inner Core Luminous Gestational Progression Sphere
    const gestSize = 0.22 + (gestationalAgeWeeks / 40.0) * 0.16;
    const coreGeo = new THREE.SphereGeometry(gestSize, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(0, -0.22, 0.25 * (gestationalAgeWeeks / 30.0));
    twinGroup.add(coreMesh);

    // Telemetry Orbital Signal Rings
    const ringGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.08, 64, 1, true);
    const ringMesh1 = new THREE.Mesh(ringGeo, signalMaterial);
    ringMesh1.position.y = -0.22;
    ringMesh1.rotation.x = 0.12;
    twinGroup.add(ringMesh1);

    const ringMesh2 = new THREE.Mesh(ringGeo, signalMaterial);
    ringMesh2.scale.set(1.15, 1.15, 1.15);
    ringMesh2.position.y = -0.05;
    ringMesh2.rotation.z = -0.15;
    twinGroup.add(ringMesh2);

    // Orbital Telemetry Marker Nodes
    const markerNodes: THREE.Mesh[] = [];
    const markerColors = [0x5be7e8, 0x628bff, 0x43d6b0, 0xe9b96e];
    for (let k = 0; k < 5; k++) {
      const nodeGeo = new THREE.SphereGeometry(0.045, 16, 16);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: markerColors[k % markerColors.length],
        transparent: true,
        opacity: 0.9,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      twinGroup.add(nodeMesh);
      markerNodes.push(nodeMesh);
    }

    // Organic Particle Field
    const particleCount = 240;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePositions[p] = (Math.random() - 0.5) * 3.5;
      particlePositions[p + 1] = (Math.random() - 0.5) * 3.2;
      particlePositions[p + 2] = (Math.random() - 0.5) * 3.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x5be7e8,
      size: 0.03,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Mouse interaction rotation
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (!interactive) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !interactive) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      twinGroup.rotation.y += deltaX * 0.008;
      twinGroup.rotation.x += deltaY * 0.008;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Update shader uniforms
      ambientMaterial.uniforms.uTime.value = elapsedTime;
      signalMaterial.uniforms.uTime.value = elapsedTime;

      // Gentle idling rotation if not dragged
      if (!isDragging) {
        twinGroup.rotation.y = Math.sin(elapsedTime * 0.3) * 0.28;
      }

      // Pulse core sphere
      const pulseCore = 1.0 + Math.sin(elapsedTime * (sbp > 140 ? 3.8 : 2.2)) * 0.05;
      coreMesh.scale.set(pulseCore, pulseCore, pulseCore);

      // Orbit marker nodes
      markerNodes.forEach((node, idx) => {
        const angle = elapsedTime * 0.8 + (idx * (Math.PI * 2) / markerNodes.length);
        const radius = 1.1 + Math.sin(elapsedTime + idx) * 0.15;
        node.position.x = Math.cos(angle) * radius;
        node.position.z = Math.sin(angle) * radius;
        node.position.y = -0.3 + Math.sin(elapsedTime * 1.5 + idx) * 0.25;
      });

      // Slowly float particles
      particles.rotation.y = elapsedTime * 0.04;

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup resources on unmount
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      torsoGeo.dispose();
      ambientMaterial.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ringGeo.dispose();
      signalMaterial.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [gestationalAgeWeeks, sbp, dbp, riskCategory, isSimulated, interactive]);

  // Fallback if WebGL unavailable or disabled
  if (!webglSupported) {
    return (
      <div className={`glass-panel p-6 flex flex-col items-center justify-center text-center ${className}`}>
        <AlertCircle className="w-12 h-12 text-[#5BE7E8] mb-3 animate-pulse" />
        <h3 className="text-lg font-semibold text-[#F4F7FC]">Maternal Twin Schematic Fallback</h3>
        <p className="text-sm text-[#A5B3C8] max-w-sm mt-1">
          WebGL acceleration unavailable on this device. Displaying standard vector telemetry.
        </p>
        <div className="mt-6 w-48 h-64 border-2 border-[#5BE7E8]/30 rounded-full flex items-center justify-center relative overflow-hidden bg-[#0B1220]/80">
          <div className="absolute inset-x-4 bottom-8 top-16 border border-[#5BE7E8]/40 rounded-full flex flex-col items-center justify-center">
            <span className="text-xs font-mono text-[#5BE7E8]">{gestationalAgeWeeks}w GA</span>
            <span className="text-xs text-[#A5B3C8] mt-1">{sbp}/{dbp} mmHg</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center justify-center select-none overflow-hidden ${className}`}>
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-full min-h-[420px] cursor-grab active:cursor-grabbing" />

      {/* Floating Telemetry HUD Overlays */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#070B14]/85 border border-[#5BE7E8]/30 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-[#5BE7E8] animate-ping" />
          <span className="text-xs font-mono font-medium text-[#F4F7FC]">
            LIVING TWIN: {gestationalAgeWeeks.toFixed(1)} WEEKS
          </span>
        </div>

        {isSimulated && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9B96E]/20 border border-[#E9B96E]/40 text-[#E9B96E] text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Hypothetical What-If Scenario
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-lg bg-[#070B14]/80 border border-[rgba(166,190,220,0.14)] text-right backdrop-blur-md">
          <span className="text-[10px] uppercase font-mono tracking-wider text-[#A5B3C8]">Hemodynamics</span>
          <p className="text-sm font-semibold tabular-nums text-[#F4F7FC]">
            {sbp}/{dbp} <span className="text-xs font-normal text-[#A5B3C8]">mmHg</span>
          </p>
        </div>
      </div>

      {/* Camera & Rotation Presets */}
      <div className="absolute bottom-4 inset-x-0 flex justify-center items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-1 p-1 bg-[#0B1220]/90 border border-[rgba(166,190,220,0.18)] rounded-xl backdrop-blur-md">
          <button
            onClick={() => setCurrentViewMode('ANTERIOR')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              currentViewMode === 'ANTERIOR' ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30' : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
            }`}
          >
            Anterior
          </button>
          <button
            onClick={() => setCurrentViewMode('LATERAL')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              currentViewMode === 'LATERAL' ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30' : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
            }`}
          >
            Lateral Profile
          </button>
          <button
            onClick={() => setCurrentViewMode('AXIAL')}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              currentViewMode === 'AXIAL' ? 'bg-[#5BE7E8]/20 text-[#5BE7E8] border border-[#5BE7E8]/30' : 'text-[#A5B3C8] hover:text-[#F4F7FC]'
            }`}
          >
            Telemetry Orbit
          </button>
        </div>
      </div>
    </div>
  );
};
