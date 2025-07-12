// v1.4.0

// #region Variables
const nodeMap = {};
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const overlaysLayer = document.getElementById('overlays');
const minimap = document.getElementById('minimap-canvas');
const minimapCtx = minimap.getContext('2d');
const overlays = {};
const dpr = window.devicePixelRatio || 1;
let canvasData = null;
let canvasBaseDir = null;
let offsetX = canvas.width / 2;
let offsetY = canvas.height / 2;
let scale = 1.0;
let targetScale = 1.0; // Target scale for smooth zooming
let isMinimapVisible = true;
let spatialGrid = null;
let touchPadMode = false;
let isPreviewModalOpen = false;

// Markdown and image cache
const markdownCache = {};

// === Constants ===
const ARROW_LENGTH = 12;
const ARROW_WIDTH = 7;
const FILE_NODE_RADIUS = 12;
const GRID_CELL_SIZE = 300;
const FONT_COLOR = '#fff';
const ZOOM_SMOOTHNESS = 0.4; // Adjust this value to control zoom smoothness (0-1)
const ZOOM_FACTOR = 1.06;

// === Grouped State Objects ===
const dragState = {
    isDragging: false,
    lastX: 0,
    lastY: 0,
    lastClientX: 0,
    lastClientY: 0,
    lastTouchPoint: null
};
const overlayState = {
    selectedOverlayId: null,
    isHoveringSelectedOverlay: false
};

// === Pinch-to-Zoom State ===
const pinchZoomState = {
    isPinching: false,
    initialDistance: 0,
    initialScale: 1,
    initialMidpoint: { x: 0, y: 0 },
    lastTouches: [],
    lastMidpointX: 0,
    lastMidpointY: 0
};

const perFrame = {
    needAnimating: true,
    zoom: false,
    zoomOrigin: {
        x: 0,
        y: 0,
        screenX: 0,
        screenY: 0,
    },
    wheelPan: false,
    wheelPanEvent: null,
    resize: false,
    resizeScale: { width: 0, height: 0 },
    mouseMove: false,
    moveParams: {
        e: null,
        touch: false,
    },
}
// #endregion

// #region Utility Functions
function getColor(colorIndex) {
    let themeColor = null;
    switch (colorIndex) {
        case "1":
            themeColor = "rgba(255, 120, 129, ?)";
            break;
        case "2":
            themeColor = "rgba(251, 187, 131, ?)";
            break;
        case "3":
            themeColor = "rgba(255, 232, 139, ?)";
            break;
        case "4":
            themeColor = "rgba(124, 211, 124, ?)";
            break;
        case "5":
            themeColor = "rgba(134, 223, 226, ?)";
            break;
        case "6":
            themeColor = "rgba(203, 158, 255, ?)";
            break;
        default:
            themeColor = "rgba(162, 162, 162, ?)";
    }
    return {
        border: themeColor.replace("?", "0.75"),
        background: themeColor.replace("?", "0.1"),
        active: themeColor.replace("?", "1")
    }
}

function onWindowResize() {
    perFrame.resize = true;
    perFrame.resizeScale.width = window.innerWidth;
    perFrame.resizeScale.height = window.innerHeight;
}

function isUIControl(target) {
    return target.closest && (
        target.closest('#controls') ||
        target.closest('button') ||
        target.closest('input')
    );
}

function findNodeAt(x, y) {
    let candidates = [];
    if (!spatialGrid) candidates = canvasData.nodes;
    else {
        const col = Math.floor(x / GRID_CELL_SIZE);
        const row = Math.floor(y / GRID_CELL_SIZE);
        const key = `${col},${row}`;
        candidates = spatialGrid[key] || [];
    }
    for (const node of candidates) {
        if (x < node.x || x > node.x + node.width || y < node.y || y > node.y + node.height || overlayJudger(node) === 0) continue;
        return node;
    }
}

function pointerAtWorld(e) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return {
        x: (screenX - offsetX) / scale,
        y: (screenY - offsetY) / scale,
        screenX: screenX,
        screenY: screenY
    };
}

function overlayJudger(node) { // how should the app handle the click of certain overlays
    const type = node == undefined ? 'default' : node.type;
    switch (type) {
        case 'text': return 1;
        case 'link': return 1;
        case 'file': return node.file.match(/\.md$/i) ? 1 : 2;
        default: return 0;
    }
}
// #endregion

// #region Draw
// === Canvas ===
function draw() {
    if (!perFrame.needAnimating && !perFrame.wheelPan && !perFrame.resize && !perFrame.mouseMove && !perFrame.zoom) {
        requestAnimationFrame(draw);
        return;
    }
    if (perFrame.needAnimating) perFrame.needAnimating = false;
    if (perFrame.wheelPan) wheelPan(perFrame.wheelPanEvent);
    if (perFrame.zoom) smoothZoom();
    if (perFrame.resize) {
        perFrame.resize = false;
        resizeCanvasForDPR(canvas, ctx, perFrame.resizeScale.width, perFrame.resizeScale.height);
    }
    if (perFrame.mouseMove) {
        perFrame.mouseMove = false;
        mouseMove(perFrame.moveParams.e, perFrame.moveParams.touch);
    }
    overlaysLayer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    // Cache viewport status for all nodes
    canvasData.nodes.forEach(node => node._inViewport = isNodeInViewport(node));
    canvasData.nodes.forEach(node => {
        switch (node.type) {
            case 'group': drawGroup(node); break;
            case 'file': drawFileNode(node); break;
        }
    });
    canvasData.edges.forEach(drawEdge);
    ctx.restore();
    updateAllOverlays();
    updateViewportRectangle();
    requestAnimationFrame(draw);
}

function resizeCanvasForDPR(canvas, ctx, width, height) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset any existing transforms
    ctx.scale(dpr, dpr);
}

function drawLabelBar(x, y, label, colors) {
    const barHeight = 30 * scale;
    const radius = 6 * scale;
    const yOffset = 8 * scale;
    const fontSize = 16 * scale;
    const xPadding = 6 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1/scale, 1/scale);
    ctx.font = `${fontSize}px 'Inter', sans-serif`;
    const barWidth = ctx.measureText(label).width + 2 * xPadding;
    ctx.translate(0, -barHeight - yOffset);
    ctx.fillStyle = colors.border;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(barWidth - radius, 0);
    ctx.quadraticCurveTo(barWidth, 0, barWidth, radius);
    ctx.lineTo(barWidth, barHeight - radius);
    ctx.quadraticCurveTo(barWidth, barHeight, barWidth - radius, barHeight);
    ctx.lineTo(radius, barHeight);
    ctx.quadraticCurveTo(0, barHeight, 0, barHeight - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = FONT_COLOR;
    ctx.fillText(label, xPadding, barHeight * 0.65);
    ctx.restore();
}

function drawRoundRect(ctx, x, y, width, height, radius) {
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

function drawNodeBackground(node) {
    const colors = getColor(node.color);
    const radius = FILE_NODE_RADIUS;
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = colors.background;
    drawRoundRect(ctx, node.x + 1, node.y + 1, node.width - 2, node.height - 2, radius);
    ctx.fill();
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    drawRoundRect(ctx, node.x, node.y, node.width, node.height, radius);
    ctx.stroke();
}

function drawGroup(node) {
    drawNodeBackground(node);
    if (node.label) drawLabelBar(node.x, node.y, node.label, getColor(node.color));
}

function drawFileNode(node) {
    if (!node.file.match(/\.md|png|jpg|jpeg|gif|svg$/i)) {
        drawNodeBackground(node);
        if (node.file.match(/\.mp3$/i)) {
            ctx.fillStyle = FONT_COLOR;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Click to preview 🎵', node.x + node.width / 2, node.y + node.height / 2);
            ctx.textAlign = 'left';
        }
    }
    ctx.fillStyle = FONT_COLOR;
    ctx.font = '16px sans-serif';
    ctx.fillText(node.file, node.x + 5, node.y - 10);
    if (node._inViewport) {
        if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) updateOrCreateOverlay(node, canvasBaseDir + node.file, 'image');
        else if (node.file.match(/\.md$/i)) loadMarkdownForNode(node);
    }
}

function drawEdge(edge) {
    const { fromNode, toNode } = getEdgeNodes(edge);
    if (!fromNode || !toNode) return;
    const [startX, startY] = getAnchorCoord(fromNode, edge.fromSide);
    const [endX, endY] = getAnchorCoord(toNode, edge.toSide);
    const [startControlX, startControlY, endControlX, endControlY] = getControlPoints(
        startX, startY, endX, endY, 
        edge.fromSide, edge.toSide
    );
    drawCurvedPath(startX, startY, endX, endY, startControlX, startControlY, endControlX, endControlY);
    drawArrowhead(endX, endY, endControlX, endControlY);
    if (edge.label) {
        const t = 0.5; 
        const x = Math.pow(1-t,3)*startX + 3*Math.pow(1-t,2)*t*startControlX + 3*(1-t)*t*t*endControlX + Math.pow(t,3)*endX;
        const y = Math.pow(1-t,3)*startY + 3*Math.pow(1-t,2)*t*startControlY + 3*(1-t)*t*t*endControlY + Math.pow(t,3)*endY;
        ctx.font = '18px sans-serif';
        const metrics = ctx.measureText(edge.label);
        const padding = 8;
        const labelWidth = metrics.width + (padding * 2);
        const labelHeight = 20;
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(
            x - labelWidth/2,
            y - labelHeight/2 - 2,
            labelWidth,
            labelHeight,
            4
        );
        ctx.fill();
        ctx.fillStyle = '#ccc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.label, x, y - 2);
        ctx.textAlign = 'left'; 
        ctx.textBaseline = 'alphabetic'; 
    }
}

function getEdgeNodes(edge) {
    return {
        fromNode: nodeMap[edge.fromNode],
        toNode: nodeMap[edge.toNode]
    };
}

function getControlPoints(startX, startY, endX, endY, fromSide, toSide) {
    const distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
    const PADDING = clamp(distance * 0.3, 60, 300);
    let startControlX = startX;
    let startControlY = startY;
    let endControlX = endX;
    let endControlY = endY;
    switch (fromSide) {
        case 'top': startControlY = startY - PADDING; break;
        case 'bottom': startControlY = startY + PADDING; break;
        case 'left': startControlX = startX - PADDING; break;
        case 'right': startControlX = startX + PADDING; break;
    }
    switch (toSide) {
        case 'top': endControlY = endY - PADDING; break;
        case 'bottom': endControlY = endY + PADDING; break;
        case 'left': endControlX = endX - PADDING; break;
        case 'right': endControlX = endX + PADDING; break;
    }
    return [startControlX, startControlY, endControlX, endControlY];
}

function drawCurvedPath(startX, startY, endX, endY, c1x, c1y, c2x, c2y) {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, endX, endY);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function getAnchorCoord(node, side) {
    const midX = node.x + node.width / 2;
    const midY = node.y + node.height / 2;
    switch (side) {
        case 'top': return [midX, node.y];
        case 'bottom': return [midX, node.y + node.height];
        case 'left': return [node.x, midY];
        case 'right': return [node.x + node.width, midY];
        default: return [midX, midY];
    }
}

function drawArrowhead(tipX, tipY, fromX, fromY) {
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
    ctx.beginPath();
    ctx.fillStyle = '#ccc';
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.fill();
}

// === Minimap ===
function drawMinimap() {
    const bounds = calculateNodesBounds();
    if (!bounds) return;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const minimapRect = minimap.getBoundingClientRect();
    const displayWidth = minimapRect.width;
    const displayHeight = minimapRect.height;
    const scaleX = displayWidth / contentWidth;
    const scaleY = displayHeight / contentHeight;
    const minimapScale = Math.min(scaleX, scaleY) * 0.9;
    const centerX = (minimap.width / dpr) / 2;
    const centerY = (minimap.height / dpr) / 2;
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
    minimapCtx.save();
    minimapCtx.translate(centerX, centerY);
    minimapCtx.scale(minimapScale, minimapScale);
    minimapCtx.translate(-(bounds.minX + contentWidth / 2), -(bounds.minY + contentHeight / 2));
    for (let edge of canvasData.edges) drawMinimapEdge(edge);
    for (let node of canvasData.nodes) drawMinimapNode(node);
    minimapCtx.restore();
}

function calculateNodesBounds() {
    if (!canvasData || !canvasData.nodes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    canvasData.nodes.forEach(node => {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    });
    return { minX, minY, maxX, maxY };
}

function drawMinimapNode(node) {
    const colors = getColor(node.color);
    const radius = 25;
    minimapCtx.fillStyle = colors.border;
    minimapCtx.globalAlpha = 0.3;
    drawRoundRect(minimapCtx, node.x, node.y, node.width, node.height, radius);
    minimapCtx.fill();
    minimapCtx.globalAlpha = 1.0;
}

function drawMinimapEdge(edge) {
    const fromNode = nodeMap[edge.fromNode];
    const toNode = nodeMap[edge.toNode];
    if (!fromNode || !toNode) return;
    const [startX, startY] = getAnchorCoord(fromNode, edge.fromSide);
    const [endX, endY] = getAnchorCoord(toNode, edge.toSide);
    minimapCtx.beginPath();
    minimapCtx.moveTo(startX, startY);
    minimapCtx.lineTo(endX, endY);
    minimapCtx.strokeStyle = '#555';
    minimapCtx.lineWidth = 10;
    minimapCtx.stroke();
}

function updateViewportRectangle() {
    if (!isMinimapVisible) return;
    const bounds = calculateNodesBounds();
    if (!bounds) return;
    const minimap = document.getElementById('minimap-canvas');
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const minimapRect = minimap.getBoundingClientRect();
    const minimapDisplayWidth = minimapRect.width;
    const minimapDisplayHeight = minimapRect.height;
    const scaleX = minimapDisplayWidth / contentWidth;
    const scaleY = minimapDisplayHeight / contentHeight;
    const minimapScale = Math.min(scaleX, scaleY) * 0.9;
    const centerX = minimapDisplayWidth / 2;
    const centerY = minimapDisplayHeight / 2;
    const viewWidth = window.innerWidth / scale;
    const viewHeight = window.innerHeight / scale;
    const viewportCenterX = -offsetX / scale + window.innerWidth / (2 * scale);
    const viewportCenterY = -offsetY / scale + window.innerHeight / (2 * scale);
    const viewRectX = centerX + (viewportCenterX - viewWidth/2 - (bounds.minX + contentWidth/2)) * minimapScale;
    const viewRectY = centerY + (viewportCenterY - viewHeight/2 - (bounds.minY + contentHeight/2)) * minimapScale;
    const viewRectWidth = viewWidth * minimapScale;
    const viewRectHeight = viewHeight * minimapScale;    
    const viewportRect = document.getElementById('viewport-rectangle');
    viewportRect.style.left = viewRectX + 'px';
    viewportRect.style.top = viewRectY + 'px';
    viewportRect.style.width = viewRectWidth + 'px';
    viewportRect.style.height = viewRectHeight + 'px';
}

function setInitialView() {
    const bounds = calculateNodesBounds();
    if (!bounds) return { scale: 1.0, offsetX: canvas.width / 2, offsetY: canvas.height / 2 };
    const PADDING = 50;
    const contentWidth = bounds.maxX - bounds.minX + (PADDING * 2);
    const contentHeight = bounds.maxY - bounds.minY + (PADDING * 2);
    // Use logical dimensions for scaling calculations
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;
    const scaleX = viewWidth / contentWidth;
    const scaleY = viewHeight / contentHeight;
    const newScale = Math.round(Math.min(scaleX, scaleY) * 1000) / 1000;
    const contentCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
    const contentCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
    const initialView = {
        scale: newScale,
        offsetX: viewWidth / 2 - contentCenterX * newScale,
        offsetY: viewHeight / 2 - contentCenterY * newScale
    };
    scale = initialView.scale;
    targetScale = scale; // Set targetScale to the initial scale
    offsetX = initialView.offsetX;
    offsetY = initialView.offsetY;
    zoomSlider.value = scaleToSlider(scale);
    perFrame.needAnimating = true;
    requestAnimationFrame(draw);
}
// #endregion

// #region Overlays
function isNodeInViewport(node, margin = 200) {
    const viewLeft = (-offsetX) / scale - margin;
    const viewTop = (-offsetY) / scale - margin;
    const viewRight = viewLeft + canvas.width / scale + 2 * margin;
    const viewBottom = viewTop + canvas.height / scale + 2 * margin;
    return (
        node.x + node.width > viewLeft &&
        node.x < viewRight &&
        node.y + node.height > viewTop &&
        node.y < viewBottom
    );
}


async function loadMarkdownForNode(node) {
    if (!markdownCache[node.file]) {
        markdownCache[node.file] = { status: 'loading', content: null, frontmatter: null };
        try {
            let result = await fetch(canvasBaseDir + node.file);
            result = await result.text();
            const frontmatterMatch = result.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1].split('\n').reduce((acc, line) => {
                    const [key, value] = line.split(':').map(s => s.trim());
                    acc[key] = value;
                    return acc;
                }, {});
                markdownCache[node.file] = { status: 'loaded', content: frontmatterMatch[2].trim(), frontmatter };
            } else markdownCache[node.file] = { status: 'loaded', content: result, frontmatter: null };
        } catch(err) {
            console.error('Failed to load markdown:', err);
            markdownCache[node.file] = { status: 'error', content: 'Failed to load content', frontmatter: null };
        }
    }
    if (markdownCache[node.file].status === 'loaded') {
        node.mdContent = markdownCache[node.file].content;
        node.mdFrontmatter = markdownCache[node.file].frontmatter;
    } else if (markdownCache[node.file].status === 'error') {
        node.mdContent = markdownCache[node.file].content;
        node.mdFrontmatter = null;
    } else {
        node.mdContent = 'Loading...';
        node.mdFrontmatter = null;
    }
    updateOrCreateOverlay(node, node.mdContent, 'markdown');
}

function updateAllOverlays() {
    const neededOverlays = new Set();
    const overlayCreators = {
        text: (node) => {
            if (node._inViewport) {
                neededOverlays.add(node.id);
                updateOrCreateOverlay(node, node.text, 'text');
            }
        },
        file: (node) => {
            if (node.file.match(/\.md$/i) && node.mdContent && node._inViewport) {
                neededOverlays.add(node.id);
                updateOrCreateOverlay(node, node.mdContent, 'markdown');
            } else if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i) && node._inViewport) {
                neededOverlays.add(node.id);
                updateOrCreateOverlay(node, canvasBaseDir + node.file, 'image');
            }
        },
        link: (node) => {
            neededOverlays.add(node.id);
            updateOrCreateOverlay(node, node.url, 'link')
        }
    };
    canvasData.nodes.forEach(node => {
        if (overlayCreators[node.type]) overlayCreators[node.type](node);
    });
    Object.keys(overlays).forEach(id => {
        if (!neededOverlays.has(id)) {
            const div = overlays[id];
            if (div && div.parentNode) div.parentNode.removeChild(div);
            delete overlays[id];
        }
    });
}

function updateOrCreateOverlay(node, content, type) {
    let element = overlays[node.id];
    if (!element) {
        element = new overLay(node, content, type);
        overlaysLayer.appendChild(element);
        overlays[node.id] = element;
        element.style.left = node.x + 'px';
        element.style.top = node.y + 'px';
        element.style.width = node.width + 'px';
        element.style.height = node.height + 'px';
    }
    if (type === 'markdown' || type === 'text') {
        if (element.originalContent == undefined || element.originalContent !== content) { 
            element.originalContent = content;
            const parsedContentContainer = element.getElementsByClassName('parsed-content-wrapper')[0];
            parsedContentContainer.innerHTML = window.marked.parse(content || '');
        }
        if (node.mdFrontmatter?.direction === 'rtl' && !element.classList.contains('rtl')) element.classList.add('rtl');
    }
}

class overLay extends HTMLElement {
    constructor(node, content, type) {
        super();
        this.classList.add('overlay-container');
        const overlayBorder = document.createElement('div');
        overlayBorder.className = 'overlay-border';
        this.appendChild(overlayBorder);
        if (type === 'text' || type === 'markdown') {
            this.classList.add('markdown-content');
            const parsedContentWrapper = document.createElement('div');
            parsedContentWrapper.innerHTML = window.marked.parse(content || '');
            parsedContentWrapper.classList.add('parsed-content-wrapper');
            this.appendChild(parsedContentWrapper);
        } else if (type === 'link') {
            const iframe = document.createElement('iframe');
            iframe.src = content;
            iframe.sandbox = 'allow-scripts allow-same-origin';
            iframe.className = 'link-iframe';
            iframe.loading = 'lazy';
            const clickLayer = document.createElement('div');
            clickLayer.className = 'link-click-layer';
            this.appendChild(iframe);
            this.appendChild(clickLayer);
        } else if (type === 'image') {
            const img = document.createElement('img');
            img.src = content;
            img.loading = 'lazy';
            this.appendChild(img);
        }
        this.id = node.id;
        const colourClass = node.color == undefined ? 'color-0' : 'color-' + node.color;  
        this.classList.add(colourClass);
        if (overlayState.selectedOverlayId === node.id) this.classList.add('active');
        const mouseenterHandler = () => {
            if (overlayState.selectedOverlayId === node.id) overlayState.isHoveringSelectedOverlay = true;
        }
        const mouseleaveHandler = () => {
            if (overlayState.selectedOverlayId === node.id) overlayState.isHoveringSelectedOverlay = false;
        }
        this.addEventListener('mouseenter', mouseenterHandler);
        this.addEventListener('mouseleave', mouseleaveHandler);
    }
}
customElements.define('over-lay', overLay);
// #endregion

// #region Scale and Preview
function scaleToSlider(scale) { return Math.log(scale) / Math.log(1.1) }

function updateScale(newScale) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerScreenX = viewportWidth / 2;
    const centerScreenY = viewportHeight / 2;
    const worldCenterX = (centerScreenX - offsetX) / scale;
    const worldCenterY = (centerScreenY - offsetY) / scale;
    perFrame.zoomOrigin = {
        x: worldCenterX,
        y: worldCenterY,
        screenX: centerScreenX,
        screenY: centerScreenY,
    }
    targetScale = Math.round(Math.max(0.05, Math.min(20, newScale)) * 1000) / 1000;
    perFrame.zoom = true;
}

// === Preview ===
function showPreviewModal(content) {
    previewModalContent.innerHTML = '';
    isPreviewModalOpen = true;
    previewModalBackdrop.classList.remove('hidden');
    previewModal.classList.remove('hidden');
    previewModalContent.appendChild(content);
}

function hidePreviewModal() {
    isPreviewModalOpen = false;
    previewModalBackdrop.classList.add('hidden');
    previewModal.classList.add('hidden');
}
// #endregion

// #region Mouse/Touch Event
function onWindowMouseDown(eve, touch = false) {
    if (isPreviewModalOpen) return;
    if (isUIControl(eve.target)) return;
    const e = touch ? eve.touches[0] : eve;
    if (touch) {
        if (eve.touches.length > 1) {
            pinchZoomState.isPinching = true;
            pinchZoomState.initialDistance = getTouchDistance(eve.touches);
            pinchZoomState.initialScale = scale;
            pinchZoomState.initialMidpoint = getTouchMidpoint(eve.touches);
            pinchZoomState.lastTouches = [eve.touches[0], eve.touches[1]];
            pinchZoomState.lastMidpointX = pinchZoomState.initialMidpoint.x;
            pinchZoomState.lastMidpointY = pinchZoomState.initialMidpoint.y;
            dragState.isDragging = false;
        } else {
            overlayState.isHoveringSelectedOverlay = false;
            const worldCoords = pointerAtWorld(e);
            const node = findNodeAt(worldCoords.x, worldCoords.y);
            if (node && node.id === overlayState.selectedOverlayId) overlayState.isHoveringSelectedOverlay = true;
            if (overlayState.isHoveringSelectedOverlay) return;
            dragState.lastTouchPoint = eve;
            dragState.isDragging = true;
            dragState.lastX = e.clientX;
            dragState.lastY = e.clientY;
            dragState.lastClientX = e.clientX;
            dragState.lastClientY = e.clientY;
        }
    } else {
        if (overlayState.isHoveringSelectedOverlay) return;
        dragState.isDragging = true;
        dragState.lastX = e.clientX;
        dragState.lastY = e.clientY;
        dragState.lastClientX = e.clientX;
        dragState.lastClientY = e.clientY;
    }
}

function onWindowMouseMove(eve, touch = false) {
    if (isPreviewModalOpen || (!dragState.isDragging && !pinchZoomState.isPinching)) return;
    perFrame.mouseMove = true;
    perFrame.moveParams.e = eve;
    perFrame.moveParams.touch = touch;
}

function mouseMove(eve, touch) {
    if (dragState.isDragging) {
        const e = touch ? eve.touches[0] : eve;
        const dx = e.clientX - dragState.lastClientX;
        const dy = e.clientY - dragState.lastClientY;
        offsetX += dx;
        offsetY += dy;
        dragState.lastClientX = e.clientX;
        dragState.lastClientY = e.clientY;
        if (touch) dragState.lastTouchPoint = eve;
    } else if (pinchZoomState.isPinching && touch) {
        const newDistance = getTouchDistance(eve.touches);
        let zoomFactor = newDistance / pinchZoomState.initialDistance;
        let newScale = Math.round(Math.max(0.05, Math.min(20, pinchZoomState.initialScale * zoomFactor)) * 1000) / 1000;
        // Calculate world coordinates at midpoint before zoom
        const rect = canvas.getBoundingClientRect();
        const midpoint = getTouchMidpoint(eve.touches);
        const screenX = midpoint.x - rect.left;
        const screenY = midpoint.y - rect.top;
        const worldX = (screenX - offsetX) / scale;
        const worldY = (screenY - offsetY) / scale;
        // Update scale and offset so midpoint stays fixed
        scale = newScale;
        offsetX = screenX - worldX * scale - pinchZoomState.lastMidpointX + midpoint.x;
        offsetY = screenY - worldY * scale - pinchZoomState.lastMidpointY + midpoint.y;
        pinchZoomState.lastMidpointX = midpoint.x;
        pinchZoomState.lastMidpointY = midpoint.y;
    }
}

function onWindowMouseUp(eve, touch = false, lag = false) {
    if (isPreviewModalOpen) return;
    if (touch && eve.touches.length === 1 && !lag) {
        const e = eve.touches[0];
        pinchZoomState.isPinching = false;
        dragState.lastTouchPoint = eve;
        dragState.lastClientX = e.clientX;
        dragState.lastClientY = e.clientY;
        dragState.isDragging = true;
        return;
    }
    if (!dragState.isDragging) return;
    dragState.isDragging = false;
    if ((dragState.lastClientX - dragState.lastX) ** 2 + (dragState.lastClientY - dragState.lastY) ** 2 > 25) return;
    const e = touch ? eve.touches[0] : eve;
    const worldCoords = pointerAtWorld(e);
    const node = findNodeAt(worldCoords.x, worldCoords.y);
    if (overlayJudger(node) === 1) select(node.id);
    else select(null);
    if (overlayJudger(node) !== 2) return;
    if (node.type === 'file') {
        if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
            isPreviewModalOpen = true;
            const img = new Image();
            img.src = canvasBaseDir + node.file;
            showPreviewModal(img);
        } else if (node.file.match(/\.mp3$/i)) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = canvasBaseDir + node.file;
            showPreviewModal(audio);
        }
    }
}

function select(id) {
    const previous = overlayState.selectedOverlayId === null ? null : document.getElementById(overlayState.selectedOverlayId);
    const current = id === null ? null : document.getElementById(id);
    if (previous) previous.classList.remove('active');
    if (current) {
        current.classList.add('active');
        overlayState.isHoveringSelectedOverlay = true;
    } else overlayState.isHoveringSelectedOverlay = false;
    overlayState.selectedOverlayId = id;
}

function onTouch(e, state) {
    if (isPreviewModalOpen) return;
    if (!isUIControl(e.target) && (!overlayState.isHoveringSelectedOverlay || (overlayState.isHoveringSelectedOverlay && e.touches.length > 1))) e.preventDefault();
    if (state === 'start') onWindowMouseDown(e, true);
    else if (state === 'move') onWindowMouseMove(e, true);
    else if (state === 'end') {
        if (pinchZoomState.isPinching) onWindowMouseUp(e, true);
        else onWindowMouseUp(dragState.lastTouchPoint, true, true);
    }
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchMidpoint(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

// === Wheel ===
function wheelPan(e) {
    perFrame.wheelPan = false;
    offsetX -= e.deltaX;
    offsetY -= e.deltaY;
}

function smoothZoom() {
    if (targetScale !== scale) {
        const scaleDiff = targetScale - scale;
        if (Math.abs(scaleDiff) < targetScale * 0.01) {
            scale = targetScale;
            perFrame.zoom = false;
        } else {
            const newScale = scale + scaleDiff * ZOOM_SMOOTHNESS;
            scale = Math.round(newScale * 1000) / 1000;
        }
        offsetX = perFrame.zoomOrigin.screenX - perFrame.zoomOrigin.x * scale;
        offsetY = perFrame.zoomOrigin.screenY - perFrame.zoomOrigin.y * scale;
        zoomSlider.value = scaleToSlider(scale);
    }
}

function onWheel(e) {
    if (!touchPadMode && (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY))) touchPadMode = true;
    if (isPreviewModalOpen ||
        overlayState.isHoveringSelectedOverlay && 
            (!touchPadMode || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.ctrlKey)
    ) return;
    e.preventDefault();
    if (touchPadMode && !e.ctrlKey) {
        perFrame.wheelPan = true;
        perFrame.wheelPanEvent = e;
    } else {
        if (e.deltaY < 0) targetScale *= ZOOM_FACTOR;
        else targetScale /= ZOOM_FACTOR;
        targetScale = Math.round(Math.max(0.05, Math.min(20, targetScale)) * 1000) / 1000;
        perFrame.zoomOrigin = pointerAtWorld(e);
        perFrame.zoom = true;
    }
}
// #endregion

// #region Init
async function initCanvas() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const canvasPath = urlParams.get('path') ? decodeURIComponent(urlParams.get('path')) : 'example/introduction.canvas';
        // Determine base directory for related files
        if (/^https?:\/\//.test(canvasPath)) canvasBaseDir = canvasPath.substring(0, canvasPath.lastIndexOf('/') + 1);
        else {
            // Local or relative path
            const lastSlash = canvasPath.lastIndexOf('/');
            canvasBaseDir = lastSlash !== -1 ? canvasPath.substring(0, lastSlash + 1) : './';
        }
        canvasData = await fetch(canvasPath).then(res => res.json());
        canvasData.nodes.forEach(node => { nodeMap[node.id] = node; });
        buildSpatialGrid();
        // Main canvas fills window
        const width = window.innerWidth;
        const height = window.innerHeight;
        resizeCanvasForDPR(canvas, ctx, width, height);
        // Minimap fills its container
        const minimapContainer = document.getElementById('minimap');
        const rect = minimapContainer.getBoundingClientRect();
        resizeCanvasForDPR(minimap, minimapCtx, rect.width, rect.height);
        setInitialView();
        drawMinimap();
    } catch (err) { console.error('Failed to load canvas data:', err) }
}

function buildSpatialGrid() {
    if (!canvasData || canvasData.nodes.length < 50) {
        spatialGrid = null;
        return;
    }
    spatialGrid = {};
    for (let node of canvasData.nodes) {
        const minCol = Math.floor(node.x / GRID_CELL_SIZE);
        const maxCol = Math.floor((node.x + node.width) / GRID_CELL_SIZE);
        const minRow = Math.floor(node.y / GRID_CELL_SIZE);
        const maxRow = Math.floor((node.y + node.height) / GRID_CELL_SIZE);
        for (let col = minCol; col <= maxCol; col++) {
            for (let row = minRow; row <= maxRow; row++) {
                const key = `${col},${row}`;
                if (!spatialGrid[key]) spatialGrid[key] = [];
                spatialGrid[key].push(node);
            }
        }
    }
}

// === Controls ===
window.addEventListener('mousedown', onWindowMouseDown);
window.addEventListener('mousemove', onWindowMouseMove);
window.addEventListener('mouseup', onWindowMouseUp);
window.addEventListener('wheel', onWheel, { passive: false });
window.addEventListener('touchstart', (e) => onTouch(e, 'start'), { passive: false });
window.addEventListener('touchmove', (e) => onTouch(e, 'move'), { passive: false });
window.addEventListener('touchend', (e) => onTouch(e, 'end'), { passive: false });
window.addEventListener('resize', onWindowResize);
const zoomSlider = document.getElementById('zoom-slider');
const toggleMinimapBtn = document.getElementById('toggle-minimap');
document.getElementById('zoom-in').addEventListener('click', () => updateScale(scale * 1.2));
document.getElementById('zoom-out').addEventListener('click', () => updateScale(scale / 1.2));
zoomSlider.addEventListener('input', (e) => updateScale(Math.pow(1.1, e.target.value)));
document.getElementById('reset-view').addEventListener('click', setInitialView);
toggleMinimapBtn.addEventListener('click', () => {
    isMinimapVisible = !isMinimapVisible;
    document.getElementsByClassName('minimap-container')[0].classList.toggle('collapsed')
    if (isMinimapVisible) updateViewportRectangle();
});
const controlsPanel = document.getElementById('controls');
const toggleCollapseBtn = document.getElementById('toggle-collapse');
toggleCollapseBtn.addEventListener('click', () => { controlsPanel.classList.toggle('collapsed') });

// === Fullscreen ===
const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
function updateFullscreenButton() {
    if (document.fullscreenElement === document.documentElement) toggleFullscreenBtn.innerHTML = `
        <svg viewBox="-40.32 -40.32 176.64 176.64"><path d="M30 60H6a6 6 0 0 0 0 12h18v18a6 6 0 0 0 12 0V66a5.997 5.997 0 0 0-6-6Zm60 0H66a5.997 5.997 0 0 0-6 6v24a6 6 0 0 0 12 0V72h18a6 6 0 0 0 0-12ZM66 36h24a6 6 0 0 0 0-12H72V6a6 6 0 0 0-12 0v24a5.997 5.997 0 0 0 6 6ZM30 0a5.997 5.997 0 0 0-6 6v18H6a6 6 0 0 0 0 12h24a5.997 5.997 0 0 0 6-6V6a5.997 5.997 0 0 0-6-6Z"/></svg>
    `;
    else toggleFullscreenBtn.innerHTML = `
        <svg viewBox="-5.28 -5.28 34.56 34.56" fill="none"><path d="M4 9V5.6c0-.56 0-.84.109-1.054a1 1 0 0 1 .437-.437C4.76 4 5.04 4 5.6 4H9M4 15v3.4c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C4.76 20 5.04 20 5.6 20H9m6-16h3.4c.56 0 .84 0 1.054.109a1 1 0 0 1 .437.437C20 4.76 20 5.04 20 5.6V9m0 6v3.4c0 .56 0 .84-.109 1.054a1 1 0 0 1-.437.437C19.24 20 18.96 20 18.4 20H15" stroke-width="2.4" stroke-linecap="round"/></svg>
    `;
}
toggleFullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement !== document.documentElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});
document.addEventListener('fullscreenchange', updateFullscreenButton);
updateFullscreenButton();

// === Preview Modal ===
const previewModal = document.getElementById('preview-modal');
const previewModalBackdrop = document.getElementById('preview-modal-backdrop');
const previewModalClose = document.getElementById('preview-modal-close');
const previewModalContent = document.getElementById('preview-modal-content');

previewModalClose.addEventListener('click', hidePreviewModal);
previewModalBackdrop.addEventListener('click', hidePreviewModal);

initCanvas();
// #endregion