import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { REGIONS } from "../data/regions";

/**
 * The 3D world of the loading screen and the story intro: five floating lands above a sea of
 * clouds, each with its glowing crystal; the box ghost hero; dice; slime monsters and a boss;
 * storm clouds with lightning; sparkles, light rays and floating rocks, all run through a glow
 * (bloom) pass. Everything is built from code, like the rest of the game's art.
 */

/** Crystal colours of the five lands (Sunny Meadow, Golden Fields, Misty Forest, Sunset Dunes, Frost Peak). */
export const LAND_COLORS = REGIONS.map((r) => r.crystal);
/** Dice colours from common to rare. */
export const DICE_COLORS = [0xd8e0e8, 0x6fd25a, 0x4fa8ff, 0xb36aff, 0xffb02e, 0xff4f5e];

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A soft round light, for sparkles and glows. */
const dotTexture = () =>
  canvasTex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.8)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });

/** A puffy cloud made of soft blobs, brighter on top. */
const cloudTexture = () =>
  canvasTex(256, 160, (c) => {
    for (let i = 0; i < 26; i++) {
      const x = 40 + Math.random() * 176;
      const y = 62 + Math.random() * 46;
      const r = 24 + Math.random() * 40;
      const g = c.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.6)");
      g.addColorStop(0.6, "rgba(235,235,250,0.35)");
      g.addColorStop(1, "rgba(220,220,240,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 256, 160);
    }
  });

/** A jagged lightning bolt with a glow. */
const boltTexture = () =>
  canvasTex(128, 512, (c) => {
    const pts: [number, number][] = [[64, 0]];
    for (let y = 40; y <= 512; y += 40) pts.push([64 + (Math.random() - 0.5) * 70, y]);
    for (const [w, a] of [[24, 0.22], [11, 0.6], [4, 1]] as [number, number][]) {
      c.strokeStyle = `rgba(235,225,255,${a})`;
      c.lineWidth = w;
      c.lineJoin = "round";
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
    }
  });

/** A beam of light: bright at the top, fading out downwards and at the edges. */
const rayTexture = () =>
  canvasTex(64, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,240,200,0.9)");
    g.addColorStop(1, "rgba(255,240,200,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 256);
    const e = c.createLinearGradient(0, 0, 64, 0);
    e.addColorStop(0, "rgba(0,0,0,1)");
    e.addColorStop(0.3, "rgba(0,0,0,0)");
    e.addColorStop(0.7, "rgba(0,0,0,0)");
    e.addColorStop(1, "rgba(0,0,0,1)");
    c.globalCompositeOperation = "destination-out";
    c.fillStyle = e;
    c.fillRect(0, 0, 64, 256);
  });

/** Cardboard with fibres and packing tape; the front also has "this side up" arrows. */
const cardboardTexture = (front: boolean) =>
  canvasTex(256, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#f0c88c");
    g.addColorStop(1, "#c08a4a");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(${Math.random() < 0.5 ? "90,55,25" : "255,225,170"},${0.05 + Math.random() * 0.08})`;
      c.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 30, 1 + Math.random() * 2);
    }
    c.fillStyle = "rgba(120,70,25,0.28)";
    c.fillRect(100, 0, 46, 256);
    if (!front) return;
    c.strokeStyle = "rgba(70,36,12,0.5)";
    c.lineWidth = 7;
    c.lineCap = "round";
    for (const x of [44, 212]) {
      c.beginPath();
      c.moveTo(x, 236);
      c.lineTo(x, 196);
      c.moveTo(x - 12, 208);
      c.lineTo(x, 194);
      c.lineTo(x + 12, 208);
      c.stroke();
    }
  });

/** A die face with 1-6 pips (white, tinted by the material colour). */
const faceTexture = (n: number) =>
  canvasTex(128, 128, (c) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 128, 128);
    const at: Record<number, [number, number][]> = {
      1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]],
      5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]],
    };
    c.fillStyle = "#2a1c14";
    for (const [x, y] of at[n]) {
      c.beginPath();
      c.arc(x, y, n === 1 ? 16 : 12, 0, Math.PI * 2);
      c.fill();
    }
  });

const grassTexture = () =>
  canvasTex(256, 256, (c) => {
    c.fillStyle = "#8fd06a";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      c.fillStyle = Math.random() < 0.5 ? "rgba(70,150,55,0.45)" : "rgba(190,240,150,0.45)";
      c.fillRect(Math.random() * 256, Math.random() * 256, 2, 3 + Math.random() * 4);
    }
  });

/** The look of the sky and the light, blended between moods (day, storm, night, dawn). */
export interface Mood {
  top: number;
  horizon: number;
  bottom: number;
  sun: number;
  sunGlow: number;
  fog: number;
  fogDensity: number;
  hemi: number;
  light: number;
  lightColor: number;
  storm: number;
  stars: number;
  cloudSea: number;
}

export const MOODS: Record<"day" | "storm" | "night" | "dawn", Mood> = {
  day: {
    top: 0x2f78e0, horizon: 0xffc09a, bottom: 0xc89ad0, sun: 0xfff0c0, sunGlow: 1, fog: 0xf8c8b0, fogDensity: 0.008,
    hemi: 1.0, light: 2.2, lightColor: 0xffe2b8, storm: 0, stars: 0, cloudSea: 0xe4c8e0,
  },
  storm: {
    top: 0x0c0720, horizon: 0x3a1f52, bottom: 0x160b28, sun: 0x6a4a9a, sunGlow: 0, fog: 0x231537, fogDensity: 0.02,
    hemi: 0.4, light: 0.55, lightColor: 0x8a9aff, storm: 1, stars: 0, cloudSea: 0x4a3a6a,
  },
  night: {
    top: 0x070a22, horizon: 0x2a2352, bottom: 0x0d0b20, sun: 0x9ab0ff, sunGlow: 0.25, fog: 0x1a1a34, fogDensity: 0.015,
    hemi: 0.45, light: 0.7, lightColor: 0x9ab0ff, storm: 0, stars: 1, cloudSea: 0x3c3c66,
  },
  dawn: {
    top: 0x1d2a6a, horizon: 0xff9a6a, bottom: 0x6a4a8a, sun: 0xffb070, sunGlow: 0.8, fog: 0x7a5a8a, fogDensity: 0.013,
    hemi: 0.75, light: 1.3, lightColor: 0xffb88a, storm: 0, stars: 0.3, cloudSea: 0xc8a0b8,
  },
};

const MOOD_NUMBERS: (keyof Mood)[] = ["sunGlow", "fogDensity", "hemi", "light", "storm", "stars"];

export function mixMood(a: Mood, b: Mood, k: number): Mood {
  const out = {} as Record<keyof Mood, number>;
  for (const key of Object.keys(a) as (keyof Mood)[]) {
    out[key] = MOOD_NUMBERS.includes(key) ? a[key] + (b[key] - a[key]) * k : new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), k).getHex();
  }
  return out as Mood;
}

export interface Crystal {
  group: THREE.Group;
  light: THREE.PointLight;
  glow: THREE.Sprite;
  color: THREE.Color;
  /** 1 = shining, 0 = dark and grey */
  level: number;
  setLight(f: number): void;
}

export interface Island {
  group: THREE.Group;
  crystal: Crystal;
  baseY: number;
  radius: number;
}

export interface Hero {
  group: THREE.Group;
  body: THREE.Group;
  eyes: THREE.Mesh[];
  eyeGlow: THREE.Sprite;
  flaps: THREE.Group[];
}

export class World3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly sky: THREE.ShaderMaterial;
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly fog: THREE.FogExp2;
  readonly islands: Island[] = [];
  readonly hero: Hero;
  readonly dice: THREE.Mesh[] = [];
  readonly stars: THREE.Points;
  readonly sparkles: THREE.Points;
  readonly stormClouds: THREE.Sprite[] = [];
  readonly cloudSea: THREE.Sprite[] = [];
  readonly rays: THREE.Mesh[] = [];
  readonly rocks: THREE.Mesh[] = [];
  readonly bolt: THREE.Sprite;
  readonly dot = dotTexture();
  /** 0..1: how strongly the hero's eyes glow */
  eyes = 1;
  /** how high the hero is jumping */
  heroHop = 0;
  private sparkleSpeed: Float32Array;
  private ticking: ((t: number, dt: number) => void)[] = [];
  private raf = 0;
  private last = 0;
  private alive = true;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // the sky: a big inside-out sphere, blended from the top down, with a low sun glowing behind the lands
    this.sky = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() },
        bottom: { value: new THREE.Color() },
        sunColor: { value: new THREE.Color() },
        sunGlow: { value: 1 },
        sunDir: { value: new THREE.Vector3(0.75, 0.16, -0.64).normalize() },
      },
      vertexShader: "varying vec3 vPos; void main() { vPos = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform float sunGlow; uniform vec3 sunDir;
        varying vec3 vPos;
        void main() {
          float h = vPos.y;
          // a warm band along the horizon, then quickly into the sky's own colour
          vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.42, h), 0.75)) : mix(horizon, bottom, smoothstep(0.0, 0.3, -h));
          float s = max(dot(vPos, sunDir), 0.0);
          c += sunColor * (pow(s, 900.0) * 1.6 + pow(s, 24.0) * 0.3 + pow(s, 4.0) * 0.08) * sunGlow;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const skyBall = new THREE.Mesh(new THREE.SphereGeometry(400, 40, 20), this.sky);
    // the sky follows the camera, so it is always far away
    skyBall.onBeforeRender = () => skyBall.position.copy(this.camera.position);
    this.scene.add(skyBall);
    this.fog = new THREE.FogExp2(0xffd0b0, 0.012);
    this.scene.fog = this.fog;
    // stars, for the night
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.08;
      v.normalize().multiplyScalar(350);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2.2, map: this.dot, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.stars);
    // light
    this.hemi = new THREE.HemisphereLight(0xfff0dd, 0x6a5a8a, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
    this.sun.position.set(14, 26, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -7;
    sc.right = 7;
    sc.top = 7;
    sc.bottom = -7;
    sc.near = 1;
    sc.far = 70;
    this.sun.shadow.radius = 3;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    // the five lands, curving away into the distance
    const spots: [number, number, number][] = [[0, 0, 0], [5, 1.2, -12], [-3, 0.4, -25], [10, -0.6, -36], [2, 1.4, -50]];
    LAND_COLORS.forEach((c, i) => {
      const island = this.makeIsland(i === 0 ? 4.2 : 3.4 + (i % 2) * 0.4, c, i);
      island.group.position.set(...spots[i]);
      island.baseY = spots[i][1];
      island.group.rotation.y = i * 1.7;
      this.islands.push(island);
      this.scene.add(island.group);
    });
    this.hero = this.makeHero();
    this.hero.group.position.set(1.1, 0.25, 1.6);
    this.scene.add(this.hero.group);
    for (let i = 0; i < 6; i++) {
      const d = this.makeDie(DICE_COLORS[i]);
      this.dice.push(d);
      this.scene.add(d);
    }
    // a sea of clouds far below
    const ct = cloudTexture();
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: 0.7, depthWrite: false }));
      s.position.set(-60 + Math.random() * 130, -9 - Math.random() * 6, 25 - Math.random() * 110);
      const k = 22 + Math.random() * 26;
      s.scale.set(k, k * 0.55, 1);
      this.cloudSea.push(s);
      this.scene.add(s);
    }
    // little rocks floating around the near land
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a8070, roughness: 1, flatShading: true });
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + Math.random() * 0.25, 0), rockMat);
      r.userData = { a: (i / 9) * Math.PI * 2, d: 5 + Math.random() * 2.5, y: -1.5 + Math.random() * 2.5, s: 0.05 + Math.random() * 0.08 };
      r.castShadow = true;
      this.rocks.push(r);
      this.scene.add(r);
    }
    // beams of sunlight falling through the air
    const rt = rayTexture();
    for (const [x, z, w, tilt] of [[-4, -9, 2.4, 0.35], [7, -18, 3.2, 0.3], [-7, -30, 2.8, 0.4]] as [number, number, number, number][]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 26), new THREE.MeshBasicMaterial({ map: rt, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      m.position.set(x, 8, z);
      m.rotation.z = tilt;
      m.userData.base = 0.1;
      this.rays.push(m);
      this.scene.add(m);
    }
    // sparkles drifting up
    const n = 320;
    const pos = new Float32Array(n * 3);
    this.sparkleSpeed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([-20 + Math.random() * 40, Math.random() * 20 - 7, 12 - Math.random() * 60], i * 3);
      this.sparkleSpeed[i] = 0.3 + Math.random() * 0.9;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.sparkles = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.3, map: this.dot, color: 0xffe9a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.sparkles);
    // storm clouds and lightning (hidden until the storm)
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, color: 0x3a2a5a, transparent: true, opacity: 0, depthWrite: false }));
      s.position.set(-30 + Math.random() * 60, 11 + Math.random() * 9, 10 - Math.random() * 70);
      const k = 18 + Math.random() * 16;
      s.scale.set(k, k * 0.6, 1);
      s.userData.drift = 0.3 + Math.random() * 0.8;
      this.stormClouds.push(s);
      this.scene.add(s);
    }
    this.bolt = new THREE.Sprite(new THREE.SpriteMaterial({ map: boltTexture(), color: 0xe8e0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.bolt.scale.set(3, 16, 1);
    this.scene.add(this.bolt);
    // glow
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // only things brighter than white glow: crystals, eyes, sparks, lightning
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.65, 0.45, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.setMood(MOODS.day);
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  // ───────────────────────── makers ─────────────────────────

  private makeCrystal(color: number, big: boolean): Crystal {
    const group = new THREE.Group();
    const c = new THREE.Color(color);
    const bright = c.clone().lerp(new THREE.Color(0xffffff), 0.35);
    const grey = new THREE.Color(0x5a5a6a);
    const mat = new THREE.MeshStandardMaterial({ color: bright.clone(), emissive: c, emissiveIntensity: 1.6, roughness: 0.12, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.95 });
    const shards: [number, number, number, number, number][] = [[0, 0, 0, 1, 0], [0.45, -0.2, 0.15, 0.7, 0.35], [-0.4, -0.25, 0.1, 0.65, -0.4], [0.1, -0.3, -0.42, 0.6, 0.25], [-0.1, -0.3, 0.45, 0.55, -0.2]];
    for (const [x, y, z, s, tilt] of shards) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat);
      m.scale.set(s, s * 2.6, s);
      m.position.set(x, 1.05 * s + y, z);
      m.rotation.z = tilt;
      m.castShadow = true;
      group.add(m);
    }
    const peak = big ? 22 : 14;
    const light = new THREE.PointLight(color, peak, 14, 1.6);
    light.position.y = 1.2;
    group.add(light);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(4.2, 4.2, 1);
    glow.position.y = 1.1;
    group.add(glow);
    const crystal: Crystal = {
      group, light, glow, color: c, level: 1,
      setLight(f: number) {
        crystal.level = f;
        mat.emissiveIntensity = 1.6 * f;
        mat.color.copy(grey).lerp(bright, f);
        light.intensity = peak * f;
        glow.material.opacity = 0.75 * f;
      },
    };
    return crystal;
  }

  private makeIsland(r: number, crystalColor: number, i: number): Island {
    const group = new THREE.Group();
    const grass = grassTexture();
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    grass.repeat.set(2, 2);
    const tint = [0xffffff, 0xfff0a0, 0xa8f0b8, 0xffe0b0, 0xf4faff][i];
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.5, 44), [
      new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: grass, color: tint, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 }),
    ]);
    top.receiveShadow = true;
    group.add(top);
    // the rock underneath, jagged and pointing down
    const rockGeo = new THREE.ConeGeometry(r * 0.96, r * 1.8, 12, 5);
    const p = rockGeo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      if (p.getY(k) > r * 0.89) continue;
      p.setXYZ(k, p.getX(k) * (0.82 + Math.random() * 0.36), p.getY(k) + (Math.random() - 0.5) * 0.3, p.getZ(k) * (0.82 + Math.random() * 0.36));
    }
    rockGeo.computeVertexNormals();
    const rock = new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ color: [0x8a7060, 0x9a7a50, 0x6a6a5a, 0xb08a60, 0x8a90a0][i], roughness: 1, flatShading: true }));
    rock.rotation.x = Math.PI;
    rock.position.y = -0.25 - r * 0.9;
    group.add(rock);
    // trees, bushes and glowing flowers
    const leaf = new THREE.MeshStandardMaterial({ color: [0x4caf50, 0xd8a838, 0x2f8a50, 0x5aa040, 0xe8f4ff][i], roughness: 0.8, flatShading: true });
    const leaf2 = new THREE.MeshStandardMaterial({ color: [0xff8ac0, 0xe87a30, 0x3f9a60, 0x7ab84a, 0xc8e0f0][i], roughness: 0.8, flatShading: true });
    const trunk = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
    const trees = i === 0 ? 6 : 5;
    for (let k = 0; k < trees; k++) {
      const a = (k / trees) * Math.PI * 2 + 0.5;
      const d = r * (0.66 + 0.2 * (((k * 37) % 10) / 10));
      // the front of the near land stays open: it's where the hero and the pets stand
      if (i === 0 && Math.sin(a) * d > 0.8 && Math.cos(a) * d > -2) continue;
      const t = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.6, 6), trunk);
      tr.position.y = 0.3;
      t.add(tr);
      if (k % 2 === 0) {
        const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 7), leaf);
        f1.position.y = 1.0;
        const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 7), leaf);
        f2.position.y = 1.45;
        t.add(f1, f2);
      } else {
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), leaf2);
        f.position.y = 0.95;
        t.add(f);
      }
      t.traverse((o) => (o.castShadow = true));
      t.position.set(Math.cos(a) * d, 0.25, Math.sin(a) * d);
      t.scale.setScalar(0.8 + ((k * 13) % 5) / 10);
      group.add(t);
    }
    const bush = new THREE.MeshStandardMaterial({ color: 0x5fb85a, roughness: 0.9, flatShading: true });
    for (let k = 0; k < 5; k++) {
      const a = k * 2.1 + 1.2;
      // keep the front of the near land clear for the hero
      if (i === 0 && Math.sin(a) > 0.2) continue;
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), bush);
      b.position.set(Math.cos(a) * r * 0.5, 0.35, Math.sin(a) * r * 0.5);
      b.scale.y = 0.7;
      b.castShadow = true;
      group.add(b);
    }
    const flower = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff9ad0, emissiveIntensity: 1.3 });
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.3 + Math.random() * 0.62);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), flower);
      f.position.set(Math.cos(a) * d, 0.28, Math.sin(a) * d);
      group.add(f);
    }
    const crystal = this.makeCrystal(crystalColor, i === 0);
    crystal.group.position.y = 0.25;
    crystal.group.scale.setScalar(i === 0 ? 1.15 : 1);
    group.add(crystal.group);
    return { group, crystal, baseY: 0, radius: r };
  }

  /** The box ghost: a cardboard box with a dark slot, glowing eyes, four flaps and two little legs. */
  private makeHero(): Hero {
    const group = new THREE.Group();
    const body = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({ map: cardboardTexture(false), roughness: 0.9 });
    const front = new THREE.MeshStandardMaterial({ map: cardboardTexture(true), roughness: 0.9 });
    const inside = new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 1 });
    // faces: +x, -x, +y (open top: dark inside), -y, +z (front), -z
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1.1, 0.8), [side, side, inside, side, front, side]);
    box.castShadow = true;
    box.receiveShadow = true;
    box.position.y = 0.75;
    body.add(box);
    // the dark slot with the eyes glowing in it
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.3, 0.06), new THREE.MeshBasicMaterial({ color: 0x0a0614 }));
    slot.position.set(0, 0.95, 0.38);
    body.add(slot);
    const eyes: THREE.Mesh[] = [];
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(1.7), toneMapped: false });
    for (const x of [-0.18, 0.18]) {
      const e = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), eyeMat);
      e.scale.y = 1.25;
      e.position.set(x, 0.95, 0.415);
      eyes.push(e);
      body.add(e);
    }
    const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: 0xfff6c8, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    eyeGlow.scale.set(0.95, 0.4, 1);
    eyeGlow.position.set(0, 0.95, 0.5);
    body.add(eyeGlow);
    // four flaps hinged on the top edges
    const flaps: THREE.Group[] = [];
    const flapMat = new THREE.MeshStandardMaterial({ map: cardboardTexture(false), roughness: 0.9, side: THREE.DoubleSide });
    const hinges: [number, number, number, THREE.BufferGeometry][] = [
      [0, 1.31, 0.4, new THREE.BoxGeometry(1, 0.4, 0.03).translate(0, 0.2, 0)],
      [0, 1.31, -0.4, new THREE.BoxGeometry(1, 0.4, 0.03).translate(0, 0.2, 0)],
      [0.5, 1.29, 0, new THREE.BoxGeometry(0.03, 0.46, 0.8).translate(0, 0.23, 0)],
      [-0.5, 1.29, 0, new THREE.BoxGeometry(0.03, 0.46, 0.8).translate(0, 0.23, 0)],
    ];
    for (const [x, y, z, geo] of hinges) {
      const hinge = new THREE.Group();
      hinge.position.set(x, y, z);
      const flap = new THREE.Mesh(geo, flapMat);
      flap.castShadow = true;
      hinge.add(flap);
      flaps.push(hinge);
      body.add(hinge);
    }
    group.add(body);
    // two little legs with feet
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4a3a44, roughness: 0.7 });
    for (const x of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 8), legMat);
      leg.position.set(x, 0.12, 0);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), legMat);
      foot.scale.set(1, 0.55, 1.4);
      foot.position.set(x, 0.03, 0.05);
      leg.castShadow = foot.castShadow = true;
      group.add(leg, foot);
    }
    group.scale.setScalar(0.9);
    const hero = { group, body, eyes, eyeGlow, flaps };
    this.openFlaps(1, hero);
    return hero;
  }

  /** 0 = flaps folded shut over the top, 1 = standing open and tipped outwards. */
  openFlaps(f: number, hero = this.hero): void {
    const lerp = (a: number, b: number) => a + (b - a) * f;
    const [front, back, right, left] = hero.flaps;
    front.rotation.x = lerp(-Math.PI / 2, 0.7);
    back.rotation.x = lerp(Math.PI / 2, -0.5);
    right.rotation.z = lerp(Math.PI / 2 - 0.02, -0.75);
    left.rotation.z = lerp(-Math.PI / 2 + 0.02, 0.75);
  }

  private makeDie(color: number): THREE.Mesh {
    const mats = [1, 6, 2, 5, 3, 4].map((n) => new THREE.MeshStandardMaterial({ map: faceTexture(n), color, roughness: 0.3, metalness: 0.05, emissive: color, emissiveIntensity: 0.08 }));
    const d = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.7, 0.7, 4, 0.13), mats);
    d.castShadow = true;
    return d;
  }

  /** A slime monster with glowing red eyes; the boss is big, dark, horned and crowned. */
  makeMonster(color: number, boss = false): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05, emissive: color, emissiveIntensity: boss ? 0.05 : 0.15 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 18), mat);
    body.scale.set(1, 0.8, 1);
    body.position.y = 0.4;
    body.castShadow = true;
    g.add(body);
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(boss ? 0xff2a6a : 0xff3030).multiplyScalar(2.6), toneMapped: false });
    for (const x of [-0.17, 0.17]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eye);
      e.scale.set(1.2, 0.7, 0.6);
      e.position.set(x, 0.5, 0.43);
      e.rotation.z = x > 0 ? 0.35 : -0.35;
      g.add(e);
    }
    if (boss) {
      const horn = new THREE.MeshStandardMaterial({ color: 0x2a1a2a, roughness: 0.4 });
      for (const x of [-0.3, 0.3]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.45, 8), horn);
        h.position.set(x, 0.85, 0.05);
        h.rotation.z = x > 0 ? -0.45 : 0.45;
        g.add(h);
      }
      const crown = new THREE.MeshStandardMaterial({ color: 0xffc23a, metalness: 0.8, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
      for (let k = 0; k < 5; k++) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), crown);
        const a = -0.6 + k * 0.3;
        s.position.set(Math.sin(a) * 0.32, 0.86, Math.cos(a) * 0.32 - 0.05);
        g.add(s);
      }
    }
    return g;
  }

  /** A flat picture (like a pet drawn by the game) standing in the world, always facing the camera. */
  makeSprite(source: HTMLCanvasElement, height: number): THREE.Sprite {
    const t = new THREE.CanvasTexture(source);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
    s.scale.set((height * source.width) / source.height, height, 1);
    s.center.set(0.5, 0.06);
    return s;
  }

  /** A soft glowing light (for bursts, trails and the like). */
  makeGlow(color: number, size: number): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(size, size, 1);
    return s;
  }

  /** The height of the near land's grass (it floats up and down). */
  ground(): number {
    return this.islands[0].group.position.y + 0.25;
  }

  // ───────────────────────── mood ─────────────────────────

  setMood(m: Mood): void {
    const u = this.sky.uniforms;
    (u.top.value as THREE.Color).setHex(m.top);
    (u.horizon.value as THREE.Color).setHex(m.horizon);
    (u.bottom.value as THREE.Color).setHex(m.bottom);
    (u.sunColor.value as THREE.Color).setHex(m.sun);
    u.sunGlow.value = m.sunGlow;
    this.fog.color.setHex(m.fog);
    this.fog.density = m.fogDensity;
    this.hemi.intensity = m.hemi;
    this.sun.intensity = m.light;
    this.sun.color.setHex(m.lightColor);
    for (const c of this.stormClouds) c.material.opacity = 0.92 * m.storm;
    (this.stars.material as THREE.PointsMaterial).opacity = m.stars;
    for (const c of this.cloudSea) c.material.color.setHex(m.cloudSea);
    for (const r of this.rays) (r.material as THREE.MeshBasicMaterial).opacity = r.userData.base * m.sunGlow;
    (this.sparkles.material as THREE.PointsMaterial).opacity = 0.35 + 0.65 * m.sunGlow;
  }

  // ───────────────────────── running ─────────────────────────

  /** Things to do every frame (t: seconds since start, dt: seconds since the last frame). */
  onTick(fn: (t: number, dt: number) => void): void {
    this.ticking.push(fn);
  }

  clearTicks(): void {
    this.ticking = [];
  }

  start(): void {
    const loop = (ms: number) => {
      if (!this.alive) return;
      this.raf = requestAnimationFrame(loop);
      const t = ms / 1000;
      const dt = Math.min(0.05, this.last ? t - this.last : 0.016);
      this.last = t;
      this.frame(t, dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Moves everything on by one frame and draws it (tests also call it to draw a chosen moment). */
  frame(t: number, dt: number): void {
    this.animate(t, dt);
    for (const fn of this.ticking) fn(t, dt);
    this.composer.render(dt);
  }

  /** The always-on life: crystals pulse, lands float, sparkles rise, rocks drift, clouds roll, eyes blink. */
  private animate(t: number, dt: number): void {
    this.islands.forEach((isl, i) => {
      isl.group.position.y = isl.baseY + Math.sin(t * 0.6 + i * 1.3) * 0.18;
      isl.crystal.group.rotation.y = t * 0.25 + i;
      isl.crystal.glow.scale.setScalar(4.2 + Math.sin(t * 2 + i) * 0.35 * isl.crystal.level);
    });
    const p = this.sparkles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + this.sparkleSpeed[i] * dt;
      if (y > 14) y = -7;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t + i) * 0.003);
    }
    p.needsUpdate = true;
    for (const r of this.rocks) {
      const u = r.userData as { a: number; d: number; y: number; s: number };
      const a = u.a + t * u.s;
      r.position.set(Math.cos(a) * u.d, this.islands[0].group.position.y + u.y + Math.sin(t + u.a * 3) * 0.3, Math.sin(a) * u.d);
      r.rotation.set(t * 0.3 + u.a, t * 0.2, 0);
    }
    for (const c of this.stormClouds) {
      c.position.x += dt * c.userData.drift;
      if (c.position.x > 34) c.position.x = -34;
    }
    for (const c of this.cloudSea) {
      c.position.x += dt * 0.35;
      if (c.position.x > 75) c.position.x = -60;
    }
    this.rays.forEach((r, i) => (r.scale.x = 1 + Math.sin(t * 0.7 + i * 2) * 0.15));
    this.hero.group.position.y = this.ground() + this.heroHop;
    // the hero blinks now and then
    const blink = t % 3.7 < 0.12 ? 0.1 : 1;
    for (const e of this.hero.eyes) e.scale.set(this.eyes, 1.25 * this.eyes * blink, 1);
    this.hero.eyeGlow.material.opacity = 0.35 * this.eyes;
  }

  readonly resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    // tall phones see a little wider
    this.camera.fov = w < h ? 60 : 42;
    this.camera.updateProjectionMatrix();
  };

  dispose(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
