import { destroyError } from '../../shared';
import { api } from 'omnikernel';
import style from './styles.scss?inline';

export default class mistouchPreventer {
	private _preventionContainer: HTMLDivElement | null;
	private preventMt: boolean = false;
	private preventMistouch: { record: boolean; lastX: number; lastY: number; initialX: number; initialY: number };
	private Kernel: Amoeba;

	private get preventionContainer() {
		if (this._preventionContainer === null) throw destroyError;
		return this._preventionContainer;
	}

	constructor(Kernel: Amoeba) {
		Kernel._register({
			mistouchPreventer: {
				startPrevention: api(this.startPrevention),
				endPrevention: api(this.endPrevention),
				tipText: 'Frozen to prevent mistouch, click on to unlock.',
				preventAtStart: true,
			},
			dispose: this.dispose,
		});
		this.Kernel = Kernel;
		this._preventionContainer = document.createElement('div');
		this._preventionContainer.className = 'prevention-container hidden';

		Kernel.utilities.applyStyles(this._preventionContainer, style);

		const preventionBanner = document.createElement('div');
		preventionBanner.className = 'prevention-banner';
		preventionBanner.innerHTML = Kernel.mistouchPreventer.tipText();
		this._preventionContainer.appendChild(preventionBanner);
		Kernel.data.container().appendChild(this._preventionContainer);
		this.preventMistouch = {
			record: false,
			lastX: 0,
			lastY: 0,
			initialX: 0,
			initialY: 0,
		};

		if (Kernel.mistouchPreventer.preventAtStart) this.startPrevention();

		window.addEventListener('pointerdown', this.onPointerDown);
		window.addEventListener('pointermove', this.onPointerMove);
		window.addEventListener('pointerup', this.onPointerUp);
	}

	private onPointerDown = (e: PointerEvent) => {
		const bounds = this.Kernel.data.container().getBoundingClientRect();
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

	private startPrevention = () => {
		this.preventionContainer.classList.remove('hidden');
		this.Kernel.data.container().classList.add('numb');
		this.preventMt = true;
	};

	private endPrevention = () => {
		this.preventMt = false;
		this.preventionContainer.classList.add('hidden');
		setTimeout(() => this.Kernel.data.container().classList.remove('numb'), 50); // minimum delay to prevent triggering undesired button touch
	};

	private dispose = () => {
		window.removeEventListener('pointerdown', this.onPointerDown);
		window.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);
		this.preventionContainer.remove();
		this._preventionContainer = null;
	};
}
