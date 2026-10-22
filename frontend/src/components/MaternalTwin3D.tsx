import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Sparkles, Activity, ShieldCheck, Eye, RefreshCw, HeartPulse } from 'lucide-react';

export interface MaternalTwin3DProps {
  gestationalAgeWeeks?: number;
  week?: number; // alias
  sbp?: number;
  dbp?: number;
  riskCategory?: 'LOW' | 'MODERATE' | 'HIGH' | 'INSUFFICIENT_DATA' | 'UNKNOWN';
  isSimulated?: boolean;
  interactive?: boolean;
  className?: string;
}

export const MaternalTwin3D: React.FC<MaternalTwin3DProps> = ({
  gestationalAgeWeeks,
  week,
  sbp = 120,
  dbp = 80,
  riskCategory = 'LOW',
  isSimulated = false,
  interactive = true,
  className = '',
}) => {
  const currentGA = week ?? gestationalAgeWeeks ?? 28.0;

  const mountRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [currentViewMode, setCurrentViewMode] = useState<'ANTERIOR' | 'LATERAL' | 'AXIAL'>('ANTERIOR');
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);

  const animFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const isHoveredRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const figureGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    isHoveredRef.current = isHovered;
  }, [isHovered]);

  const setViewPreset = useCallback((preset: 'ANTERIOR' | 'LATERAL' | 'AXIAL') => {
    setCurrentViewMode(preset);
    if (!figureGroupRef.current) return;
    if (preset === 'ANTERIOR') {
      figureGroupRef.current.rotation.y = 0;
      figureGroupRef.current.rotation.x = 0;
    } else if (preset === 'LATERAL') {
      figureGroupRef.current.rotation.y = Math.PI * 0.5;
      figureGroupRef.current.rotation.x = 0;
    } else if (preset === 'AXIAL') {
      figureGroupRef.current.rotation.y = Math.PI * 0.25;
      figureGroupRef.current.rotation.x = 0.12;
    }
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability safely
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 450;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    // Align camera with the maternal abdominal center of mass (~0.88m height)
    camera.position.set(0, 0.88, 2.75);
    camera.lookAt(0, 0.85, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Physiological Palette & Reactive Colors
    const isHighRisk = riskCategory === 'HIGH';
    const isModerateRisk = riskCategory === 'MODERATE';

    const glowColor = isSimulated
      ? new THREE.Color('#F59E0B') // Amber for counterfactual
      : isHighRisk
      ? new THREE.Color('#E11D48') // Rose-crimson for high risk
      : isModerateRisk
      ? new THREE.Color('#F59E0B') // Amber for moderate risk
      : new THREE.Color('#8B5CF6'); // Vibrant Amethyst for low risk

    const emissiveColor = isSimulated
      ? new THREE.Color('#D97706')
      : isHighRisk
      ? new THREE.Color('#BE123C')
      : new THREE.Color('#7C3AED');

    // High-Polish Subsurface Living Skin Material (Pearlescent Translucent Alabaster)
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#FAF5FF'),
      emissive: emissiveColor,
      emissiveIntensity: isHighRisk ? 0.22 : 0.08,
      metalness: 0.02,
      roughness: 0.28,
      clearcoat: 0.65,
      clearcoatRoughness: 0.12,
      transmission: 0.22,
      thickness: 1.0,
      ior: 1.46,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });

    // 3. Root Figure Group (centered at origin)
    const figureGroup = new THREE.Group();
    figureGroupRef.current = figureGroup;
    scene.add(figureGroup);

    // Calculate Gestational Age Progression (12w to 40w normalized)
    const gaClamped = Math.max(10, Math.min(42, currentGA));
    const gaProgress = Math.max(0, Math.min(1.0, (gaClamped - 12) / 28));
    const yFundus = 0.82 + gaProgress * 0.16; // Fundal height ascends with GA

    // 4. Studio Ground Contact Shadow Disc (grounds the figure naturally)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const shadowCtx = shadowCanvas.getContext('2d');
    if (shadowCtx) {
      const grad = shadowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(109, 40, 217, 0.28)');
      grad.addColorStop(0.5, 'rgba(124, 58, 237, 0.12)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      shadowCtx.fillStyle = grad;
      shadowCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(0.85, 0.85);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(0, 0.005, 0);
    figureGroup.add(shadowMesh);

    // 5. Internal Gravid Uterine Core (Physiological Fetal / Gestational Sac)
    // Spheroid expands from early pelvis up into the mid abdomen as GA advances
    const uterineRadius = 0.045 + gaProgress * 0.11;
    const uterineGeo = new THREE.SphereGeometry(uterineRadius, 36, 36);
    const uterineMat = new THREE.MeshPhysicalMaterial({
      color: glowColor,
      emissive: emissiveColor,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.05,
      clearcoat: 0.9,
      transmission: 0.45,
      transparent: true,
      opacity: 0.88,
    });
    const uterineMesh = new THREE.Mesh(uterineGeo, uterineMat);
    uterineMesh.position.set(0, yFundus - 0.04, 0.035 + gaProgress * 0.03);
    uterineMesh.scale.set(1.0, 1.15, 1.1);
    figureGroup.add(uterineMesh);

    // Inner Fetal Heart / Nucleus
    const fetalCoreGeo = new THREE.SphereGeometry(0.022 + gaProgress * 0.025, 20, 20);
    const fetalCoreMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const fetalCoreMesh = new THREE.Mesh(fetalCoreGeo, fetalCoreMat);
    fetalCoreMesh.position.copy(uterineMesh.position);
    figureGroup.add(fetalCoreMesh);

    // 6. Clinical Fundal Height Telemetry Plane & Orbit Ring
    const fundusRingRadius = 0.28 + gaProgress * 0.06;
    const fundusRingGeo = new THREE.RingGeometry(fundusRingRadius - 0.004, fundusRingRadius, 64);
    const fundusRingMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const fundusRingMesh = new THREE.Mesh(fundusRingGeo, fundusRingMat);
    fundusRingMesh.rotation.x = Math.PI / 2;
    fundusRingMesh.position.set(0, yFundus, 0.04);
    figureGroup.add(fundusRingMesh);

    // Telemetry Nodal Markers
    const markerNodes: THREE.Mesh[] = [];
    const markerColors = [0x9333ea, 0x7c3aed, 0xc084fc, 0x38bdf8];
    for (let k = 0; k < 4; k++) {
      const nodeGeo = new THREE.SphereGeometry(0.015, 16, 16);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: markerColors[k % markerColors.length],
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
      figureGroup.add(nodeMesh);
      markerNodes.push(nodeMesh);
    }

    // 7. High-Fidelity Continuous Parametric Fallback (Active while GLB loads or offline)
    // Seamless continuous anatomical female contour curve (no polygon capsules or seams)
    const splinePoints = [
      new THREE.Vector2(0.001, 1.63), // Crown of head
      new THREE.Vector2(0.075, 1.58), // Cranium
      new THREE.Vector2(0.065, 1.48), // Jaw / Chin
      new THREE.Vector2(0.048, 1.42), // Neck
      new THREE.Vector2(0.145, 1.34), // Clavicles / Shoulders
      new THREE.Vector2(0.135, 1.20), // Upper Chest
      new THREE.Vector2(0.118, 1.06), // Ribcage & Waist
      new THREE.Vector2(0.14 + gaProgress * 0.09, yFundus), // Gravid Abdomen / Fundus
      new THREE.Vector2(0.155, 0.76), // Hips / Pelvis
      new THREE.Vector2(0.125, 0.52), // Mid-Thigh
      new THREE.Vector2(0.078, 0.35), // Knee
      new THREE.Vector2(0.082, 0.20), // Calf
      new THREE.Vector2(0.048, 0.06), // Ankle
      new THREE.Vector2(0.001, 0.01), // Sole
    ];
    const anatomicalCurve = new THREE.SplineCurve(splinePoints);
    const smoothProfile = anatomicalCurve.getPoints(72);
    const fallbackGeo = new THREE.LatheGeometry(smoothProfile, 64);
    const fallbackMesh = new THREE.Mesh(fallbackGeo, bodyMaterial);
    fallbackMesh.name = 'maternal-fallback';
    figureGroup.add(fallbackMesh);

    // 8. Load Realistic 3D Model (`maternal-body.glb`)
    let loadedHumanMesh: THREE.SkinnedMesh | THREE.Mesh | null = null;
    let originalPositions: Float32Array | null = null;

    const loader = new GLTFLoader();
    loader.load(
      '/models/maternal-body.glb',
      (gltf) => {
        // Find LOD0 (the highest-detail, ultra-smooth mesh with 7463 vertices)
        let lod0Mesh: THREE.SkinnedMesh | null = null;

        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.name === 'adult-female-LOD0') {
              lod0Mesh = mesh as THREE.SkinnedMesh;
              mesh.material = bodyMaterial;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            } else {
              // Hide low-poly LOD variants (LOD1..LOD4)
              mesh.visible = false;
            }
          }
        });

        if (lod0Mesh) {
          const targetMesh = lod0Mesh as THREE.SkinnedMesh;
          loadedHumanMesh = targetMesh;

          // Store original baseline vertex positions for non-destructive dynamic pregnancy morphing
          const posAttr = targetMesh.geometry.attributes.position;
          originalPositions = new Float32Array(posAttr.array);

          // Apply natural anatomical gravid displacement to the smooth human mesh
          const arr = posAttr.array as Float32Array;
          const forwardProjection = gaProgress * 0.088; // Anatomical anterior expansion
          const lateralSpread = gaProgress * 0.028;

          for (let i = 0; i < posAttr.count; i++) {
            const origX = originalPositions[i * 3];
            const origY = originalPositions[i * 3 + 1];
            const origZ = originalPositions[i * 3 + 2];

            // Target the anterior abdominal quadrant (between pubic brim and lower ribcage)
            if (origZ > 0.01 && origY > 0.68 && origY < 1.15 && Math.abs(origX) < 0.18) {
              const normX = origX / 0.13;
              const normY = (origY - yFundus) / 0.16;
              const r2 = normX * normX + normY * normY;
              if (r2 < 2.5) {
                const falloff = Math.exp(-r2 * 0.85);
                arr[i * 3 + 2] = origZ + forwardProjection * falloff;
                arr[i * 3] = origX * (1.0 + lateralSpread * falloff * (1.0 - normY * 0.25));
              } else {
                arr[i * 3] = origX;
                arr[i * 3 + 2] = origZ;
              }
            } else {
              arr[i * 3] = origX;
              arr[i * 3 + 2] = origZ;
            }
            arr[i * 3 + 1] = origY;
          }
          posAttr.needsUpdate = true;
          targetMesh.geometry.computeVertexNormals();

          // Modulate morph target influences for natural maternal fullness
          if (targetMesh.morphTargetInfluences && targetMesh.morphTargetInfluences.length > 2) {
            targetMesh.morphTargetInfluences[2] = Math.min(0.55, gaProgress * 0.38);
          }

          // Replace fallback with the loaded high-detail human model
          figureGroup.remove(fallbackMesh);
          fallbackGeo.dispose();

          // Add the realistic rigged character model
          figureGroup.add(gltf.scene);
          setIsModelLoaded(true);
        }
      },
      undefined,
      (err) => {
        // Fallback is already actively displaying, log gracefully
        console.warn('3D GLB model fetch fallback engaged:', err);
      }
    );

    // 9. Studio Lighting System
    // Soft Lavender Ambient Light
    const ambientLight = new THREE.AmbientLight(0xf5f3ff, 0.85);
    scene.add(ambientLight);

    // Key Light: Clinical White (Upper Right)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2.2, 3.2, 2.5);
    scene.add(keyLight);

    // Fill Light: Soft Violet (Left)
    const fillLight = new THREE.DirectionalLight(0xddd6fe, 0.75);
    fillLight.position.set(-2.5, 1.8, 1.2);
    scene.add(fillLight);

    // Rim Light: Ethereal Contour Halo (Behind Shoulders)
    const rimLight = new THREE.DirectionalLight(0xc084fc, 0.95);
    rimLight.position.set(0, 2.5, -2.5);
    scene.add(rimLight);

    // Internal Abdominal Glow Light (Casts living bioluminescence outward through skin)
    const bellyPointLight = new THREE.PointLight(glowColor.getHex(), 1.4, 2.8);
    bellyPointLight.position.copy(uterineMesh.position);
    figureGroup.add(bellyPointLight);

    // 10. Smooth Pointer Interaction Handlers
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!interactive) return;
      isDraggingRef.current = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevMouseRef.current = { x: clientX, y: clientY };
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !interactive) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevMouseRef.current.x;
      const deltaY = clientY - prevMouseRef.current.y;

      figureGroup.rotation.y += deltaX * 0.009;
      const newPitch = figureGroup.rotation.x + deltaY * 0.004;
      figureGroup.rotation.x = Math.max(-0.25, Math.min(0.25, newPitch));

      prevMouseRef.current = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onPointerDown);
    domElement.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    // 11. Biological Animation Loop
    let lastTime = performance.now();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // Gentle auto-rotation when idle
      if (!isHoveredRef.current && !isDraggingRef.current) {
        figureGroup.rotation.y += delta * 0.14;
      }

      // Natural subtle maternal respiratory rhythm (14 breaths/min ≈ 1.47 rad/s)
      const breath = Math.sin(now * 0.00147) * 0.007;
      uterineMesh.scale.set(1.0 + breath * 0.6, 1.15 + breath * 0.4, 1.1 + breath * 1.0);

      // Cardiovascular pulse synced to blood pressure
      const pulseRate = sbp > 140 ? 3.6 : 2.2;
      const pulseFactor = 1.0 + Math.sin(now * 0.001 * pulseRate) * 0.07;
      fetalCoreMesh.scale.set(pulseFactor, pulseFactor, pulseFactor);

      // Fundus telemetry rotation
      fundusRingMesh.rotation.z += delta * 0.25;

      // Orbit marker telemetry nodes around the maternal abdominal plane
      markerNodes.forEach((node, idx) => {
        const angle = now * 0.00085 + (idx * (Math.PI * 2)) / markerNodes.length;
        const radius = fundusRingRadius * 1.08 + Math.sin(now * 0.001 + idx) * 0.02;
        node.position.x = Math.cos(angle) * radius;
        node.position.z = 0.04 + Math.sin(angle) * radius;
        node.position.y = yFundus + Math.sin(now * 0.0015 + idx) * 0.03;
      });

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', onPointerDown);
      domElement.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);

      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      uterineGeo.dispose();
      uterineMat.dispose();
      fetalCoreGeo.dispose();
      fetalCoreMat.dispose();
      fundusRingGeo.dispose();
      fundusRingMat.dispose();
      bodyMaterial.dispose();
      fallbackGeo.dispose();
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [currentGA, sbp, dbp, riskCategory, isSimulated, interactive]);

  // Fallback if WebGL is unavailable
  if (!webglSupported) {
    return (
      <div className={`p-6 flex flex-col items-center justify-center text-center bg-white/80 rounded-2xl border border-purple-200/80 ${className}`}>
        <Activity className="w-10 h-10 text-purple-600 mb-2 animate-pulse" />
        <h3 className="text-base font-bold text-slate-900">Maternal Twin Telemetry</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          WebGL acceleration unavailable. Displaying 2D calibrated schematic.
        </p>
        <div className="mt-4 px-4 py-2 rounded-xl bg-purple-50 text-purple-800 font-mono text-xs font-semibold">
          {currentGA.toFixed(1)}w GA &bull; {sbp}/{dbp} mmHg
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none overflow-hidden group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={mountRef}
        className="w-full h-full min-h-[380px] cursor-grab active:cursor-grabbing"
        title="Click and drag to rotate the realistic 3D maternal digital twin"
      />

      {/* Floating Gestational & Clinical Status HUD */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 border border-purple-200/80 shadow-[0_4px_16px_rgba(124,58,237,0.08)] backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
          <span className="text-xs font-mono font-bold text-purple-950">
            {currentGA.toFixed(1)} WEEKS GA
          </span>
          <span className="text-[10px] text-purple-600 font-semibold border-l border-purple-200 pl-2">
            Fundal ~{Math.round(currentGA)} cm
          </span>
        </div>

        {isSimulated && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold backdrop-blur-md shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Counterfactual Simulation
          </div>
        )}

        {isModelLoaded && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50/90 border border-purple-200/60 text-[10px] font-medium text-purple-700 backdrop-blur-sm">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            High-Fidelity Anatomical Mesh
          </div>
        )}
      </div>

      {/* Hemodynamic HUD */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-xl bg-white/95 border border-purple-200/80 text-right backdrop-blur-md shadow-[0_4px_16px_rgba(124,58,237,0.08)]">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Hemodynamics</span>
          <p className="text-sm font-extrabold tabular-nums font-mono text-purple-950 flex items-center justify-end gap-1">
            <HeartPulse className={`w-3.5 h-3.5 ${sbp > 140 ? 'text-rose-500 animate-pulse' : 'text-purple-600'}`} />
            {sbp}/{dbp} <span className="text-[10px] font-medium text-slate-500">mmHg</span>
          </p>
        </div>
      </div>

      {/* Perspective Preset Controls */}
      <div className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-1 p-1 bg-white/95 border border-purple-200/80 rounded-2xl shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => setViewPreset('ANTERIOR')}
            className={`px-3 py-1 text-xs rounded-xl font-semibold transition-all ${
              currentViewMode === 'ANTERIOR'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
            }`}
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={() => setViewPreset('LATERAL')}
            className={`px-3 py-1 text-xs rounded-xl font-semibold transition-all ${
              currentViewMode === 'LATERAL'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
            }`}
          >
            Lateral Profile
          </button>
          <button
            type="button"
            onClick={() => setViewPreset('AXIAL')}
            className={`px-3 py-1 text-xs rounded-xl font-semibold transition-all ${
              currentViewMode === 'AXIAL'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
            }`}
          >
            Telemetry Orbit
          </button>
        </div>
      </div>

      {/* Subtle Interaction Hint */}
      <div className="absolute bottom-12 text-[10px] text-slate-400 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/80 px-2 py-0.5 rounded-full border border-purple-100">
        <Activity className="w-3 h-3 text-purple-600" />
        Drag to rotate &bull; Hover to pause
      </div>
    </div>
  );
};

export default MaternalTwin3D;
