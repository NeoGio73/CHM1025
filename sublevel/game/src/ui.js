// Small DOM helpers: the panel, toasts and captions. Daughter's src/ui.js, adapted (no nuclear notation).

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

// orbital diagram as HTML boxes (read only)
export function diagramHTML( rows ) {

	return '<div class="orb ro">' + rows.map( r => `<div class="orow"><span class="olbl">${ r.label }</span>${ r.boxes.map( b => `<span class="obox">${ b }</span>` ).join( '' ) }</div>` ).join( '' ) + '</div>';

}

// ---------------------------------------------------------------- panel

let onCloseFn = null;

export function openPanel( title, build, { onClose = null } = {} ) {

	const p = $( 'panel' ), body = $( 'panelBody' );
	$( 'panelTitle' ).textContent = title;
	body.innerHTML = '';
	build( body );
	p.hidden = false;
	onCloseFn = onClose;
	const first = body.querySelector( 'button, input' );
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

let capQueue = [], capBusy = false, capT = 0;
export function caption( speaker, text, show ) {

	if ( ! show ) return;
	capQueue.push( { speaker, text } );
	if ( ! capBusy ) nextCaption();

}

function nextCaption() {

	const c = $( 'captions' );
	const item = capQueue.shift();
	if ( ! item ) { capBusy = false; c.classList.remove( 'show' ); return; }
	capBusy = true;
	c.innerHTML = `<span class="spk">${ item.speaker }</span> ${ item.text }`;
	c.classList.add( 'show' );
	capT = setTimeout( nextCaption, Math.max( 3500, item.text.length * 65 ) );

}

export function clearCaptions() { capQueue = []; capBusy = false; clearTimeout( capT ); $( 'captions' ).classList.remove( 'show' ); }
