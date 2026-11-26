// Procedural textures for the look test. Everything is generated at load time,
// so the look test ships no image assets and needs no CREDITS entries.
// (The art pass will replace these with Blender-made, KTX2-compressed textures.)

import * as THREE from 'three/webgpu';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

// ---------- tileable value noise ----------

function hash3( x, y, s ) {

	let h = ( x * 374761393 + y * 668265263 + s * 2147483647 ) | 0;
	h = Math.imul( h ^ ( h >>> 13 ), 1274126177 );
	h ^= h >>> 16;
	return ( h >>> 0 ) / 4294967295;

}

// value noise on a lattice that wraps every `p` cells, so it tiles
function vnoise( x, y, p, s ) {

	const xi = Math.floor( x ), yi = Math.floor( y );
	const xf = x - xi, yf = y - yi;
	const u = xf * xf * ( 3 - 2 * xf ), v = yf * yf * ( 3 - 2 * yf );
	const x0 = ( ( xi % p ) + p ) % p, y0 = ( ( yi % p ) + p ) % p;
	const x1 = ( x0 + 1 ) % p, y1 = ( y0 + 1 ) % p;
	const a = hash3( x0, y0, s ), b = hash3( x1, y0, s ), c = hash3( x0, y1, s ), d = hash3( x1, y1, s );
	return a + ( b - a ) * u + ( c - a ) * v + ( a - b - c + d ) * u * v;

}

// fbm over the unit square [0,1)² that tiles; f = base cells across the tile
function fbm( u, v, f, oct, s, fy = f ) {

	let sum = 0, amp = 0.5, norm = 0;
	for ( let o = 0; o < oct; o ++ ) {

		const k = 1 << o;
		sum += amp * vnoiseAniso( u * f * k, v * fy * k, f * k, fy * k, s + o * 17 );
		norm += amp; amp *= 0.5;

	}

	return sum / norm;

}

function vnoiseAniso( x, y, px, py, s ) {

	const xi = Math.floor( x ), yi = Math.floor( y );
	const xf = x - xi, yf = y - yi;
	const u = xf * xf * ( 3 - 2 * xf ), v = yf * yf * ( 3 - 2 * yf );
	const x0 = ( ( xi % px ) + px ) % px, y0 = ( ( yi % py ) + py ) % py;
	const x1 = ( x0 + 1 ) % px, y1 = ( y0 + 1 ) % py;
	const a = hash3( x0, y0, s ), b = hash3( x1, y0, s ), c = hash3( x0, y1, s ), d = hash3( x1, y1, s );
	return a + ( b - a ) * u + ( c - a ) * v + ( a - b - c + d ) * u * v;

}

const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = ( a, b, x ) => { const t = clamp01( ( x - a ) / ( b - a ) ); return t * t * ( 3 - 2 * t ); };
const mix = ( a, b, t ) => a + ( b - a ) * t;

// ---------- canvas helpers ----------

function makeCanvas( w, h ) {

	const c = document.createElement( 'canvas' );
	c.width = w; c.height = h;
	return c;

}

// rgb arrays in 0..1 (sRGB-ish albedo values) -> CanvasTexture
function toTexture( w, h, fill, { srgb = true, repeat = true } = {} ) {

	const c = makeCanvas( w, h );
	const ctx = c.getContext( '2d' );
	const img = ctx.createImageData( w, h );
	fill( img.data );
	ctx.putImageData( img, 0, 0 );
	const t = new THREE.CanvasTexture( c );
	t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
	if ( repeat ) t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.anisotropy = 8;
	t.generateMipmaps = true;
	t.minFilter = THREE.LinearMipmapLinearFilter;
	return t;

}

// height (Float32, wraps) -> tangent-space normal map
function normalFromHeight( H, w, h, strength ) {

	return toTexture( w, h, d => {

		for ( let y = 0; y < h; y ++ ) for ( let x = 0; x < w; x ++ ) {

			const xl = H[ y * w + ( x - 1 + w ) % w ], xr = H[ y * w + ( x + 1 ) % w ];
			const yu = H[ ( ( y - 1 + h ) % h ) * w + x ], yd = H[ ( ( y + 1 ) % h ) * w + x ];
			// canvas y runs down, texture v runs up (flipY), so invert the y slope
			let nx = ( xl - xr ) * strength, ny = ( yd - yu ) * strength, nz = 1;
			const l = Math.hypot( nx, ny, nz ); nx /= l; ny /= l; nz /= l;
			const i = ( y * w + x ) * 4;
			d[ i ] = ( nx * 0.5 + 0.5 ) * 255; d[ i + 1 ] = ( ny * 0.5 + 0.5 ) * 255; d[ i + 2 ] = ( nz * 0.5 + 0.5 ) * 255; d[ i + 3 ] = 255;

		}

	}, { srgb: false } );

}

function grayTexture( G, w, h ) {

	return toTexture( w, h, d => {

		for ( let i = 0; i < w * h; i ++ ) { const g = clamp01( G[ i ] ) * 255; d[ i * 4 ] = d[ i * 4 + 1 ] = d[ i * 4 + 2 ] = g; d[ i * 4 + 3 ] = 255; }

	}, { srgb: false } );

}

function rgbTexture( C, w, h ) {

	return toTexture( w, h, d => {

		for ( let i = 0; i < w * h; i ++ ) {

			d[ i * 4 ] = clamp01( C[ i * 3 ] ) * 255; d[ i * 4 + 1 ] = clamp01( C[ i * 3 + 1 ] ) * 255; d[ i * 4 + 2 ] = clamp01( C[ i * 3 + 2 ] ) * 255; d[ i * 4 + 3 ] = 255;

		}

	} );

}

// ---------- surfaces ----------

// Corridor wall: 4 m wide x 3 m tall tile. Dark green-grey painted dado below 1.15 m,
// dirty cream paint above, peeling to concrete, water streaks from the ceiling, grime at the floor.
export function wallTextures( w = 1024, h = 768 ) {

	const C = new Float32Array( w * h * 3 ), R = new Float32Array( w * h ), H = new Float32Array( w * h );
	for ( let py = 0; py < h; py ++ ) for ( let px = 0; px < w; px ++ ) {

		const u = px / w, v = py / h; // v = 0 at the top of the wall
		const ym = 3 * ( 1 - v ); // height above floor in m
		const i = py * w + px;

		const conc = fbm( u, v, 16, 5, 3, 12 );
		const big = fbm( u, v, 4, 4, 11, 3 );
		const peelN = fbm( u, v, 14, 5, 29, 10.5 ) * 0.7 + fbm( u, v, 4, 3, 31, 3 ) * 0.3;
		const streak = fbm( u, v, 48, 3, 41, 1.5 );
		const fine = hash3( px, py, 7 );

		// paint layers
		const lower = ym < 1.15;
		const stripe = ym >= 1.15 && ym < 1.21;
		let r, g, b;
		if ( lower ) { r = 0.215; g = 0.235; b = 0.2; } else if ( stripe ) { r = 0.42; g = 0.33; b = 0.17; } else { r = 0.56; g = 0.54; b = 0.47; }

		// large blotchy discoloration
		const blot = mix( 0.78, 1.08, big );
		r *= blot; g *= blot; b *= blot * 0.98;

		// peeling paint shows the concrete underneath
		const peel = smooth( 0.63, 0.66, peelN ) * ( ym > 0.25 ? 1 : 0.3 );
		const cr = 0.36 * mix( 0.8, 1.1, conc ), cg = 0.345 * mix( 0.8, 1.1, conc ), cb = 0.32 * mix( 0.8, 1.1, conc );
		r = mix( r, cr, peel ); g = mix( g, cg, peel ); b = mix( b, cb, peel );

		// water streaks running down from the ceiling, strongest near the top
		const sMask = smooth( 0.55, 0.8, streak ) * smooth( 0.4, 2.9, ym ) * smooth( 0.35, 0.7, big );
		r *= 1 - 0.45 * sMask; g *= 1 - 0.42 * sMask; b *= 1 - 0.38 * sMask;

		// grime band at the floor
		const grime = 1 - smooth( 0.0, 0.5, ym ) * 1;
		r *= 1 - 0.5 * grime * conc; g *= 1 - 0.5 * grime * conc; b *= 1 - 0.52 * grime * conc;

		const f = 0.96 + 0.08 * fine;
		C[ i * 3 ] = r * f; C[ i * 3 + 1 ] = g * f; C[ i * 3 + 2 ] = b * f;

		R[ i ] = mix( mix( lower ? 0.5 : 0.62, 0.9, peel ), 0.32, sMask ) + ( conc - 0.5 ) * 0.1;
		H[ i ] = conc * 0.35 + ( 1 - peel ) * 0.5 + fine * 0.04;

	}

	return { map: rgbTexture( C, w, h ), roughnessMap: grayTexture( R, w, h ), normalMap: normalFromHeight( H, w, h, 6 ) };

}

// Floor: 3 m x 3 m tile of stained, cracked concrete.
export function floorTextures( n = 1024 ) {

	const C = new Float32Array( n * n * 3 ), R = new Float32Array( n * n ), H = new Float32Array( n * n );
	for ( let py = 0; py < n; py ++ ) for ( let px = 0; px < n; px ++ ) {

		const u = px / n, v = py / n, i = py * n + px;
		const base = fbm( u, v, 24, 5, 5 );
		const stain = fbm( u, v, 3, 5, 13 );
		const crackN = fbm( u, v, 5, 5, 23 );
		const crack = 1 - smooth( 0.0, 0.012, Math.abs( crackN - 0.5 ) );
		const fine = hash3( px, py, 3 );
		// expansion joint every 3 m along one axis
		const joint = 1 - smooth( 0.0, 0.004, Math.min( u, 1 - u ) );

		const k = mix( 0.72, 1.05, base ) * mix( 0.62, 1.0, smooth( 0.3, 0.7, stain ) ) * ( 1 - 0.55 * crack ) * ( 1 - 0.5 * joint ) * ( 0.95 + 0.1 * fine );
		C[ i * 3 ] = 0.33 * k; C[ i * 3 + 1 ] = 0.315 * k; C[ i * 3 + 2 ] = 0.29 * k;
		R[ i ] = mix( 0.55, 0.85, base ) - 0.15 * ( 1 - smooth( 0.3, 0.6, stain ) );
		H[ i ] = base * 0.5 + fine * 0.08 - crack * 0.6 - joint * 0.6;

	}

	return { map: rgbTexture( C, n, n ), roughnessMap: grayTexture( R, n, n ), normalMap: normalFromHeight( H, n, n, 5 ) };

}

// Puddle mask, separate tile (used at a different scale so puddles do not repeat with the floor)
export function puddleTexture( n = 512 ) {

	const G = new Float32Array( n * n );
	for ( let py = 0; py < n; py ++ ) for ( let px = 0; px < n; px ++ ) {

		const p = fbm( px / n, py / n, 4, 5, 77 );
		G[ py * n + px ] = smooth( 0.5, 0.56, p );

	}

	return grayTexture( G, n, n );

}

// Ceiling and room concrete: 3 m tile, dark, water-stained.
export function concreteTextures( n = 512 ) {

	const C = new Float32Array( n * n * 3 ), R = new Float32Array( n * n ), H = new Float32Array( n * n );
	for ( let py = 0; py < n; py ++ ) for ( let px = 0; px < n; px ++ ) {

		const u = px / n, v = py / n, i = py * n + px;
		const base = fbm( u, v, 12, 5, 51 ), stain = fbm( u, v, 3, 4, 53 );
		const k = mix( 0.7, 1.05, base ) * mix( 0.55, 1, smooth( 0.35, 0.65, stain ) ) * ( 0.95 + 0.1 * hash3( px, py, 9 ) );
		C[ i * 3 ] = 0.3 * k; C[ i * 3 + 1 ] = 0.295 * k; C[ i * 3 + 2 ] = 0.28 * k;
		R[ i ] = mix( 0.7, 0.95, base );
		H[ i ] = base;

	}

	return { map: rgbTexture( C, n, n ), roughnessMap: grayTexture( R, n, n ), normalMap: normalFromHeight( H, n, n, 4 ) };

}

// Door: painted steel, 1 m x 2.1 m, worn edges, scratches, rust at the bottom.
export function doorTextures( w = 512, h = 1024 ) {

	const C = new Float32Array( w * h * 3 ), R = new Float32Array( w * h ), M = new Float32Array( w * h ), H = new Float32Array( w * h );
	for ( let py = 0; py < h; py ++ ) for ( let px = 0; px < w; px ++ ) {

		const u = px / w, v = py / h, i = py * w + px;
		const n1 = fbm( u, v, 6, 5, 61, 12 ), sc = fbm( u, v, 64, 2, 63, 4 );
		const edge = Math.min( u, 1 - u, ( 1 - v ) * 2.1, v * 2.1 );
		const wear = smooth( 0.05, 0.0, edge ) * smooth( 0.45, 0.6, n1 );
		const rust = smooth( 0.8, 1.0, v ) * smooth( 0.45, 0.7, n1 );
		const scratch = smooth( 0.82, 0.9, sc );
		// a recessed panel line
		const panel = ( Math.abs( u - 0.12 ) < 0.004 || Math.abs( u - 0.88 ) < 0.004 ) && v > 0.06 && v < 0.94 ? 1 : 0;
		let r = 0.24, g = 0.235, b = 0.205;
		const k = mix( 0.85, 1.1, n1 );
		r *= k; g *= k; b *= k;
		r = mix( r, 0.42, wear + scratch * 0.4 ); g = mix( g, 0.42, wear + scratch * 0.4 ); b = mix( b, 0.42, wear + scratch * 0.4 );
		r = mix( r, 0.32, rust ); g = mix( g, 0.17, rust ); b = mix( b, 0.09, rust );
		r *= 1 - panel * 0.5; g *= 1 - panel * 0.5; b *= 1 - panel * 0.5;
		C[ i * 3 ] = r; C[ i * 3 + 1 ] = g; C[ i * 3 + 2 ] = b;
		R[ i ] = mix( 0.48, 0.3, wear ) + rust * 0.45;
		M[ i ] = wear * 0.9;
		H[ i ] = n1 * 0.2 - panel * 0.6 - scratch * 0.15 + rust * 0.3;

	}

	return { map: rgbTexture( C, w, h ), roughnessMap: grayTexture( R, w, h ), metalnessMap: grayTexture( M, w, h ), normalMap: normalFromHeight( H, w, h, 4 ) };

}

// Generic radiation warning sign (trefoil on yellow). The trefoil is a public safety symbol.
export function radiationSignTexture() {

	const c = makeCanvas( 512, 640 ), x = c.getContext( '2d' );
	x.fillStyle = '#d9b62a'; x.fillRect( 0, 0, 512, 640 );
	x.fillStyle = '#1a1a1a'; x.fillRect( 0, 0, 512, 120 );
	x.fillStyle = '#d9b62a'; x.font = 'bold 76px Arial, Helvetica, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
	x.fillText( 'CAUTION', 256, 62 );
	// trefoil
	const cx = 256, cy = 330, r0 = 30, r1 = 46, r2 = 150;
	x.fillStyle = '#7a1f6e';
	x.beginPath(); x.arc( cx, cy, r0, 0, Math.PI * 2 ); x.fill();
	for ( let k = 0; k < 3; k ++ ) {

		const a = - Math.PI / 2 + k * ( 2 * Math.PI / 3 );
		x.beginPath(); x.arc( cx, cy, r2, a - Math.PI / 6, a + Math.PI / 6 ); x.arc( cx, cy, r1, a + Math.PI / 6, a - Math.PI / 6, true ); x.closePath(); x.fill();

	}

	x.fillStyle = '#1a1a1a'; x.font = 'bold 56px Arial, Helvetica, sans-serif';
	x.fillText( 'RADIATION', 256, 540 ); x.fillText( 'AREA', 256, 600 );
	// age it
	const img = x.getImageData( 0, 0, 512, 640 ), d = img.data;
	for ( let py = 0; py < 640; py ++ ) for ( let px = 0; px < 512; px ++ ) {

		const n = fbm( px / 512, py / 640, 6, 4, 91, 7.5 ), i = ( py * 512 + px ) * 4;
		const k = mix( 0.55, 1.0, smooth( 0.25, 0.7, n ) ) * ( 0.93 + 0.07 * hash3( px, py, 5 ) );
		d[ i ] *= k; d[ i + 1 ] *= k * 0.97; d[ i + 2 ] *= k * 0.92;

	}

	x.putImageData( img, 0, 0 );
	const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
	return t;

}

// Stenciled door/room label
export function labelTexture( text, { w = 256, h = 96, bg = null, fg = '#c9c3a8' } = {} ) {

	const c = makeCanvas( w, h ), x = c.getContext( '2d' );
	if ( bg ) { x.fillStyle = bg; x.fillRect( 0, 0, w, h ); } else x.clearRect( 0, 0, w, h );
	x.fillStyle = fg; x.font = `bold ${ Math.round( h * 0.62 ) }px "Arial Narrow", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
	x.fillText( text, w / 2, h / 2 + 2 );
	const img = x.getImageData( 0, 0, w, h ), d = img.data;
	for ( let i = 0; i < w * h; i ++ ) { if ( hash3( i % w, ( i / w ) | 0, 33 ) < 0.18 ) d[ i * 4 + 3 ] *= 0.4; }
	x.putImageData( img, 0, 0 );
	const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
	return t;

}

// Hazard stripes for the floor at the side passage
export function stripeTexture() {

	const c = makeCanvas( 512, 64 ), x = c.getContext( '2d' );
	x.fillStyle = '#b8901f'; x.fillRect( 0, 0, 512, 64 );
	x.fillStyle = '#1b1a17';
	for ( let k = - 2; k < 14; k ++ ) { x.beginPath(); x.moveTo( k * 48, 64 ); x.lineTo( k * 48 + 24, 64 ); x.lineTo( k * 48 + 24 + 64, 0 ); x.lineTo( k * 48 + 64, 0 ); x.fill(); }
	const img = x.getImageData( 0, 0, 512, 64 ), d = img.data;
	for ( let py = 0; py < 64; py ++ ) for ( let px = 0; px < 512; px ++ ) {

		const n = fbm( px / 512, py / 64, 16, 4, 95, 2 ), i = ( py * 512 + px ) * 4;
		const worn = smooth( 0.45, 0.75, n );
		d[ i ] = mix( d[ i ], 70, worn ); d[ i + 1 ] = mix( d[ i + 1 ], 66, worn ); d[ i + 2 ] = mix( d[ i + 2 ], 60, worn );

	}

	x.putImageData( img, 0, 0 );
	const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
	return t;

}

// Flashlight cookie: hot center, a faint reflector ring, smudges
export function flashlightCookie( n = 256 ) {

	const C = new Float32Array( n * n * 3 );
	for ( let py = 0; py < n; py ++ ) for ( let px = 0; px < n; px ++ ) {

		const dx = ( px + 0.5 ) / n * 2 - 1, dy = ( py + 0.5 ) / n * 2 - 1, r = Math.hypot( dx, dy ), i = py * n + px;
		const core = Math.exp( - r * r * 9 ) * 0.9;
		const body = smooth( 1.0, 0.55, r ) * 0.55;
		const ring = Math.exp( - Math.pow( ( r - 0.72 ) / 0.05, 2 ) ) * 0.25;
		const smudge = 0.88 + 0.12 * fbm( px / n, py / n, 6, 3, 101 );
		const k = ( core + body + ring ) * smudge;
		C[ i * 3 ] = k; C[ i * 3 + 1 ] = k * 0.985; C[ i * 3 + 2 ] = k * 0.95;

	}

	const t = rgbTexture( C, n, n );
	t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
	return t;

}

// 3D noise for the volumetric fog density (same approach as the official volume lighting example)
export function fogNoise3D( size = 64 ) {

	const data = new Uint8Array( size * size * size ), perlin = new ImprovedNoise();
	let i = 0;
	for ( let z = 0; z < size; z ++ ) for ( let y = 0; y < size; y ++ ) for ( let x = 0; x < size; x ++ ) {

		const s = 4 / size;
		const n = perlin.noise( x * s, y * s, z * s ) * 0.65 + perlin.noise( x * s * 2.3, y * s * 2.3, z * s * 2.3 ) * 0.35;
		data[ i ++ ] = 128 + 127 * Math.max( - 1, Math.min( 1, n * 1.6 ) );

	}

	const t = new THREE.Data3DTexture( data, size, size, size );
	t.format = THREE.RedFormat;
	t.minFilter = t.magFilter = THREE.LinearFilter;
	t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
	t.unpackAlignment = 1;
	t.needsUpdate = true;
	return t;

}
