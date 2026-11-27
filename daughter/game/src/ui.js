// Small DOM helpers: nuclear notation, the terminal panel, toasts and captions.

import { PARTICLES } from './questions.js';

export const $ = id => document.getElementById( id );

export function el( tag, attrs = {}, ...kids ) {

	const e = document.createElement( tag );
	for ( const k in attrs ) {

		if ( k === 'class' ) e.className = attrs[ k ];
		else if ( k === 'html' ) e.innerHTML = attrs[ k ];
		else if ( k.startsWith( 'on' ) ) e.addEventListener( k.slice( 2 ), attrs[ k ] );
		else e.setAttribute( k, attrs[ k ] );

	}

	for ( const c of kids ) if ( c != null ) e.append( c );
	return e;

}

const signed = z => z < 0 ? '−' + ( - z ) : z > 0 && false ? '+' + z : String( z );

// nuclear symbol with the mass number over the atomic number, as in Table 16.2
export function nucHTML( A, Z, sym, { meta = false, zPlus = false } = {} ) {

	const z = Z < 0 ? '−' + ( - Z ) : ( zPlus && Z > 0 ? '+' + Z : String( Z ) );
	const italic = sym === 'e' || sym === 'n' || sym === 'γ';
	return `<span class="nuc"><span class="az"><span class="a">${ A }${ meta ? 'm' : '' }</span><span class="z">${ z }</span></span><span class="sym${ italic ? ' it' : '' }">${ sym }</span></span>`;

}

export function termHTML( t ) {

	if ( t.p ) {

		const P = PARTICLES[ t.p ];
		return ( t.n > 1 ? `<span class="coef">${ t.n }</span>` : '' ) + nucHTML( P.A, P.Z, P.sym, { zPlus: t.p === 'positron' } );

	}

	return nucHTML( t.A, t.Z, t.sym, { meta: t.meta } );

}

// equation with one rhs slot replaced by the given element
export function equationEl( eq, slotEl, { missing = eq.missing } = {} ) {

	const row = el( 'div', { class: 'eq' } );
	const add = h => row.append( typeof h === 'string' ? el( 'span', { html: h } ) : h );
	eq.lhs.forEach( ( t, i ) => { if ( i ) add( '<span class="op">+</span>' ); add( termHTML( t ) ); } );
	add( '<span class="op arrow">→</span>' );
	eq.rhs.forEach( ( t, i ) => { if ( i ) add( '<span class="op">+</span>' ); add( i === missing ? slotEl : termHTML( t ) ); } );
	return row;

}

// mass and atomic number totals for one side
export function totals( terms ) {

	let A = 0, Z = 0;
	for ( const t of terms ) {

		if ( t.p ) { const P = PARTICLES[ t.p ]; A += P.A * t.n; Z += P.Z * t.n; } else { A += t.A; Z += t.Z; }

	}

	return { A, Z };

}

export { signed };

// ---------------------------------------------------------------- panel

let onCloseFn = null;

export function openPanel( title, build, { onClose = null, wide = false } = {} ) {

	const p = $( 'panel' ), body = $( 'panelBody' );
	$( 'panelTitle' ).textContent = title;
	body.innerHTML = '';
	p.classList.toggle( 'wide', wide );
	build( body );
	p.hidden = false;
	onCloseFn = onClose;
	const first = body.querySelector( 'input, select, button' );
	if ( first ) setTimeout( () => first.focus(), 30 );

}

export function closePanel() {

	const p = $( 'panel' );
	if ( p.hidden ) return;
	p.hidden = true;
	const f = onCloseFn; onCloseFn = null;
	f?.();

}

export const panelOpen = () => ! $( 'panel' ).hidden;

export function feedback( body, text, ok ) {

	let f = body.querySelector( '.feedback' );
	if ( ! f ) { f = el( 'div', { class: 'feedback', role: 'status', 'aria-live': 'polite' } ); body.append( f ); }
	f.className = 'feedback ' + ( ok ? 'good' : 'bad' );
	f.innerHTML = text;

}

// ---------------------------------------------------------------- toasts and captions

let toastT = 0;
export function toast( text, ms = 3200 ) {

	const t = $( 'toast' );
	t.innerHTML = text; t.classList.add( 'show' );
	clearTimeout( toastT ); toastT = setTimeout( () => t.classList.remove( 'show' ), ms );

}

let capQueue = [], capBusy = false;
// ms: how long to show it (a voiced radio line passes its clip's length); otherwise it follows the text's length
export function caption( speaker, text, show, ms ) {

	if ( ! show ) return;
	capQueue.push( { speaker, text, ms } );
	if ( ! capBusy ) nextCaption();

}

function nextCaption() {

	const c = $( 'captions' );
	const item = capQueue.shift();
	if ( ! item ) { capBusy = false; c.classList.remove( 'show' ); return; }
	capBusy = true;
	c.innerHTML = `<span class="spk">${ item.speaker }</span> ${ item.text }`;
	c.classList.add( 'show' );
	setTimeout( nextCaption, item.ms ?? Math.max( 3500, item.text.length * 65 ) );

}

export function clearCaptions() { capQueue = []; capBusy = false; $( 'captions' ).classList.remove( 'show' ); }
