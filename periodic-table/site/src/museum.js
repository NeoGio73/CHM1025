import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

// A dim science-museum gallery around the 3D table: plinth, polished floor, walls, title placard, rope stanchions.
// Color rule: every light here is neutral white, the table columns never receive shadows, and the haze (fog)
// begins well beyond the table, so the columns' value colors are not tinted by the setting.

const BG = 0x101114;

export function buildMuseum({ footprint, isPhone }) {
  // footprint: { minX, maxX, minZ, maxZ } of the table tiles, in scene units (1 unit = one tile)
  const g = new THREE.Group();
  g.name = 'museum';
  const cx = (footprint.minX + footprint.maxX) / 2, cz = (footprint.minZ + footprint.maxZ) / 2;
  const w = footprint.maxX - footprint.minX + 1.6, d = footprint.maxZ - footprint.minZ + 1.6;
  const plinthH = 0.7;

  // --- plinth (the table's tiles sit on its top face at y = 0)
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.7, metalness: 0.05 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w, plinthH, d), plinthMat);
  plinth.position.set(cx, -plinthH / 2 - 0.001, cz);
  plinth.receiveShadow = true;
  g.add(plinth);
  // thin light trim along the top edge
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.04, d + 0.06),
    new THREE.MeshStandardMaterial({ color: 0x8a8d96, roughness: 0.35, metalness: 0.4 }));
  trim.position.set(cx, -0.07, cz); // sits just below the top face, so only a thin rim shows at the edges
  g.add(trim);

  // --- polished floor: a mirror under a semi-transparent dark layer gives soft reflections
  const floorY = -plinthH;
  if (!isPhone) {
    const mirror = new Reflector(new THREE.PlaneGeometry(160, 160), {
      textureWidth: 1024, textureHeight: 1024, color: 0x777777,
    });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(cx, floorY - 0.002, cz);
    g.add(mirror);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.35, metalness: 0.0,
      transparent: !isPhone, opacity: isPhone ? 1 : 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, floorY, cz);
  floor.receiveShadow = true;
  g.add(floor);

  // --- walls: back wall with a title placard, two side walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b1c21, roughness: 0.95 });
  const backZ = footprint.minZ - 5.5;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), wallMat);
  back.position.set(cx, floorY + 15, backZ);
  g.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), wallMat);
    side.rotation.y = -s * Math.PI / 2;
    side.position.set(cx + s * 34, floorY + 15, backZ + 35);
    g.add(side);
  }
  // baseboard strip on the back wall
  const base = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.8 }));
  base.position.set(cx, floorY + 0.25, backZ + 0.1);
  g.add(base);

  const placard = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.3),
    new THREE.MeshStandardMaterial({ map: placardTexture(), roughness: 0.9 }));
  placard.position.set(cx, floorY + 3.3, backZ + 0.05);
  g.add(placard);

  // --- rope stanchions in front of the plinth
  const brass = new THREE.MeshStandardMaterial({ color: 0xb59a64, roughness: 0.35, metalness: 0.55 });
  const rope = new THREE.MeshStandardMaterial({ color: 0x5b1f24, roughness: 0.8 });
  const frontZ = footprint.maxZ + 2.6, n = 6;
  const posts = [];
  for (let i = 0; i < n; i++) {
    const x = footprint.minX - 0.5 + (i * (footprint.maxX - footprint.minX + 1)) / (n - 1);
    const post = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 16), brass);
    pole.position.y = 0.8;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.08, 24), brass);
    foot.position.y = 0.04;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), brass);
    cap.position.y = 1.62;
    post.add(pole, foot, cap);
    post.position.set(x, floorY, frontZ);
    post.traverse(m => { m.castShadow = true; });
    g.add(post);
    posts.push(new THREE.Vector3(x, floorY + 1.5, frontZ));
  }
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i], b = posts[i + 1];
    const mid = a.clone().lerp(b, 0.5); mid.y -= 0.45; // sag
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 8, false), rope));
  }

  // --- lights: neutral white. A soft key spotlight from above-front casts shadows onto the plinth and floor;
  // two wall washers light the placard and the back wall.
  const key = new THREE.SpotLight(0xffffff, 1.1, 0, Math.PI / 7, 0.6, 0);
  key.position.set(cx, 26, cz + 14);
  key.target.position.set(cx, 0, cz);
  key.castShadow = !isPhone;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  g.add(key, key.target);
  for (const s of [-1, 1]) {
    const wash = new THREE.SpotLight(0xffffff, 1.4, 0, Math.PI / 9, 0.8, 0);
    wash.position.set(cx + s * 9, floorY + 22, backZ + 12);
    wash.target.position.set(cx + s * 4, floorY + 4, backZ);
    g.add(wash, wash.target);
  }

  return {
    group: g,
    background: new THREE.Color(BG),
    // fog starts beyond the table so it never tints the columns
    fog: new THREE.Fog(BG, 40, 95),
  };
}

function placardTexture() {
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 308;
  const x = c.getContext('2d');
  x.fillStyle = '#16171b';
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#8a8d96';
  x.lineWidth = 4;
  x.strokeRect(10, 10, c.width - 20, c.height - 20);
  x.fillStyle = '#e8e6df';
  x.textAlign = 'center';
  x.font = '600 112px Georgia, "Times New Roman", serif';
  x.fillText('THE PERIODIC TABLE', c.width / 2, 150);
  x.font = '48px Georgia, "Times New Roman", serif';
  x.fillStyle = '#b9b6ad';
  x.fillText('Every value measured, sourced and cross-checked', c.width / 2, 240);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
