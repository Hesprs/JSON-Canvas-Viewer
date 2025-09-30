import { destroyError } from '../utilities';

export default class mistouchPreventer {
	private _preventionContainer: HTMLDivElement | null;
	private preventMt: boolean = false;
	private preventMistouch: { record: boolean; lastX: number; lastY: number; initialX: number; initialY: number };
	private data: runtimeData;

	private get preventionContainer() {
		if (this._preventionContainer === null) throw destroyError;
		return this._preventionContainer;
	}

	constructor(data: runtimeData, registry: registry) {
		registry.register({
			hooks: {
				onDispose: [this.dispose],
			},
			options: {
				mistouchPreventer: {
					preventAtStart: true,
				},
			},
		});
		this._preventionContainer = document.createElement('div');
		this._preventionContainer.className = 'prevention-container hidden';
		const preventionBanner = document.createElement('div');
		preventionBanner.className = 'prevention-banner';
		preventionBanner.innerHTML = 'Frozen to prevent mistouch, click on to unlock.';
		this._preventionContainer.appendChild(preventionBanner);
		data.container.appendChild(this._preventionContainer);
		this.preventMistouch = {
			record: false,
			lastX: 0,
			lastY: 0,
			initialX: 0,
			initialY: 0,
		};

		if (registry.options.mistouchPreventer.preventAtStart) this.startPrevention();
		this.data = data;

		window.addEventListener('pointerdown', this.onPointerDown);
		window.addEventListener('pointermove', this.onPointerMove);
		window.addEventListener('pointerup', this.onPointerUp);
	}

	private onPointerDown = (e: PointerEvent) => {
		const bounds = this.data.container.getBoundingClientRect();
		if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) {
			if (!this.preventMt) this.startPrevention();
		} else if (this.preventMt) {
			this.preventMistouch.initialX = e.clientX;
			this.preventMistouch.initialY = e.clientY;
			this.preventMistouch.lastX = e.clientX;
			this.preventMistouch.lastY = e.clientY;
			this.preventMistouch.record = true;
		}
	};

	private onPointerMove = (e: PointerEvent) => {
		if (this.preventMistouch.record) {
			this.preventMistouch.lastX = e.clientX;
			this.preventMistouch.lastY = e.clientY;
		}
	};

	private onPointerUp = () => {
		if (this.preventMistouch.record) {
			this.preventMistouch.record = false;
			if (Math.abs(this.preventMistouch.lastX - this.preventMistouch.initialX) + Math.abs(this.preventMistouch.lastY - this.preventMistouch.initialY) < 5) this.endPrevention();
		}
	};

	startPrevention() {
		this.preventionContainer.classList.remove('hidden');
		this.data.container.classList.add('numb');
		this.preventMt = true;
	}

	endPrevention() {
		this.preventMt = false;
		this.preventionContainer.classList.add('hidden');
		setTimeout(() => this.data.container.classList.remove('numb'), 50); // minimum delay to prevent triggering undesired button touch
	}

	dispose() {
		window.removeEventListener('pointerdown', this.onPointerDown);
		window.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);
		this.preventionContainer.remove();
		this._preventionContainer = null;
	}
}
