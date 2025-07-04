// V 1.3.1

const nodeMap = {};
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const overlaysLayer = document.getElementById('overlays');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');
const overlays = {};

let canvasData = null;
let canvasBaseDir = null;
let offsetX = canvas.width / 2;
let offsetY = canvas.height / 2;
let scale = 1.0;
let isMinimapVisible = true;
let spatialGrid = null;
let isRequesting = false;
let touchPadMode = false;
const GRID_CELL_SIZE = 300;
const FONT_COLOR = '#fff';
// Markdown and image cache
const markdownCache = {};
const imageCache = {};

// === Constants ===
const ARROW_LENGTH = 12;
const ARROW_WIDTH = 7;
const FILE_NODE_RADIUS = 12;

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

function overlayJudger(node) {
    const type = node == undefined ? 'default' : node.type;
    switch (type) {
        case 'text': return 1;
        case 'link': return 1;
        case 'file': return node.file.match(/\.md$/i) ? 1 : 2;
        default: return 0;
    }
}

// === Init ===
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
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        setInitialView();
        requestDraw();
        drawMinimap();
    } catch (err) { console.error('Failed to load canvas data:', err) }
}

const throttle = function(func, interval) {
    let lastCallTime = -Infinity;
    return function throttled(...args) {
        const now = Date.now();
        const timeSinceLast = now - lastCallTime;
        if (timeSinceLast >= interval) {
            func.apply(this, args);
            lastCallTime = now;
        }
    };
}

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

const onWindowResize = throttle( () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    requestDraw();
}, 16)

function isUIControl(target) {
    return target.closest && (
        target.closest('#controls') ||
        target.closest('button') ||
        target.closest('input')
    );
}

// === Utility Functions ===


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

// === Draw ===
function requestDraw() {
    if (isRequesting) return;
    isRequesting = true;
    requestAnimationFrame(() => {
        overlaysLayer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
        isRequesting = false;
    });
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
    if (!node.file.match(/\.md$/i)) {
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
    if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
        if (node._inViewport) {
            loadImageForNode(node);
            if (node.imageElement && node.imageElement.complete) {
                const x = node.x + 1;
                const y = node.y + 1;
                const drawWidth = node.width - 2;
                const drawHeight = node.height - 2;
                ctx.save();
                drawRoundRect(ctx, x, y, drawWidth, drawHeight, FILE_NODE_RADIUS);
                ctx.clip();
                // Check for broken image
                if (node.imageElement.naturalWidth === 0) {
                    ctx.fillStyle = FONT_COLOR;
                    ctx.font = '18px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('Image not found', x + drawWidth / 2, y + drawHeight / 2);
                    ctx.textAlign = 'left';
                } else ctx.drawImage(node.imageElement, x, y, drawWidth, drawHeight);
                ctx.restore();
            }
        } else if (node.imageElement) node.imageElement = null;
    } else if (node.file.match(/\.md$/i)) if (node._inViewport) loadMarkdownForNode(node);
}

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

// === Lazy Loading Utilities ===
function loadImageForNode(node) {
    if (!imageCache[node.file]) {
        const img = new Image();
        img.src = canvasBaseDir + node.file;
        img.onload = requestDraw;
        img.onerror = requestDraw;
        imageCache[node.file] = img;
    }
    node.imageElement = imageCache[node.file];
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
        element = createOverlayElement(type, node);
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
            const parsedContentWrapper = document.createElement('div');
            parsedContentWrapper.innerHTML = window.marked.parse(content || '');
            parsedContentWrapper.classList.add('parsed-content-wrapper');
            element.innerHTML = '';
            element.appendChild(parsedContentWrapper);
        }
        if (node.mdFrontmatter?.direction === 'rtl' && !element.classList.contains('rtl')) element.classList.add('rtl');
    }
}

function createOverlayElement(type, node) {
    let element;
    if (type === 'text' || type === 'markdown') {
        element = document.createElement('div');
        element.className = 'markdown-content';
    } else if (type === 'link') {
        element = document.createElement('div');
        element.className = 'link-overlay-container';
        const iframe = document.createElement('iframe');
        iframe.src = node.url;
        iframe.sandbox = 'allow-scripts allow-same-origin';
        iframe.className = 'link-iframe';
        const clickLayer = document.createElement('div');
        clickLayer.className = 'link-click-layer';
        element.appendChild(iframe);
        element.appendChild(clickLayer);
        element._iframe = iframe;
        element._clickLayer = clickLayer;
    }
    element.id = node.id;
    const colourClass = node.color == undefined ? 'color-0' : 'color-' + node.color;  
    element.classList.add(colourClass);
    if (overlayState.selectedOverlayId === node.id) element.classList.add('active');
    return element;
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
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
    minimapCtx.fillStyle = '#333';
    minimapCtx.fillRect(0, 0, minimap.width, minimap.height);
    minimapCtx.save();    
    const bounds = calculateNodesBounds();
    if (!bounds) return;
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const scaleX = minimap.width / contentWidth;
    const scaleY = minimap.height / contentHeight;
    const minimapScale = Math.min(scaleX, scaleY) * 0.9;     
    const centerX = minimap.width / 2;
    const centerY = minimap.height / 2;
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
    const minimap = document.getElementById('minimap');
    const contentWidth = bounds.maxX - bounds.minX;
    const contentHeight = bounds.maxY - bounds.minY;
    const scaleX = minimap.width / contentWidth;
    const scaleY = minimap.height / contentHeight;
    const minimapScale = Math.min(scaleX, scaleY) * 0.9;
    const centerX = minimap.width / 2;
    const centerY = minimap.height / 2;
    // Viewport in world coords
    const viewWidth = canvas.width / scale;
    const viewHeight = canvas.height / scale;
    const viewportCenterX = -offsetX / scale + canvas.width / (2 * scale);
    const viewportCenterY = -offsetY / scale + canvas.height / (2 * scale);
    // Rectangle in minimap coords
    const viewRectX = centerX + (viewportCenterX - viewWidth/2 - (bounds.minX + contentWidth/2)) * minimapScale;
    const viewRectY = centerY + (viewportCenterY - viewHeight/2 - (bounds.minY + contentHeight/2)) * minimapScale;
    const viewRectWidth = viewWidth * minimapScale;
    const viewRectHeight = viewHeight * minimapScale;
    const viewportRect = document.getElementById('viewport-rectangle');
    viewportRect.style.display = isMinimapVisible ? 'block' : 'none';
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
    const scaleX = canvas.width / contentWidth;
    const scaleY = canvas.height / contentHeight;
    const newScale = Math.min(scaleX, scaleY);
    const contentCenterX = bounds.minX + (bounds.maxX - bounds.minX) / 2;
    const contentCenterY = bounds.minY + (bounds.maxY - bounds.minY) / 2;
    const initialView = {
        scale: newScale,
        offsetX: canvas.width/2 - contentCenterX * newScale,
        offsetY: canvas.height/2 - contentCenterY * newScale
    };
    scale = initialView.scale;
    offsetX = initialView.offsetX;
    offsetY = initialView.offsetY;
    zoomSlider.value = scaleToSlider(scale);
    requestDraw();
}

// === Scale Computing ===
function pointerAtWorld(e) {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return {
        x: (screenX - offsetX) / scale,
        y: (screenY - offsetY) / scale
    };
}

function scaleToSlider(scale) { return Math.log(scale) / Math.log(1.1) }

function updateScale(newScale) {
    // Get the world coordinates at the center of the canvas before zoom
    const centerScreenX = canvas.width / 2;
    const centerScreenY = canvas.height / 2;
    const worldCenterX = (centerScreenX - offsetX) / scale;
    const worldCenterY = (centerScreenY - offsetY) / scale;
    // Update scale
    scale = Math.max(0.05, Math.min(20, newScale));
    // Adjust offset so the same world point stays at the center
    offsetX = centerScreenX - worldCenterX * scale;
    offsetY = centerScreenY - worldCenterY * scale;
    zoomSlider.value = scaleToSlider(scale);
    requestDraw();
}

// === Preview Modal ===
function createPreviewModal(content, type) {
    const modal = document.createElement('div');
    modal.className = 'canvas-preview-modal';
    const backdrop = document.createElement('div');
    backdrop.className = 'canvas-preview-backdrop';
    const closeButton = document.createElement('button');
    closeButton.className = 'canvas-preview-close';
    closeButton.textContent = '×';
    modal.appendChild(closeButton);
    if (type === 'audio') modal.appendChild(content);
    else if (type === 'markdown') {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'canvas-preview-content';
        contentDiv.innerHTML = content;
        modal.appendChild(contentDiv);
    }
    const closeModal = () => {
        document.body.removeChild(modal);
        document.body.removeChild(backdrop);
    };
    closeButton.onclick = closeModal;
    backdrop.onclick = closeModal;
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
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

// #region Mouse/Touch Event
function onWindowMouseDown(eve, touch = false) {
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

const onWindowMouseMove = throttle((eve, touch = false) => {
    if (!dragState.isDragging && !pinchZoomState.isPinching) return;
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
        let newScale = Math.max(0.05, Math.min(20, pinchZoomState.initialScale * zoomFactor));
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
        zoomSlider.value = scaleToSlider(scale);
        pinchZoomState.lastMidpointX = midpoint.x;
        pinchZoomState.lastMidpointY = midpoint.y;
    }
    requestDraw();
}, 16)

function onWindowMouseUp(eve, touch = false, lag = false) {
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
            const img = new Image();
            img.src = canvasBaseDir + node.file;
            img.className = 'canvas-preview-img';
            const backdrop = document.createElement('div');
            backdrop.className = 'canvas-preview-backdrop';
            const closePreview = () => {
                document.body.removeChild(img);
                document.body.removeChild(backdrop);
            };
            img.onclick = closePreview;
            backdrop.onclick = closePreview;
            document.body.appendChild(backdrop);
            document.body.appendChild(img);
        } else if (node.file.match(/\.mp3$/i)) {
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = canvasBaseDir + node.file;
            audio.style.width = '300px';
            createPreviewModal(audio, 'audio');
        }
    }
}

function select(id) {
    const previous = overlayState.selectedOverlayId === null ? null : document.getElementById(overlayState.selectedOverlayId);
    const current = id === null ? null : document.getElementById(id);
    if (previous) {
        previous.classList.remove('active');
        if (previous._hasHoverListeners) {
            previous.removeEventListener('mouseenter', previous._mouseenterHandler);
            previous.removeEventListener('mouseleave', previous._mouseleaveHandler);
            previous._hasHoverListeners = false;
        }
    }
    if (current) {
        current.classList.add('active');
        overlayState.isHoveringSelectedOverlay = true;
        if (!current._hasHoverListeners) {
            current._mouseenterHandler = () => overlayState.isHoveringSelectedOverlay = true;
            current._mouseleaveHandler = () => overlayState.isHoveringSelectedOverlay = false;
            current.addEventListener('mouseenter', current._mouseenterHandler);
            current.addEventListener('mouseleave', current._mouseleaveHandler);
            current._hasHoverListeners = true;
        }
    } else overlayState.isHoveringSelectedOverlay = false;
    overlayState.selectedOverlayId = id;
}

function onTouch(e, state) {
    if (!isUIControl(e.target) && (!overlayState.isHoveringSelectedOverlay || (overlayState.isHoveringSelectedOverlay && e.touches.length > 1))) e.preventDefault();
    if (state === 'start') onWindowMouseDown(e, true);
    else if (state === 'move') onWindowMouseMove(e, true);
    else if (state === 'end') {
        if (pinchZoomState.isPinching) onWindowMouseUp(e, true);
        else onWindowMouseUp(dragState.lastTouchPoint, true, true);
    }
}
// #endregion

// #region Wheel Event
const normalWheel = throttle((e) => {
    if (Math.abs(e.deltaX) > 0 && !e.ctrlKey) touchPadMode = true;
    if (overlayState.isHoveringSelectedOverlay && (!touchPadMode || (touchPadMode && Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.ctrlKey))) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;
    // Zoom if ctrlKey or vertical wheel
    if (!touchPadMode || e.ctrlKey) {
        let zoomFactor = 1.06;
        let newScale = scale;
        if (e.deltaY < 0) newScale *= zoomFactor;
        else newScale /= zoomFactor;
        newScale = Math.max(0.05, Math.min(20, newScale));
        offsetX = mouseX - worldX * newScale;
        offsetY = mouseY - worldY * newScale;
        scale = newScale;
        zoomSlider.value = scaleToSlider(scale);
    } else {
        offsetX -= e.deltaX;
        offsetY -= e.deltaY;
    }
    requestDraw();
}, 16)

function onWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        touchPadMode = true;
    }
    normalWheel(e);
}

window.addEventListener('wheel', onWheel, { passive: false });
// #endregion

// #region Init
window.addEventListener('mousedown', onWindowMouseDown);
window.addEventListener('mousemove', onWindowMouseMove);
window.addEventListener('mouseup', onWindowMouseUp);
window.addEventListener('touchstart', (e) => onTouch(e, 'start'), { passive: false });
window.addEventListener('touchmove', (e) => onTouch(e, 'move'), { passive: false });
window.addEventListener('touchend', (e) => onTouch(e, 'end'), { passive: false });
window.addEventListener('resize', onWindowResize);
initCanvas();
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
    if (document.fullscreenElement === document.documentElement) toggleFullscreenBtn.textContent = '🡼';
    else toggleFullscreenBtn.textContent = '⛶';
}
toggleFullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement !== document.documentElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});
document.addEventListener('fullscreenchange', updateFullscreenButton);
updateFullscreenButton();
// #endregion