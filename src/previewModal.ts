import { RuntimeJSONCanvasNode, unexpectedError, destroyError } from './renderer';

export default class previewModal extends EventTarget {
	private _previewModalBackdrop: HTMLDivElement | null;
	private _previewModal: HTMLDivElement | null;
	private _previewModalContent: HTMLDivElement | null;
	private _canvasBaseDir: string | null = null;
	private _previewModalClose: HTMLButtonElement | null;

	private get previewModalBackdrop() {
		if (!this._previewModalBackdrop) throw destroyError;
		return this._previewModalBackdrop;
	}
	private get previewModal() {
		if (!this._previewModal) throw destroyError;
		return this._previewModal;
	}
	private get previewModalContent() {
		if (!this._previewModalContent) throw destroyError;
		return this._previewModalContent;
	}
	private get canvasBaseDir() {
		if (!this._canvasBaseDir) throw destroyError;
		return this._canvasBaseDir;
	}
	private get previewModalClose() {
		if (!this._previewModalClose) throw destroyError;
		return this._previewModalClose;
	}

	constructor(container: HTMLElement) {
		super();
		this._previewModalBackdrop = document.createElement('div');
		this._previewModalBackdrop.className = 'preview-modal-backdrop hidden';
		container.appendChild(this._previewModalBackdrop);

		this._previewModal = document.createElement('div');
		this._previewModal.className = 'preview-modal hidden';

		this._previewModalClose = document.createElement('button');
		this._previewModalClose.className = 'preview-modal-close';
		this._previewModalClose.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6.758 17.243 12.001 12m5.243-5.243L12 12m0 0L6.758 6.757M12.001 12l5.243 5.243" stroke-width="2" stroke-linecap="round" /></svg>';
		this._previewModal.appendChild(this._previewModalClose);

		this._previewModalContent = document.createElement('div');
		this._previewModalContent.className = 'preview-modal-content';
		this._previewModal.appendChild(this._previewModalContent);

		container.appendChild(this._previewModal);

		this._previewModalClose.addEventListener('click', this.hidePreviewModal);
		this._previewModalBackdrop.addEventListener('click', this.hidePreviewModal);
	}

	receiveData(canvasBaseDir: string) {
		this._canvasBaseDir = canvasBaseDir;
	}

	showPreviewModal(node: RuntimeJSONCanvasNode) {
		const content = this.processContent(node);
		if (!content) throw unexpectedError;
		this.previewModalContent.innerHTML = '';
		this.previewModalBackdrop.classList.remove('hidden');
		this.previewModal.classList.remove('hidden');
		this.previewModalContent.appendChild(content);
		this.dispatchEvent(new CustomEvent('previewModalShown'));
	}

	hidePreviewModal = () => {
		this.previewModalBackdrop.classList.add('hidden');
		this.previewModal.classList.add('hidden');
		this.dispatchEvent(new CustomEvent('previewModalHidden'));
	};

	resize(width: number, height: number) {
		this.previewModal.style.setProperty('--preview-max-width', `${width * 0.9}px`);
		this.previewModal.style.setProperty('--preview-max-height', `${height * 0.9}px`);
	}

	private processContent(node: RuntimeJSONCanvasNode) {
		if (!node.file) throw unexpectedError;
		let content;
		if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
			content = new Image();
			content.src = this.canvasBaseDir + node.file;
		} else if (node.file.match(/\.mp3$/i)) {
			content = document.createElement('audio');
			content.controls = true;
			content.src = this.canvasBaseDir + node.file;
		}
		return content;
	}

	dispose() {
		this.previewModalClose.removeEventListener('click', this.hidePreviewModal);
		this.previewModalBackdrop.removeEventListener('click', this.hidePreviewModal);
		while (this.previewModalContent.firstElementChild) this.previewModalContent.firstElementChild.remove();
		this.previewModal.remove();
		this.previewModalBackdrop.remove();
		this._previewModal = null;
		this._previewModalClose = null;
		this._previewModalBackdrop = null;
		this._previewModalContent = null;
	}
}
