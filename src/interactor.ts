import { unexpectedError, destroyError } from './renderer';

export default class interactor extends EventTarget {
	private _monitoringElement: HTMLElement | null;
	private pointers: Map<
		number,
		{
			startX: number;
			startY: number;
			lastX: number;
			lastY: number;
			interrupted: boolean;
			target: EventTarget | null;
		}
	> = new Map();
	private pinchZoomState: {
		lastDistance: number;
		lastMidpoint: { x: number; y: number };
	};
	private proControlSchema: boolean;
	private panDump: Coordinates;
	private zoomDump: {
		factor: number;
		origin: Coordinates;
	};
	private zoomFactor: number;
	private preventDefault: boolean;
	private lockControlSchema: boolean;

	private get monitoringElement() {
		if (this._monitoringElement === null) throw destroyError;
		return this._monitoringElement;
	}

	constructor(monitoringElement: HTMLElement, options?: { preventDefault?: boolean; proControlSchema?: boolean; zoomFactor?: number; lockControlSchema?: boolean }) {
		super();
		this._monitoringElement = monitoringElement;
		const option = options || {};
		this.preventDefault = option.preventDefault || false;
		this.proControlSchema = option.proControlSchema || false;
		this.zoomFactor = option.zoomFactor || 0.002;
		this.lockControlSchema = option.lockControlSchema || false;
		this.pointers.clear();
		this.pinchZoomState = {
			lastDistance: 0,
			lastMidpoint: { x: 0, y: 0 },
		};
		this.panDump = { x: 0, y: 0 };
		this.zoomDump = {
			factor: 1,
			origin: { x: 0, y: 0 },
		};
	}

	private getNthValue(n: number) {
		if (n < 0 || n >= this.pointers.size) throw unexpectedError;
		let i = 0;
		for (const value of this.pointers.values()) {
			if (i === n) return value;
			i++;
		}
	}

	private getPointerDistance() {
		const pointer0 = this.getNthValue(0);
		const pointer1 = this.getNthValue(1);
		if (!pointer0 || !pointer1) throw unexpectedError;
		const dx = pointer0.lastX - pointer1.lastX;
		const dy = pointer0.lastY - pointer1.lastY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	// output screen coords
	private getPointerMidpoint() {
		const pointer0 = this.getNthValue(0);
		const pointer1 = this.getNthValue(1);
		if (!pointer0 || !pointer1) throw unexpectedError;
		return {
			x: (pointer0.lastX + pointer1.lastX) / 2,
			y: (pointer0.lastY + pointer1.lastY) / 2,
		};
	}

	// Screen to Container
	private S2C({ x: screenX, y: screenY }: Coordinates) {
		const rect = this.monitoringElement.getBoundingClientRect();
		return {
			x: screenX - rect.left,
			y: screenY - rect.top,
		};
	}

	private onPointerDown = (e: PointerEvent) => {
		if (this.pointers.size >= 2) return;
		if (e.isPrimary) this.pointers.clear();
		this.pointers.set(e.pointerId, {
			startX: e.clientX,
			startY: e.clientY,
			lastX: e.clientX,
			lastY: e.clientY,
			interrupted: false,
			target: e.target,
		});
		if (this.pointers.size === 2) {
			const pointer0 = this.getNthValue(0);
			const pointer1 = this.pointers.get(e.pointerId);
			if (!pointer0 || !pointer1) throw unexpectedError;
			pointer0.interrupted = true;
			pointer1.interrupted = true;
			this.pinchZoomState.lastDistance = this.getPointerDistance();
			this.pinchZoomState.lastMidpoint = this.S2C(this.getPointerMidpoint());
		}
	};

	private onPointerMove = (e: PointerEvent) => {
		const pointer = this.pointers.get(e.pointerId);
		if (!pointer) return;
		if (this.pointers.size === 1) {
			const dx = e.clientX - pointer.lastX;
			const dy = e.clientY - pointer.lastY;
			this.dispatchPanEvent({ x: dx, y: dy });
		}
		this.pointers.set(e.pointerId, {
			startX: pointer.startX,
			startY: pointer.startY,
			lastX: e.clientX,
			lastY: e.clientY,
			interrupted: pointer.interrupted,
			target: pointer.target,
		});
		if (this.pointers.size === 2) {
			const newDistance = this.getPointerDistance();
			const newMidpointOnScreen = this.getPointerMidpoint();
			if (!newDistance || !newMidpointOnScreen) throw unexpectedError;
			let zoomFactor = newDistance / this.pinchZoomState.lastDistance;
			this.pinchZoomState.lastDistance = newDistance;
			const newMidpoint = this.S2C(newMidpointOnScreen);
			const dx = newMidpoint.x - this.pinchZoomState.lastMidpoint.x;
			const dy = newMidpoint.y - this.pinchZoomState.lastMidpoint.y;
			this.pinchZoomState.lastMidpoint = newMidpoint;
			this.dispatchPanEvent({ x: dx, y: dy });
			this.dispatchZoomEvent(zoomFactor, newMidpoint);
		}
	};

	private onPointerUp = (e: PointerEvent) => {
		const pointer = this.pointers.get(e.pointerId);
		if (!pointer) return;
		this.pointers.delete(e.pointerId);
		if (this.pointers.size === 0 && !pointer.interrupted) {
			if (Math.abs(pointer.startX - e.clientX) + Math.abs(pointer.startY - e.clientY) < 5) {
				const coords = this.S2C({ x: e.clientX, y: e.clientY });
				const clickEvent = new CustomEvent<{ position: Coordinates; target: EventTarget | null }>('trueClick', { detail: { position: coords, target: pointer.target } });
				this.dispatchEvent(clickEvent);
			}
		}
	};

	private onWheel = (e: WheelEvent) => {
		if (!this.lockControlSchema && !this.proControlSchema && (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) this.proControlSchema = true;
		if (this.preventDefault) e.preventDefault();
		if (this.proControlSchema && !e.ctrlKey) this.dispatchPanEvent({ x: e.deltaX, y: e.deltaY });
		else {
			const scaleFactor = 1 - this.zoomFactor * e.deltaY;
			const origin = this.S2C({ x: e.clientX, y: e.clientY });
			this.dispatchZoomEvent(scaleFactor, origin);
		}
	};

	private dispatchPanEvent(diff: Coordinates) {
		const roundedDiff = {
			x: this.round(diff.x, 1),
			y: this.round(diff.y, 1),
		};
		this.panDump.x += roundedDiff.x;
		this.panDump.y += roundedDiff.y;
		const panEvent = new CustomEvent<Coordinates>('pan', { detail: roundedDiff });
		this.dispatchEvent(panEvent);
	}

	private dispatchZoomEvent(factor: number, origin: Coordinates) {
		const roundedFactor = this.round(factor, 4);
		this.zoomDump.factor *= roundedFactor;
		this.zoomDump.origin = origin;
		const zoomEvent = new CustomEvent<{ factor: number; origin: Coordinates }>('zoom', { detail: { factor: roundedFactor, origin: origin } });
		this.dispatchEvent(zoomEvent);
	}

	private preventDefaultFunction = (e: Event) => e.preventDefault;

	private round(roundedNum: number, digits: number) {
		const factor = 10 ** digits;
		return Math.round(roundedNum * factor) / factor;
	}

	getZoomDump() {
		return this.zoomDump;
	}

	resetZoomDump() {
		this.zoomDump.factor = 1;
	}

	getPanDump() {
		return this.panDump;
	}

	resetPanDump() {
		this.panDump = { x: 0, y: 0 };
	}

	stop() {
		this.monitoringElement.removeEventListener('pointerdown', this.onPointerDown);
		window.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);
		this.monitoringElement.removeEventListener('wheel', this.onWheel);
		if (this.preventDefault) {
			this.monitoringElement.style.touchAction = '';
			this.monitoringElement.removeEventListener('gesturestart', this.preventDefaultFunction);
			this.monitoringElement.removeEventListener('gesturechange', this.preventDefaultFunction);
		}
	}

	start() {
		this.monitoringElement.addEventListener('pointerdown', this.onPointerDown);
		window.addEventListener('pointermove', this.onPointerMove);
		window.addEventListener('pointerup', this.onPointerUp);
		this.monitoringElement.addEventListener('wheel', this.onWheel, this.preventDefault ? { passive: false } : {});
		if (this.preventDefault) {
			this.monitoringElement.style.touchAction = 'none';
			this.monitoringElement.addEventListener('gesturestart', this.preventDefaultFunction, { passive: false });
			this.monitoringElement.addEventListener('gesturechange', this.preventDefaultFunction, { passive: false });
		}
	}

	dispose() {
		this.stop();
		this.pointers.clear();
		this._monitoringElement = null;
	}
}
