import { destroyError, unexpectedError, resizeCanvasForDPR, getColor, drawRoundRect, getAnchorCoord } from './utilities';

interface viewport {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

interface RuntimeJSONCanvasEdge extends JSONCanvasEdge {
	controlPoints?: Array<number>;
}

const ARROW_LENGTH = 12;
const ARROW_WIDTH = 7;
const NODE_RADIUS = 12;
const FONT_COLOR = '#fff';
const CSS_ZOOM_REDRAW_INTERVAL = 500;

export default class renderer {
	private _canvas: HTMLCanvasElement | null;
	private ctx: CanvasRenderingContext2D;
	private data: runtimeData;
	private zoomInOptimize: {
		lastDrawnScale: number;
		lastDrawnViewport: viewport;
		timeout: NodeJS.Timeout | null;
		lastCallTime: number;
	};

	private get canvas() {
		if (this._canvas === null) throw destroyError;
		return this._canvas;
	}

	constructor(data: runtimeData, registry: registry) {
		registry.register({
			hooks: {
				onDispose: [this.dispose],
				onRender: [this.redraw],
				onResize: [this.optimizeDPR],
			},
		});
		this._canvas = document.createElement('canvas');
		this._canvas.className = 'main-canvas';
		data.container.appendChild(this._canvas);
		this.ctx = this._canvas.getContext('2d') as CanvasRenderingContext2D;
		this.zoomInOptimize = {
			lastDrawnScale: 0,
			lastDrawnViewport: {
				left: 0,
				right: 0,
				top: 0,
				bottom: 0,
			},
			timeout: null,
			lastCallTime: 0,
		};
		this.data = data;
	}

	private optimizeDPR = () => resizeCanvasForDPR(this.canvas, this.data.container.offsetWidth, this.data.container.offsetHeight);

	private redraw = () => {
		if (this.zoomInOptimize.timeout) {
			clearTimeout(this.zoomInOptimize.timeout);
			this.zoomInOptimize.timeout = null;
		}
		const now = Date.now();
		const currentViewport = this.getCurrentViewport(this.data.offsetX, this.data.offsetY, this.data.scale);
		if (this.isViewportInside(currentViewport, this.zoomInOptimize.lastDrawnViewport) && this.data.scale !== this.zoomInOptimize.lastDrawnScale) {
			const timeSinceLast = now - this.zoomInOptimize.lastCallTime;
			if (timeSinceLast < CSS_ZOOM_REDRAW_INTERVAL) {
				this.zoomInOptimize.timeout = setTimeout(() => {
					this.trueRedraw(this.data.offsetX, this.data.offsetY, this.data.scale, currentViewport);
					this.zoomInOptimize.lastCallTime = now;
					this.zoomInOptimize.timeout = null;
				}, 60);
				this.fakeRedraw(currentViewport, this.data.scale);
				return;
			}
		}
		this.zoomInOptimize.lastCallTime = now;
		this.trueRedraw(this.data.offsetX, this.data.offsetY, this.data.scale, currentViewport);
	};

	private trueRedraw(offsetX: number, offsetY: number, scale: number, currentViewport: viewport) {
		this.zoomInOptimize.lastDrawnViewport = currentViewport;
		this.zoomInOptimize.lastDrawnScale = scale;
		this.canvas.style.transform = '';
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.save();
		this.ctx.translate(offsetX, offsetY);
		this.ctx.scale(scale, scale);
		this.data.canvasData.nodes.forEach(node => {
			switch (node.type) {
				case 'group':
					this.drawGroup(node, scale);
					break;
				case 'file':
					this.drawFileNode(node);
					break;
			}
		});
		this.data.canvasData.edges.forEach(edge => this.drawEdge(edge));
		this.ctx.restore();
	}

	private fakeRedraw(currentViewport: viewport, scale: number) {
		const cssScale = scale / this.zoomInOptimize.lastDrawnScale;
		const currentOffsetX = (this.zoomInOptimize.lastDrawnViewport.left - currentViewport.left) * scale;
		const currentOffsetY = (this.zoomInOptimize.lastDrawnViewport.top - currentViewport.top) * scale;
		this.canvas.style.transform = `translate(${currentOffsetX}px, ${currentOffsetY}px) scale(${cssScale})`;
	}

	private isViewportInside(inner: viewport, outer: viewport) {
		return inner.left > outer.left && inner.top > outer.top && inner.right < outer.right && inner.bottom < outer.bottom;
	}

	private getCurrentViewport(offsetX: number, offsetY: number, scale: number) {
		const left = -offsetX / scale;
		const top = -offsetY / scale;
		const right = left + this.data.container.clientWidth / scale;
		const bottom = top + this.data.container.clientHeight / scale;
		return { left, top, right, bottom };
	}

	private drawLabelBar(x: number, y: number, label: string, color: string, scale: number) {
		const barHeight = 30 * scale;
		const radius = 6 * scale;
		const yOffset = 8 * scale;
		const fontSize = 16 * scale;
		const xPadding = 6 * scale;
		this.ctx.save();
		this.ctx.translate(x, y);
		this.ctx.scale(1 / scale, 1 / scale);
		this.ctx.font = `${fontSize}px 'Inter', sans-serif`;
		const barWidth = this.ctx.measureText(label).width + 2 * xPadding;
		this.ctx.translate(0, -barHeight - yOffset);
		this.ctx.fillStyle = color;
		this.ctx.beginPath();
		this.ctx.moveTo(radius, 0);
		this.ctx.lineTo(barWidth - radius, 0);
		this.ctx.quadraticCurveTo(barWidth, 0, barWidth, radius);
		this.ctx.lineTo(barWidth, barHeight - radius);
		this.ctx.quadraticCurveTo(barWidth, barHeight, barWidth - radius, barHeight);
		this.ctx.lineTo(radius, barHeight);
		this.ctx.quadraticCurveTo(0, barHeight, 0, barHeight - radius);
		this.ctx.lineTo(0, radius);
		this.ctx.quadraticCurveTo(0, 0, radius, 0);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.fillStyle = FONT_COLOR;
		this.ctx.fillText(label, xPadding, barHeight * 0.65);
		this.ctx.restore();
	}

	private drawNodeBackground(node: JSONCanvasNode) {
		const colors = getColor(node.color);
		const radius = NODE_RADIUS;
		this.ctx.globalAlpha = 1.0;
		this.ctx.fillStyle = colors.background;
		drawRoundRect(this.ctx, node.x + 1, node.y + 1, node.width - 2, node.height - 2, radius);
		this.ctx.fill();
		this.ctx.strokeStyle = colors.border;
		this.ctx.lineWidth = 2;
		drawRoundRect(this.ctx, node.x, node.y, node.width, node.height, radius);
		this.ctx.stroke();
	}

	private drawGroup(node: JSONCanvasNode, scale: number) {
		this.drawNodeBackground(node);
		if (node.label) this.drawLabelBar(node.x, node.y, node.label, getColor(node.color).border, scale);
	}

	private drawFileNode(node: JSONCanvasNode) {
		if (!node.file) throw unexpectedError;
		this.ctx.fillStyle = FONT_COLOR;
		this.ctx.font = '16px sans-serif';
		this.ctx.fillText(node.file, node.x + 5, node.y - 10);
	}

	private drawEdge(edge: RuntimeJSONCanvasEdge) {
		const { fromNode, toNode } = this.getEdgeNodes(edge);
		if (!fromNode || !toNode) throw unexpectedError;
		const [startX, startY] = getAnchorCoord(fromNode, edge.fromSide);
		const [endX, endY] = getAnchorCoord(toNode, edge.toSide);
		let [startControlX, startControlY, endControlX, endControlY] = [0, 0, 0, 0];
		if (!edge.controlPoints) {
			[startControlX, startControlY, endControlX, endControlY] = this.getControlPoints(startX, startY, endX, endY, edge.fromSide, edge.toSide);
			edge.controlPoints = [startControlX, startControlY, endControlX, endControlY];
		} else [startControlX, startControlY, endControlX, endControlY] = edge.controlPoints;
		this.drawCurvedPath(startX, startY, endX, endY, startControlX, startControlY, endControlX, endControlY);
		this.drawArrowhead(endX, endY, endControlX, endControlY);
		if (edge.label) {
			const t = 0.5;
			const x = Math.pow(1 - t, 3) * startX + 3 * Math.pow(1 - t, 2) * t * startControlX + 3 * (1 - t) * t * t * endControlX + Math.pow(t, 3) * endX;
			const y = Math.pow(1 - t, 3) * startY + 3 * Math.pow(1 - t, 2) * t * startControlY + 3 * (1 - t) * t * t * endControlY + Math.pow(t, 3) * endY;
			this.ctx.font = '18px sans-serif';
			const metrics = this.ctx.measureText(edge.label);
			const padding = 8;
			const labelWidth = metrics.width + padding * 2;
			const labelHeight = 20;
			this.ctx.fillStyle = '#222';
			this.ctx.beginPath();
			drawRoundRect(this.ctx, x - labelWidth / 2, y - labelHeight / 2 - 2, labelWidth, labelHeight, 4);
			this.ctx.fill();
			this.ctx.fillStyle = '#ccc';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			this.ctx.fillText(edge.label, x, y - 2);
			this.ctx.textAlign = 'left';
			this.ctx.textBaseline = 'alphabetic';
		}
	}

	private getEdgeNodes(edge: JSONCanvasEdge) {
		return {
			fromNode: this.data.nodeMap[edge.fromNode],
			toNode: this.data.nodeMap[edge.toNode],
		};
	}

	private getControlPoints(startX: number, startY: number, endX: number, endY: number, fromSide: string, toSide: string) {
		const distanceX = endX - startX;
		const distanceY = endY - startY;
		const realDistance = Math.min(Math.abs(distanceX), Math.abs(distanceY)) + 0.3 * Math.max(Math.abs(distanceX), Math.abs(distanceY));
		const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
		const PADDING = clamp(realDistance * 0.5, 60, 300);
		let startControlX = startX;
		let startControlY = startY;
		let endControlX = endX;
		let endControlY = endY;
		switch (fromSide) {
			case 'top':
				startControlY = startY - PADDING;
				break;
			case 'bottom':
				startControlY = startY + PADDING;
				break;
			case 'left':
				startControlX = startX - PADDING;
				break;
			case 'right':
				startControlX = startX + PADDING;
				break;
		}
		switch (toSide) {
			case 'top':
				endControlY = endY - PADDING;
				break;
			case 'bottom':
				endControlY = endY + PADDING;
				break;
			case 'left':
				endControlX = endX - PADDING;
				break;
			case 'right':
				endControlX = endX + PADDING;
				break;
		}
		return [startControlX, startControlY, endControlX, endControlY];
	}

	private drawCurvedPath(startX: number, startY: number, endX: number, endY: number, c1x: number, c1y: number, c2x: number, c2y: number) {
		this.ctx.beginPath();
		this.ctx.moveTo(startX, startY);
		this.ctx.bezierCurveTo(c1x, c1y, c2x, c2y, endX, endY);
		this.ctx.strokeStyle = '#ccc';
		this.ctx.lineWidth = 2;
		this.ctx.stroke();
	}

	private drawArrowhead(tipX: number, tipY: number, fromX: number, fromY: number) {
		const dx = tipX - fromX;
		const dy = tipY - fromY;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length === 0) return;
		const unitX = dx / length;
		const unitY = dy / length;
		const leftX = tipX - unitX * ARROW_LENGTH - unitY * ARROW_WIDTH;
		const leftY = tipY - unitY * ARROW_LENGTH + unitX * ARROW_WIDTH;
		const rightX = tipX - unitX * ARROW_LENGTH + unitY * ARROW_WIDTH;
		const rightY = tipY - unitY * ARROW_LENGTH - unitX * ARROW_WIDTH;
		this.ctx.beginPath();
		this.ctx.fillStyle = '#ccc';
		this.ctx.moveTo(tipX, tipY);
		this.ctx.lineTo(leftX, leftY);
		this.ctx.lineTo(rightX, rightY);
		this.ctx.closePath();
		this.ctx.fill();
	}

	private dispose = () => {
		if (this.zoomInOptimize.timeout) {
			clearTimeout(this.zoomInOptimize.timeout);
			this.zoomInOptimize.timeout = null;
		}
		this.canvas.remove();
		this._canvas = null;
	};
}