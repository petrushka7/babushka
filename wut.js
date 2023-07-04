console.clear();

// Stage is a tiny canvas library I wrote, to help with common things like resizing.
const stage = new Stage({
	container: yah.body,
	// No need for high DPI drawing when everything is square.
	highDPI: false
});

// Math helpers
// These are variations of the built in trig functions. Instead of accepting radians
// and outputting a value between -1 and 1, these accept input of a normalized value
// from 0 to 1, and return a value between 0 and 1.
const TAU = Math.PI * 2;
const sin = x => (Math.sin(x * TAU) + 1) / 2;
const isin = x => (-Math.sin(x * TAU) + 1) / 2;
const cos = x => (Math.cos(x * TAU) + 1) / 2;
const icos = x => (-Math.cos(x * TAU) + 1) / 2;


// Time is the only input. Represents ellapsed milliseconds. Randomizing the start
// time effectively randomizes the start of the entire experience.
let time = Math.random() * 60000;

// There are two modes. "Light" mode is calmer with more pastel colors.
// (This is technically an input too, but I digress.)
let lightMode = false;

// Allow toggling mode.
window.addEventListener('click', event => {
	if (!isChangingSpeed) {
		lightMode = !lightMode;
	}
});

// Allow changing speed at runtime by clicking and dragging along bottom of
// screen. Center is paused, left is reverse, right is sped up.
let isChangingSpeed = false;
const speedDisplayNode = document.querySelector('.speed-display');

function setSpeedFromPointerEvent(event) {
	if (isChangingSpeed) {
		const { clientX } = event;
		// Will be a value from 0 to 1.
		const position = clientX / window.innerWidth;
		// Scale to a range from -5 to 5.
		stage.speed = (position - 0.5) * 10;
		speedDisplayNode.textContent = `Speed: ${Math.floor(stage.speed * 100)}%`;
	}
}

window.addEventListener('pointerdown', event => {
	const controlArea = 44;
	const { clientY } = event;
	if (clientY >= window.innerHeight - controlArea) {
		isChangingSpeed = true;
		speedDisplayNode.classList.add('visible');
		setSpeedFromPointerEvent(event);
	}
});
window.addEventListener('pointerup', event => {
	if (isChangingSpeed) {
		setTimeout(() => {
			isChangingSpeed = false;
			speedDisplayNode.classList.remove('visible');
		}, 150);
	}
});
window.addEventListener('pointermove', event => {
	setSpeedFromPointerEvent(event);
});

// Tick event simply updates elapsed time, which is used by the draw routine.
stage.onTick = function tick({ simTime }) {
	// light mode slows things down more
	const speedMultiplier = lightMode ? 0.5 : 1;
	time += simTime * speedMultiplier;
};

// Pretty much everything happens in the draw routine.
stage.onDraw = function draw({ ctx, width, height }) {
	// Each frame starts black.
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, width, height);
	
	// Set size of each tile (including "grout" around it)
	const fullTileSize = 24;
	// Figure out how many tiles fit on screen.
	const tileCountX = Math.ceil(width / fullTileSize);
	const tileCountY = Math.ceil(height / fullTileSize);
	
	// We essentially rotate all of the following calculations to add a high level
	// of variation to the way colors move. Rotates slowly - once every 2 minutes.
	const angle1 = time / 120000 * TAU;
	const angle2 = angle1 + 0.5;
	const angle3 = angle1 + Math.PI / 2;
	const rotXOffset1 = Math.sin(angle1);
	const rotXOffset2 = Math.sin(angle2);
	const rotXOffset3 = Math.sin(angle3);
	const rotYOffset1 = Math.cos(angle1);
	const rotYOffset2 = Math.cos(angle2);
	const rotYOffset3 = Math.cos(angle3);
	// Unique oscillating value to control g1 frequency.
	// Oscillates faster than rotation above.
	const g1FreqMult = Math.sin(time / 24000 * TAU);
	
	// Loop through all tiles.
	for (let xIndex=0; xIndex<tileCountX; xIndex++) {
		for (let yIndex=0; yIndex<tileCountY; yIndex++) {
			// Figure out relative position of tile on screen.
			const x = xIndex / tileCountX;
			const y = yIndex / tileCountY;
			
			// Apply rotation offsets.
			const xRot1 = x * rotXOffset1;
			const xRot2 = x * rotXOffset2;
			const xRot3 = x * rotXOffset3;
			const yRot1 = y * rotYOffset1;
			const yRot2 = y * rotYOffset2;
			const yRot3 = y * rotYOffset3;
			
			// For each color channel, a unique set of equations are created that define how
			// much influence the channel has on the overall color of the tile. These equations
			// are all wave functions based on trig and use the tile's current position and the time
			// as input to control each wave. These equations are combined later on.
			// Warning: Lots of magic numbers used to control the wave functions. If you're not
			// well versed in trigonometry, this is probably daunting. Feel free to skip these.
			
			// Red channel
			const r1 = cos(xRot1 + yRot1 * rotXOffset3 * 2 + time / 8000);
			const r2 = cos(xRot3 + yRot3 * rotXOffset3 + time / 8000);
			const r3 = sin(x * 0.4 - time / 16000);
			
			// Green channel
			const g1 = icos((xRot1 + yRot1) * (g1FreqMult + 2) + time / 4000);
			const g2 = icos(xRot2 + yRot2 * 0.8 - time / 4400);
			const g3 = sin(x * 0.5 + time / 20000);
			
			// Blue channel
			const b1 = icos(x * rotXOffset1 * 1.65 - time / 2000);
			const b2 = icos(x * 0.8 + time / 4000);
			const b3 = sin(y * 0.4 + time / 24000 + 0.75);
			
			
			// Combine the wave values for each channel.
			let r;
			let g;
			let b;
			
			// This is where the light mode comes into play. For light mode, we only use the
			// final wave of each channel, because they are low frequency and slow moving.
			// We also scale the values to lighten them a bit.
			if (lightMode) {
				r = r2 * 0.68 + 0.32;
				g = g2 * 0.68 + 0.32;
				b = b2 * 0.68 + 0.32;
			}
			// The "normal" mode takes a weighted average of the first two wave values of each
			// channel, and then multiplies by the final wave value, scaled to avoid over-dimming.
			else {
				r = (r1 * 0.6 + r2) / 1.6 * (r3 * 0.5 + 0.5);
				g = (g1 * 0.6 + g2) / 1.6 * (g3 * 0.5 + 0.5);
				b = (b1 * 0.6 + b2) / 1.6 * (b3 * 0.5 + 0.5);
			}
			
			// Combine color channels (additive mixing).
			ctx.fillStyle = `rgb(${r*255|0},${g*255|0},${b*255|0})`;
			// Draw tile, shrinking a bit to create gaps.
			const tileX = xIndex * fullTileSize | 0 + 1;
			const tileY = yIndex * fullTileSize | 0 + 1;
			const tileSize = fullTileSize - 2;
			ctx.fillRect(tileX, tileY, tileSize, tileSize);
		}
	}
	
	// Finally add some highlights and shading to tiles. This is done after the tile colors
	// are drawn so we can set the fill style once. While this means iterating all tiles
	// several times, that is cheap compared to updating the `fillStyle` many times.
	// This technique improves draw time by 25% in Chrome! Could be optimized further, but
	// this works pretty well.
	
	// Draw highlights
	ctx.fillStyle = 'rgba(255,255,255,0.32)';
	for (let x=0; x<tileCountX; x++) {
		for (let y=0; y<tileCountY; y++) {
			const tileX = x * fullTileSize | 0 + 1;
			const tileY = y * fullTileSize | 0 + 1;
			const tileSize = fullTileSize - 2;
			
			ctx.fillRect(tileX, tileY, 1, tileSize);
			ctx.fillRect(tileX, tileY, tileSize, 1);
		}
	}
	
	// Draw shadows
	ctx.fillStyle = 'rgba(0,0,0,0.2)';
	for (let x=0; x<tileCountX; x++) {
		for (let y=0; y<tileCountY; y++) {
			const tileX = x * fullTileSize | 0 + 1;
			const tileY = y * fullTileSize | 0 + 1;
			const tileSize = fullTileSize - 2;
			
			ctx.fillRect(tileX + tileSize - 1, tileY + 1, 1, tileSize - 1);
			ctx.fillRect(tileX + 1, tileY + tileSize - 1, tileSize - 1, 1);
		}
	}
};
