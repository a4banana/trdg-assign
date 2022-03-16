import './style.css'
import { select, selectAll } from 'd3-selection'
import { geoPath, geoCentroid, geoMercator } from 'd3-geo'
import geoJson from './geoJson.json'
import { line, curveNatural, easePolyInOut, easeBounceOut, randomInt, timeFormat,
	interpolateNumber, timer
	} from 'd3'

// pause and play
const is_pause = false;
const dayDelay = 3000;
const dayPer = interpolateNumber( 0, dayDelay );

// trdg original size
const width = 1120
const height = 611

// date format
let dateOffset = 0;
const getDate = () => new Date().getTime() - ( 24 * dateOffset ) * 60 * 60 * 1000;
const dateFormat = timeFormat( '%B %d' );

// set projection for map scale
const projection = geoMercator()
					.scale( 140 )
					.center([0, 0])
					.translate([width / 2  + 48, height / 1.45])

// iso_n3 == flag id
const path = geoPath().projection( projection )

// init map & svg
const svg = select( '#map' )

// draw geo
svg.append( 'g' )
	.attr( 'class', 'map' )
	.append( 'path' )
	.datum( geoJson )
	.attr( 'd', path )
	.attr( 'fill', '#242930' )
	.attr( 'stroke', '#000' )

const countries = svg.append( 'g' )
	.attr( 'class', 'country' )

// for debug
function handleMouseOver( event, data ) {
	console.log( data.properties.iso_a3 )
}

// init transaction path
const transPath = svg.append( 'g' )
	.attr( 'class', 'transaction' )
	.attr( 'stroke', 'white' )
	.attr( 'fill', 'none' )
	.attr( 'stroke-width', 0.65 )

const curveDuration = 3000;
const curveDelay = 0;
const countryCircleRadius = 3.5;
// test debug
let count = 0;

function drawTransaction( start, end, i ) {
	let startPos = projection( geoCentroid( start.geometry ) )
	let endPos = projection( geoCentroid( end.geometry ) )

	let side = ( startPos[0] < endPos[0] ) ?  -1 : 1;

	// center point and distance to curve
	let cx = (( startPos[0] + endPos[0]) / 2 )
	let cy = (( startPos[1] + endPos[1]) / 2 )
	let angle = Math.atan2( endPos[1] - startPos[1], endPos[0] - startPos[0] )
	let dist = distance( startPos, endPos )
	// relative curve height via distance
	let curveHeight = dist - ( dist * 0.78 )
	// Draw a normal to the line above
	let centerPos = [( -Math.sin( angle ) * curveHeight + cx ), ( side * Math.cos( angle ) * curveHeight + cy )]
	let linePos = [ startPos, centerPos, endPos ]
	let liner = line().curve( curveNatural )
	let lineData = liner( linePos )

	// draw curve
	let curve = transPath
		.append( 'path' )
		.attr( 'd', lineData )
	
	// curve transition
	const length = curve.node().getTotalLength();
	let offset = 0;
	curve.attr( 'stroke-dasharray', length + " " + length )
		.attr( 'stroke-dashoffset', length )
		.attr( 'stroke-opacity', 1 )
		.style( 'pointer-events', 'none')
	
	// create country circle
	const countryPath = selectAll( `circle[data-id=${ end.properties.iso_a3 }]` )
	if ( countryPath.empty() ) {
		createCountryCircle( end, endPos, length )
	}

	// draw circle
	const circle = transPath
		.append( 'circle' )
		.attr( 'r', 1.25 )
		.attr( 'fill', 'white' )
		.attr( 'transform', `translate( ${startPos[0]}, ${startPos[1]} )` )

	// curve transition
	curve.transition()
		.attr( 'data-country', `${start.properties.iso_a3} ${end.properties.iso_a3}` )
		.delay( i * curveDelay )
		.duration( curveDuration )
		.ease( easePolyInOut )
		.attr( 'stroke-dashoffset', length )
		// .attr( 'stroke-dashoffset', 0 )
		.attrTween( 'stroke-dashoffset', function() {
			return function( t ) { return length * ( 1 - t ) }
		})
		.transition()
		.duration( curveDuration )
		.attr( 'stroke-dashoffset', -length )
		.attr( 'stroke-opacity', 0 )
	
	// circle transition
	circle.transition()
		.delay( i * curveDelay )
		.duration( curveDuration )
		.ease( easePolyInOut )
		.attrTween( 'transform', function() {
			return function( t ) {
				let c = curve.node().getPointAtLength( length * t )
				return `translate(${c.x}, ${c.y})`;
			}
		})
		.on( 'end', function() { this.remove() })
}

function createCountryCircle( end, endPos, length ) {
	const { show, remove } = showInformationTag( end, endPos )

	let country = countries.append( 'circle' )
			.attr( "r", 0 )
			.attr( "fill", "#FFF" )
			.attr( "fill-opacity", 1 )
			.attr( "cx", endPos[0] )
			.attr( "cy", endPos[1] )
			.attr( 'data-id', end.properties.iso_a3 )
	
	country.transition()
		.delay( curveDuration )
		.duration( 600 )
		.attr( "r", countryCircleRadius )

	country.on( 'mouseenter', function( d, i ) {
			select( this )
				.transition()
				.duration( 600 )
				.attr( 'r', countryCircleRadius * 2 )
				.attr( 'fill', 'rgb( 35, 116, 238 )' )
				
			let iso = this.dataset.id;
			transPath.selectAll( 'path' ).filter( function() {
				return this.dataset.country.includes( iso )
			}).attr( 'stroke', 'rgb( 35, 116, 238 )' )
				.attr( 'stroke-dashoffset', 0 )
				.transition()
				.duration( 600 )
				.attr( 'stroke-opacity', 0.8 )
			
			show()
		})
	
	country.on( 'mouseleave', function( d, i ) {
			select( this )
				.transition()
				.duration( 300 )
				.attr( 'r', countryCircleRadius )
				.attr( 'fill', 'white' )
			let iso = this.dataset.id;
			transPath.selectAll( 'path' ).filter( function() {
				return this.dataset.country.includes( iso )
			}).attr( 'stroke', 'white' )
				.transition()
				.duration( 600 )
				.attr( 'stroke-dashoffset', -length )
				.attr( 'stroke-opacity', 0 )
			remove()
		})
}

function showInformationTag( end, endPos ) {
	let info;
	let text;
	let trans;
	let infoWidth = 259
	let rx = endPos[0] - ( infoWidth / 2 )
	let ry = endPos[1] + 18
	
	function remove() {
		svg.selectAll( 'g.info' ).remove()
	}

	function show() {
		info = svg.append( 'g' )
			.attr( 'class', 'info' )
			.append( 'rect' )
			.attr( 'rx', 3 )
			.attr( 'ry', 3 )
			.attr( 'x', rx )
			.attr( 'y', ry )
			.attr( 'width', infoWidth )
			.attr( 'height', 46 )
			.attr( 'fill', 'rgb( 35, 116, 238 )' )
			.attr( 'fill-opacity', 0.6 )
		
		text = svg.select( 'g.info' )
			.append( 'text' )
			.attr( 'class', 'country-name' )
			.attr( 'x', rx + 9 )
			.attr( 'y', ry + 18 )
			.attr( 'fill', 'white' )
			.attr( 'font-size', '13px' )
			.attr( 'font-weight', '600' )
			.attr( 'fill-opacity', 1 )
			.text( end.properties.name )
		
		trans = svg.select( 'g.info' )
			.append( 'text' )
			.attr( 'class', 'country-info' )
			.attr( 'x', rx + 9 )
			.attr( 'y', ry + 36 )
			.attr( 'fill', 'white' )
			.attr( 'font-size', '12px' )
			.attr( 'font-weight', '400' )
			.attr( 'fill-opacity', 0.65 )
			.text( '4 transactions with 3 countries \n last 3 days' )
	}

	return { show, remove }
}


// generate random transaction for dummy data
function generateRandomTransaction() {
	let geoLen = geoJson.features.length
	let	start = geoJson.features[ randomInt( geoLen - 1 )() ]
	let ends = geoJson.features.filter( g => {
		return distance( projection( geoCentroid( start.geometry )),  projection( geoCentroid( g.geometry ) )) > 300 && g.properties.iso_a3 !== '-99'
	})
	let end = ends[ randomInt(ends.length - 1 )() ]
	
	// transaction
	drawTransaction( start, end, count )
	count++;

	if ( count < 30 ) {
		// recursion here
		setTimeout( generateRandomTransaction, randomInt( 150, 250 )() )
	} else {
		endTransactions();
	}
}

const heading = svg.append( 'g' ).attr( 'class', 'title' )

// render title
heading.append( 'text' )
	.text( 'Transactions on' )
	.attr( 'x', 48 )
	.attr( 'y', 56 )
	.attr( 'font-size', '18px' )
	.attr( 'font-weight', 600 )
	.attr( 'fill', 'white' )

// render date
const dateString = heading.append( 'text' )
	.text( dateFormat( getDate() ) )
	.attr( 'x', 48 )
	.attr( 'y', 98 )
	.attr( 'font-size', '48px' )
	.attr( 'font-weight', 600 )
	.attr( 'fill', 'white' )

const timerHeight = 2;
const timerWidth = 68;
	
	// timer bg
const timerBg =	heading.append( 'g' )
		.attr( 'class', 'timer' )
		.append( 'rect' )
		.attr( 'x', 195 )
		.attr( 'y', 50 )
		.attr( 'width', timerWidth )
		.attr( 'height', timerHeight )
		.attr( 'fill', 'rgba( 255, 255, 255, 0.3)' )

const timerProgress = select( 'g.timer' )
		.append( 'rect' )
		.attr( 'x', 195 )
		.attr( 'y', 50 )
		.attr( 'width', 0 )
		.attr( 'height', timerHeight )
		.attr( 'fill', 'rgba( 255, 255, 255, 0.8)' )

function resetTimerProgress() {
	timerProgress.transition()
		.duration( 1000 )
		.attr( 'width', 0 )
}

function init() {
	// run
	generateRandomTransaction()
	
	// previous
	dateOffset++;
}

function next() {
	count = 0
	resetTimerProgress()
	dateString.text( dateFormat( getDate()))

	generateRandomTransaction()
	dateOffset++;
}

function endTransactions() {
	const t = timer(( elapsed ) => {
		let progress = elapsed / dayDelay
		timerProgress.attr( 'width', timerWidth * progress )
		if ( elapsed > dayDelay ) {
			t.stop();
			next();
		}
	}, curveDuration )

}

// get distance
function distance( start, end ) {
	let dx = end[0] - start[0]
	let dy = end[1] - start[1]
	return Math.sqrt( dx * dx + dy * dy )
}

init()