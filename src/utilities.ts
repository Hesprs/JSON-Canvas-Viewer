export const unexpectedError = new Error('This error is unexpected, probably caused by canvas file corruption. If you assure the error is not by accident, please contact the developer and show how to reproduce.');
export const destroyError = new Error("Resource hasn't been set up or has been disposed.");

export interface RuntimeJSONCanvasNode extends JSONCanvasNode {
	mdContent?: string;
	mdFrontmatter?: Record<string, string>;
}

export function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

export function getAnchorCoord(node: JSONCanvasNode, side: 'top' | 'bottom' | 'left' | 'right') {
	const midX = node.x + node.width / 2;
	const midY = node.y + node.height / 2;
	switch (side) {
		case 'top':
			return [midX, node.y];
		case 'bottom':
			return [midX, node.y + node.height];
		case 'left':
			return [node.x, midY];
		case 'right':
			return [node.x + node.width, midY];
		default:
			return [midX, midY];
	}
}

export function getColor(colorIndex: string = '0') {
	let themeColor = null;

	function hexToRgb(hex: string) {
		const cleanHex = hex.replace('#', '');
		const r = parseInt(cleanHex.substring(0, 2), 16);
		const g = parseInt(cleanHex.substring(2, 4), 16);
		const b = parseInt(cleanHex.substring(4, 6), 16);
		return { r, g, b };
	}

	if (colorIndex.length === 1) {
		switch (colorIndex) {
			case '1':
				themeColor = 'rgba(255, 120, 129, ?)';
				break;
			case '2':
				themeColor = 'rgba(251, 187, 131, ?)';
				break;
			case '3':
				themeColor = 'rgba(255, 232, 139, ?)';
				break;
			case '4':
				themeColor = 'rgba(124, 211, 124, ?)';
				break;
			case '5':
				themeColor = 'rgba(134, 223, 226, ?)';
				break;
			case '6':
				themeColor = 'rgba(203, 158, 255, ?)';
				break;
			default:
				themeColor = 'rgba(140, 140, 140, ?)';
		}
	} else {
		const rgb = hexToRgb(colorIndex);
		themeColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ?)`;
	}
	return {
		border: themeColor.replace('?', '0.75'),
		background: themeColor.replace('?', '0.1'),
		active: themeColor.replace('?', '1'),
	};
}

export function resizeCanvasForDPR(canvas: HTMLCanvasElement, width: number, height: number) {
	const dpr = window.devicePixelRatio || 1;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw unexpectedError;
	canvas.width = Math.round(width * dpr);
	canvas.height = Math.round(height * dpr);
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.scale(dpr, dpr);
}

export function deepMerge<T extends Record<string, any>>(main: T, toMerge: Record<string, any>, passive: boolean = false): T {
	function isPlainObject(obj: any): boolean {
		return obj !== null && typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Object]';
	}
	// Validate main object
	if (main === null || typeof main !== 'object') throw new Error('Main must be a non-null object');
	if (toMerge === null || typeof toMerge !== 'object') return main;

	// Process all own enumerable properties of toMerge
	const keys = Object.keys(toMerge);
	for (const key of keys) {
		const value = toMerge[key];

		// Check if main has this property
		if (key in main) {
			const mainValue = main[key];

			// Only merge if BOTH values are plain objects
			if (isPlainObject(mainValue) && isPlainObject(value)) deepMerge(mainValue as Record<string, any>, value, passive);
			else if (!passive) (main as Record<string, any>)[key] = value;
		}
		// New property - add directly
		else (main as Record<string, any>)[key] = value;
	}

	return main;
}