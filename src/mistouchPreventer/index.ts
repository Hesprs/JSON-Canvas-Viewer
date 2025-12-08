import { FacadeUnit, manifest, Reactive, Runner } from 'omnikernel';
import { destroyError } from '@/shared';
import style from './styles.scss?inline';

@manifest({
	name: 'mistouchPreventer',
	dependsOn: ['dataManager', 'utilities', 'renderer', 'overlayManager'],
})
export default class MistouchPreventer extends FacadeUnit {
	private _preventionContainer: HTMLDivElement | null = null;
	private _preventionBanner: HTMLDivElement | null = null;
	private preventMt: boolean = false;
	private dataManager: Facade;
	private preventMistouch: {
		record: boolean;
		lastX: number;
		lastY: number;
		initialX: number;
		initialY: number;
	} = {
		record: false,
		lastX: 0,
		lastY: 0,
		initialX: 0,
		initialY: 0,
	};

	private get preventionContainer() {
		if (this._preventionContainer === null) throw destroyError;
		return this._preventionContainer;
	}
	private get preventionBanner() {
		if (this._preventionBanner === null) throw destroyError;
		return this._preventionBanner;
	}

	constructor(...args: UnitArgs) {
		super(...args);
		this.Kernel.register(
			{
				startPrevention: this.startPrevention,
				endPrevention: this.endPrevention,
				tipText: new Reactive('Frozen to prevent mistouch, click on to unlock.'),
				preventAtStart: true,
			},
			this.facade,
		);
		this._preventionBanner = document.createElement('div');
		this._preventionBanner.className = 'prevention-banner';
		this.Kernel.register(
			{ tipText: { mistouchPreventer: new Runner(this.setText, { immediate: true }) } },
			this.facade,
		);
		this.dataManager = this.deps.dataManager;
		this._preventionContainer = document.createElement('div');
		this._preventionContainer.className = 'prevention-container hidden';

		this.deps.utilities.applyStyles(this._preventionContainer, style);
		this._preventionContainer.appendChild(this._preventionBanner);
		(this.dataManager.data.container() as HTMLDivElement).appendChild(this._preventionContainer);

		if (this.facade.preventAtStart()) this.startPrevention();

		window.addEventListener('pointerdown', this.onPointerDown);
		window.addEventListener('pointermove', this.onPointerMove);
		window.addEventListener('pointerup', this.onPointerUp);
	}

	private setText = () => {
		this.preventionBanner.innerHTML = this.facade.tipText() as string;
	};

	private onPointerDown = (e: PointerEvent) => {
		const bounds = (this.dataManager.data.container() as HTMLDivElement).getBoundingClientRect();
		if (
			e.clientX < bounds.left ||
			e.clientX > bounds.right ||
			e.clientY < bounds.top ||
			e.clientY > bounds.bottom
		) {
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
			if (
				Math.abs(this.preventMistouch.lastX - this.preventMistouch.initialX) +
					Math.abs(this.preventMistouch.lastY - this.preventMistouch.initialY) <
				5
			)
				this.endPrevention();
		}
	};

	private startPrevention = () => {
		this.preventionContainer.classList.remove('hidden');
		(this.dataManager.data.container() as HTMLDivElement).classList.add('numb');
		this.preventMt = true;
	};

	private endPrevention = () => {
		this.preventMt = false;
		this.preventionContainer.classList.add('hidden');
		setTimeout(() => (this.dataManager.data.container() as HTMLDivElement).classList.remove('numb'), 50); // minimum delay to prevent triggering undesired button touch
	};

	dispose = () => {
		window.removeEventListener('pointerdown', this.onPointerDown);
		window.removeEventListener('pointermove', this.onPointerMove);
		window.removeEventListener('pointerup', this.onPointerUp);
		this.preventionContainer.remove();
		this._preventionContainer = null;
	};
}
