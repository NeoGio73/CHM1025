// Renderer, quality tiers and the post-processing pipeline. Carried over unchanged in look from the
// approved look test (daughter/look-test), with the Low tier using real-time lights instead of the
// CPU bake until the Blender bake lands in the art pass.

import * as THREE from 'three/webgpu';
import {
	pass, mrt, output, normalView, diffuseColor, velocity, roughness, vec2, vec3, vec4, float, uniform,
	packNormalToRGB, unpackRGBToNormal, sample, renderOutput, convertToTexture, screenUV, screenSize, Fn, mix,
	smoothstep, length, max, min, abs, dot, time, rand, luminance, fract
} from 'three/tsl';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { LAYER_VOL } from './level.js';

export const TIERS = {
	ultra: {
		label: 'Ultra', scale: 1.0, minScale: 0.8, maxDpr: 2, variant: 'full',
		flashShadow: 2048, glowShadow: 1024, volume: { steps: 16, res: 1.0 }, cone: false, haze: false,
		ao: 'ssgi', ssr: { quality: 0.6, res: 1.0 }, aa: 'traa', bloom: { strength: 0.85, radius: 0.55, threshold: 0.55, res: 1.0 },
		ca: true, grain: true, fog: 0.03, pixelated: false
	},
	high: {
		label: 'High', scale: 1.0, minScale: 0.8, maxDpr: 2, variant: 'full',
		flashShadow: 1024, glowShadow: 512, volume: { steps: 10, res: 0.5 }, cone: false, haze: false,
		ao: 'gtao', ssr: { quality: 0.35, res: 0.5 }, aa: 'traa', bloom: { strength: 0.85, radius: 0.55, threshold: 0.55, res: 0.5 },
		ca: true, grain: true, fog: 0.03, pixelated: false
	},
	medium: {
		label: 'Medium', scale: 0.85, minScale: 0.75, maxDpr: 1.25, variant: 'med',
		flashShadow: 512, glowShadow: 256, volume: null, cone: true, haze: true,
		ao: null, ssr: null, aa: 'fxaa', bloom: { strength: 0.8, radius: 0.5, threshold: 0.55, res: 0.5 },
		ca: false, grain: false, fog: 0.07, pixelated: false
	},
	low: {
		label: 'Low', scale: 0.6, minScale: 0.5, maxDpr: 1, variant: 'low',
		flashShadow: 0, glowShadow: 0, volume: null, cone: false, haze: true,
		ao: null, ssr: null, aa: null, bloom: null,
		ca: false, grain: false, fog: 0.085, pixelated: true
	}
};
export const ORDER = [ 'low', 'medium', 'high', 'ultra' ];

export async function initRenderer( forceWebGL ) {

	const renderer = new THREE.WebGPURenderer( { antialias: false, forceWebGL, powerPreference: 'high-performance' } );
	await renderer.init();
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.15;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	return renderer;

}

export function createPipeline( renderer, scene, camera, L ) {

	const pipeline = new THREE.RenderPipeline( renderer );
	pipeline.outputColorTransform = false;

	const U = {
		lensK: uniform( 0.12 ), ca: uniform( 0.012 ), grain: uniform( 0.05 ), vignette: uniform( 1.0 ),
		volIntensity: uniform( 0.03 ), denoise: uniform( 0.6 ),
		whiteout: uniform( 0 ), fade: uniform( 1 ) // evacuation white-out and scene fades
	};
	const volLayer = new THREE.Layers(); volLayer.disableAll(); volLayer.enable( LAYER_VOL );
	let disposables = [];

	function build( T ) {

		for ( const d of disposables ) d?.dispose?.();
		disposables = [];

		const scenePass = pass( scene, camera );
		disposables.push( scenePass );
		const outs = { output };
		if ( T.ao || T.ssr ) outs.normal = vec4( packNormalToRGB( normalView ), roughness );
		if ( T.ao === 'ssgi' ) outs.diffuseColor = diffuseColor;
		if ( T.aa === 'traa' ) outs.velocity = velocity;
		if ( Object.keys( outs ).length > 1 ) scenePass.setMRT( mrt( outs ) );
		for ( const k of [ 'normal', 'diffuseColor' ] ) if ( outs[ k ] ) scenePass.getTexture( k ).type = THREE.UnsignedByteType;

		const color = scenePass.getTextureNode( 'output' );
		const depth = scenePass.getTextureNode( 'depth' );
		const normal = outs.normal ? sample( uv => unpackRGBToNormal( scenePass.getTextureNode( 'normal' ).sample( uv ) ) ) : null;

		let hdr = color;

		if ( T.ao === 'ssgi' ) {

			const gi = ssgi( color, depth, normal, camera );
			gi.sliceCount.value = 2; gi.stepCount.value = 8; gi.radius.value = 4;
			disposables.push( gi );
			const diffuse = scenePass.getTextureNode( 'diffuseColor' );
			hdr = vec4( color.rgb.mul( gi.getAONode() ).add( diffuse.rgb.mul( gi.getGINode().rgb ) ), color.a );

		} else if ( T.ao === 'gtao' ) {

			const aoPass = ao( depth, normal, camera );
			aoPass.resolutionScale = 0.5;
			disposables.push( aoPass );
			const aoVal = aoPass.getTextureNode().sample( screenUV ).r;
			hdr = vec4( color.rgb.mul( mix( float( 1 ), aoVal, 0.85 ) ), color.a );

		}

		if ( T.ssr ) {

			const rough = scenePass.getTextureNode( 'normal' ).a;
			const s = ssr( color, depth, normal, { metalnessNode: float( 0 ), roughnessNode: rough, reflectNonMetals: true, camera } );
			s.quality.value = T.ssr.quality; s.maxDistance.value = 6; s.thickness.value = 0.03;
			if ( s.resolutionScale !== undefined ) s.resolutionScale = T.ssr.res;
			disposables.push( s );
			hdr = vec4( hdr.rgb.add( s.rgb ), 1 );

		}

		if ( T.volume ) {

			const vp = pass( scene, camera, { depthBuffer: false } );
			vp.setLayers( volLayer );
			vp.setResolutionScale( T.volume.res );
			disposables.push( vp );
			L.volMat.steps = T.volume.steps;
			L.volMat.depthNode = depth.sample( screenUV );
			L.volMat.needsUpdate = true;
			hdr = vec4( hdr.rgb.add( gaussianBlur( vp, U.denoise ).rgb.mul( U.volIntensity ) ), 1 );

		}

		if ( T.aa === 'traa' ) {

			const vel = scenePass.getTextureNode( 'velocity' );
			const t = traa( hdr, depth, vel, camera );
			disposables.push( t );
			hdr = t;

		}

		if ( T.bloom ) {

			const b = bloom( hdr, T.bloom.strength, T.bloom.radius, T.bloom.threshold );
			b.setResolutionScale( T.bloom.res );
			disposables.push( b );
			hdr = vec4( hdr.rgb.add( b.rgb ), 1 );

		}

		let out = renderOutput( hdr );
		if ( T.aa === 'fxaa' ) out = fxaa( out );

		const lensTex = convertToTexture( out );
		disposables.push( lensTex );
		const useCA = T.ca;
		const lens = Fn( () => {

			const p = screenUV.sub( 0.5 ).mul( 2 ).toVar();
			const asp = screenSize.x.div( screenSize.y );
			const q = p.mul( vec2( asp, 1 ) ).div( length( vec2( asp, 1 ) ) );
			const r2 = dot( q, q );
			const f = float( 1 ).add( U.lensK.mul( r2 ) ).div( U.lensK.add( 1 ) );
			const at = k => p.mul( f.mul( k ) ).mul( 0.5 ).add( 0.5 );
			if ( ! useCA ) return lensTex.sample( at( float( 1 ) ) );
			const c = U.ca.mul( r2 );
			return vec4( lensTex.sample( at( c.add( 1 ) ) ).r, lensTex.sample( at( float( 1 ) ) ).g, lensTex.sample( at( float( 1 ).sub( c ) ) ).b, 1 );

		} )();

		const useGrain = T.grain;
		const finish = Fn( () => {

			const col = lens.rgb.toVar();
			const l = luminance( col );
			col.assign( mix( vec3( l ), col, mix( float( 0.7 ), float( 1.0 ), smoothstep( 0.2, 0.7, l ) ) ) );
			col.mulAssign( mix( vec3( 0.97, 1.0, 0.99 ), vec3( 1.05, 1.0, 0.93 ), smoothstep( 0.05, 0.55, l ) ) );
			col.addAssign( vec3( 0.009, 0.010, 0.009 ).mul( float( 1 ).sub( l ) ) );

			const asp = screenSize.x.div( screenSize.y );
			const p = screenUV.sub( 0.5 ).mul( 2 ).mul( vec2( asp, 1 ) );
			const half = vec2( asp.mul( 0.9 ), 0.88 ), rr = float( 0.55 );
			const qd = abs( p ).sub( half ).add( rr );
			const sd = length( max( qd, vec2( 0 ) ) ).add( min( max( qd.x, qd.y ), 0 ) ).sub( rr );
			const edge = float( 1 ).sub( smoothstep( - 0.5, 0.06, sd ) );
			const radial = float( 1 ).sub( dot( p, p ).mul( 0.06 ) );
			col.mulAssign( mix( float( 1 ), edge.mul( radial ), U.vignette ) );

			if ( useGrain ) {

				const n = rand( screenUV.add( vec2( fract( time.mul( 0.731 ) ), fract( time.mul( 0.419 ) ) ) ) ).sub( 0.5 );
				col.addAssign( n.mul( U.grain ).mul( float( 1 ).sub( l.mul( 0.6 ) ) ) );

			}

			// scene fade (to black) and the evacuation white-out (slow, never a flash)
			col.mulAssign( U.fade );
			col.assign( mix( col, vec3( 0.96, 0.97, 0.98 ), U.whiteout ) );
			return vec4( col, 1 );

		} )();

		pipeline.outputNode = finish;
		pipeline.needsUpdate = true;

	}

	return { pipeline, U, build };

}
