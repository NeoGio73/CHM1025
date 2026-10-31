import * as THREE from 'three';

// "Cosmic forge": the table floats on a glass platform in deep space, under a slowly turning sky of stars and a
// nebula. Color rule: nothing here emits light onto the table (glows are unlit sprites and shader colors, the
// scene's lights stay white), so the columns' value colors are unchanged.

export function buildCosmos({ footprint, isPhone, reducedMotion }) {
  const world = new THREE.Group(); // fixed to the table
  const sky = new THREE.Group();   // turns slowly
  const cx = (footprint.minX + footprint.maxX) / 2, cz = (footprint.minZ + footprint.maxZ) / 2;
  const w = footprint.maxX - footprint.minX + 1.8, d = footprint.maxZ - footprint.minZ + 1.8;

  // ---------------------------------------------------------------- nebula (procedural, on a large inner sphere)
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(180, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform float uTime;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x) {
        vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec3 p = vDir * 2.2;
        vec3 q = vec3(fbm(p + vec3(0.0, 0.0, uTime * 0.004)), fbm(p + vec3(5.2, 1.3, 2.8)), fbm(p + vec3(1.7, 9.2, 3.1)));
        float n = fbm(p + 2.6 * q);
        // a broad band of gas across the part of the sky behind and below the table (where the camera looks)
        float band = smoothstep(1.0, 0.0, abs(vDir.y + 0.42 + 0.3 * vDir.x)) * (0.55 + 0.45 * smoothstep(0.3, -0.8, vDir.z));
        float glow = pow(clamp(n, 0.0, 1.0), 2.4) * band;
        vec3 deep = vec3(0.012, 0.014, 0.035);
        vec3 violet = vec3(0.32, 0.12, 0.48);
        vec3 teal = vec3(0.05, 0.36, 0.44);
        vec3 rose = vec3(0.62, 0.18, 0.36);
        vec3 col = mix(violet, teal, smoothstep(0.35, 0.75, q.y));
        col = mix(col, rose, smoothstep(0.55, 0.85, q.z) * 0.7);
        vec3 c = deep + col * glow * 2.1 + vec3(0.9, 0.85, 1.0) * pow(glow, 3.0) * 1.1;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.add(nebula);

  // ---------------------------------------------------------------- stars
  const N = isPhone ? 2500 : 7000;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N);
  const tints = [[0.75, 0.82, 1.0], [0.9, 0.93, 1.0], [1.0, 1.0, 1.0], [1.0, 0.95, 0.85], [1.0, 0.82, 0.62]];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const z = 2 * rnd() - 1, a = 2 * Math.PI * rnd(), s = Math.sqrt(1 - z * z), r = 150 + 20 * rnd();
    pos.set([r * s * Math.cos(a), r * z, r * s * Math.sin(a)], i * 3);
    const t = tints[Math.floor(rnd() * tints.length)];
    col.set(t, i * 3);
    size[i] = Math.pow(rnd(), 6) * 4.5 + 0.8; // mostly faint, a few bright
    phase[i] = rnd() * 6.283;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sg.setAttribute('size', new THREE.BufferAttribute(size, 1));
  sg.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: Math.min(2, window.devicePixelRatio) },
      uTwinkle: { value: reducedMotion ? 0 : 1 } },
    vertexShader: /* glsl */`
      attribute float size; attribute float phase; attribute vec3 color;
      uniform float uTime, uPixel, uTwinkle;
      varying vec3 vColor; varying float vBright;
      void main() {
        vColor = color;
        vBright = 1.0 - uTwinkle * 0.35 * (0.5 + 0.5 * sin(uTime * (0.8 + phase * 0.3) + phase * 7.0));
        gl_PointSize = size * uPixel;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vBright;
      void main() {
        vec2 d = gl_PointCoord - 0.5; float r = length(d);
        float a = smoothstep(0.5, 0.0, r);
        gl_FragColor = vec4(vColor * vBright, a * vBright);
      }`,
  });
  sky.add(new THREE.Points(sg, starMat));

  // ---------------------------------------------------------------- a bright distant star and a spiral galaxy
  const star = glowSprite([255, 244, 220], 1.0);
  star.position.set(-70, -40, -125);
  star.scale.setScalar(26);
  const halo = glowSprite([150, 190, 255], 0.35);
  halo.position.copy(star.position);
  halo.scale.setScalar(70);
  const galaxy = new THREE.Sprite(new THREE.SpriteMaterial({ map: galaxyTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.8 }));
  galaxy.position.set(95, -70, -100);
  galaxy.scale.set(34, 20, 1);
  galaxy.material.rotation = 0.5;
  sky.add(halo, star, galaxy);

  // ---------------------------------------------------------------- floating glass platform with a glowing rim
  const platH = 0.45;
  const plat = new THREE.Mesh(new THREE.BoxGeometry(w, platH, d), new THREE.MeshStandardMaterial({
    color: 0x0a0e1a, roughness: 0.25, metalness: 0.5, transparent: true, opacity: 0.94 }));
  plat.position.set(cx, -platH / 2 - 0.002, cz);
  plat.receiveShadow = true;
  world.add(plat);
  const rimGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.02, platH + 0.02, d + 0.02));
  const rim = new THREE.LineSegments(rimGeo, new THREE.LineBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.9 }));
  rim.position.copy(plat.position);
  world.add(rim);
  // soft glow under the platform (an unlit, additive sprite-like plane: it lights nothing)
  const under = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.7, d * 1.9), new THREE.MeshBasicMaterial({
    map: radialTexture([90, 200, 255]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  under.rotation.x = -Math.PI / 2;
  under.position.set(cx, -platH - 1.6, cz);
  world.add(under);

  // ---------------------------------------------------------------- update (called every frame)
  let t0 = null;
  function update(t) {
    if (t0 === null) t0 = t;
    const s = (t - t0) / 1000;
    starMat.uniforms.uTime.value = s;
    nebula.material.uniforms.uTime.value = s;
    if (!reducedMotion) sky.rotation.y = s * 0.006; // one turn every ~17 minutes
    rim.material.opacity = reducedMotion ? 0.9 : 0.75 + 0.2 * Math.sin(s * 0.8);
  }

  return { world, sky, background: new THREE.Color(0x02030a), update };
}

function glowSprite(rgb, alpha) {
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(rgb), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: alpha }));
}

function radialTexture([r, g, b]) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grd.addColorStop(0.15, `rgba(${r},${g},${b},0.55)`);
  grd.addColorStop(0.45, `rgba(${r},${g},${b},0.12)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grd;
  x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function galaxyTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.translate(256, 256);
  const core = x.createRadialGradient(0, 0, 0, 0, 0, 60);
  core.addColorStop(0, 'rgba(255,240,215,0.95)');
  core.addColorStop(1, 'rgba(255,220,180,0)');
  x.fillStyle = core;
  x.beginPath(); x.arc(0, 0, 60, 0, 6.283); x.fill();
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 1400; i++) {
      const tt = rnd() * 3.2;
      const a = tt * 1.9 + arm * Math.PI + (rnd() - 0.5) * 0.5;
      const rr = 18 + tt * 70 + (rnd() - 0.5) * 22;
      const alpha = 0.5 * (1 - tt / 3.4);
      x.fillStyle = rnd() < 0.3 ? `rgba(170,200,255,${alpha})` : `rgba(255,235,215,${alpha * 0.8})`;
      x.beginPath(); x.arc(Math.cos(a) * rr, Math.sin(a) * rr, rnd() * 2.2 + 0.4, 0, 6.283); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
