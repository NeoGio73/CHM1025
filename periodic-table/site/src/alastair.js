import * as THREE from 'three';

// Alastair, the author's dog, as a space dog. Purely decorative: every so often he drifts through empty space
// around the table, paddling (his lifelike walk cycle from the Dog Desktop Pet project) inside a 3D glass helmet
// with a silver collar ring. He is a camera-facing cutout, so he always shows his side as he crosses the sky.
// Not pickable; not shown with reduced motion or the simple background.

const SHEET = { url: 'assets/alastair-walk.webp', cols: 7, rows: 3, frames: 21, fps: 12, frameW: 199, frameH: 170 };
// Head position in a frame (0–1 from the top-left), sized so the helmet encloses the ears.
const HEAD = { x: 0.81, y: 0.22, r: 0.26 };

export function makeAlastair(camera) {
  const H = 4.2, W = H * SHEET.frameW / SHEET.frameH; // size in scene units (one table tile = 1)
  const root = new THREE.Group();
  root.visible = false;

  const tex = new THREE.TextureLoader().load(SHEET.url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1 / SHEET.cols, 1 / SHEET.rows);
  tex.magFilter = THREE.LinearFilter;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({
    map: tex, transparent: true, alphaTest: 0.04, depthWrite: false }));
  card.renderOrder = 10;

  // glass helmet around his head, with a highlight and a silver collar ring at the neck
  const r = HEAD.r * H;
  const hx = (HEAD.x - 0.5) * W, hy = (0.5 - HEAD.y) * H;
  // Clear glass: almost invisible where you look straight through it, brighter toward the rim (Fresnel-like).
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec3 c = mix(vec3(0.70, 0.88, 1.0), vec3(1.0), f);
        gl_FragColor = vec4(c, 0.03 + 0.62 * f);
      }`,
  }));
  helmet.position.set(hx, hy, 0);
  helmet.renderOrder = 11;
  // a soft window highlight on the upper front of the glass
  const shine = new THREE.Mesh(new THREE.CircleGeometry(r * 0.22, 24), new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
  shine.scale.set(1, 0.55, 1);
  shine.rotation.z = -0.6;
  shine.position.set(hx - r * 0.5, hy + r * 0.42, r * 0.75);
  shine.renderOrder = 12;
  // silver seal ring at the base of the helmet
  const collar = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, r * 0.07, 14, 48), new THREE.MeshStandardMaterial({
    color: 0xdfe3ea, roughness: 0.3, metalness: 0.35, emissive: 0x2a2d33 }));
  // lies flat around the bottom of the bubble (the sphere's cross-section there is 0.6 r)
  collar.position.set(hx, hy - r * 0.8, 0);
  collar.rotation.set(Math.PI / 2, 0, 0);
  collar.renderOrder = 11;

  const body = new THREE.Group(); // flipped to face the direction of travel
  body.add(card, helmet, shine, collar);
  const tilt = new THREE.Group(); // a gentle weightless roll
  tilt.add(body);
  root.add(tilt);

  let trip = null;
  let nextAt = performance.now() + 4000 + Math.random() * 6000; // first visit soon after load

  // A trip is a slow curve through the open space behind the table, which the starting view shows above the table,
  // so he never crosses the columns. (Space under the platform is hidden by the platform from this viewpoint.)
  function newTrip(now) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y0 = -2.5 + Math.random() * 2;
    const z0 = -9 - Math.random() * 6;
    const start = new THREE.Vector3(-34 * dir, y0, z0);
    const end = new THREE.Vector3(34 * dir, y0 + (Math.random() - 0.5) * 2, z0 + (Math.random() - 0.5) * 2);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.5 + Math.random(), 0));
    trip = { curve: new THREE.QuadraticBezierCurve3(start, mid, end), t0: now, ms: 24000 + Math.random() * 10000, dir };
    body.scale.x = dir; // the frames face right; mirror him when he travels left
    root.visible = true;
  }

  function update(now) {
    if (!trip) {
      if (now >= nextAt) newTrip(now);
      return;
    }
    const p = trip.hold ? 0.5 : (now - trip.t0) / trip.ms;
    if (p >= 1) {
      trip = null;
      root.visible = false;
      nextAt = now + 25000 + Math.random() * 45000; // back in 25–70 s
      return;
    }
    const s = now / 1000;
    root.position.copy(trip.curve.getPoint(p));
    root.position.y += Math.sin(s * 0.9) * 0.3; // bob
    root.quaternion.copy(camera.quaternion);       // always face the camera
    tilt.rotation.z = Math.sin(s * 0.45) * 0.12 + 0.05 * trip.dir;
    const f = Math.floor(s * SHEET.fps) % SHEET.frames;
    tex.offset.set((f % SHEET.cols) / SHEET.cols, 1 - (Math.floor(f / SHEET.cols) + 1) / SHEET.rows);
  }

  // forceVisit(true) holds him in the middle of his trip (for a closer look)
  return { object: root, update, forceVisit: hold => { newTrip(performance.now()); trip.hold = !!hold; } };
}
