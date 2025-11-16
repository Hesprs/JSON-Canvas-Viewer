import { OmniKernel, makeConfig } from 'omnikernel';

import Core from './canvasViewer';
import DataManager from './dataManager';
import InteractionHandler from './interactionHandler';
import OverlayManager from './overlayManager';
import Renderer from './renderer';
import Utilities from './utilities';

export default class CanvasViewer {
	constructor(options: Record<string, any>, modules: Array<Module> = []) {
		const OptionModule = makeConfig(options);
		const allModules: Array<Module> = [OptionModule, Utilities, DataManager, Core, Renderer, InteractionHandler, OverlayManager, ...modules];
		const Kernel = new OmniKernel(allModules);
		return Kernel;
	}
}