// --- View Logic ---
// Helper to get coordinates from Mouse or Touch
function getEvtLoc(evt) {
    if (evt.touches && evt.touches.length > 0) {
        return { x: evt.touches[0].clientX, y: evt.touches[0].clientY };
    }
    return { x: evt.clientX, y: evt.clientY };
}

function updateTransform() {
    const scene = document.getElementById('scene');
    scene.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.scale})`);
}

function zoom(delta) {
    view.scale += delta;
    if(view.scale < 0.2) view.scale = 0.2;
    if(view.scale > 3) view.scale = 3;
    updateTransform();
}

function resetView() {
    // 1. Calculate Bounding Box of all nodes
    const nodeKeys = Object.keys(nodePos);
    if (nodeKeys.length === 0) {
        view = { x: 50, y: 50, scale: 1 };
        updateTransform();
        return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodeKeys.forEach(k => {
        const n = nodePos[k];
        const w = 60; const h = 60; 
        if (n.x - w/2 < minX) minX = n.x - w/2;
        if (n.x + w/2 > maxX) maxX = n.x + w/2;
        if (n.y - h/2 < minY) minY = n.y - h/2;
        if (n.y + h/2 > maxY) maxY = n.y + h/2;
    });

    const padding = 50;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    const graphW = maxX - minX;
    const graphH = maxY - minY;

    const container = document.getElementById('canvas-container');
    const containerW = container.clientWidth || 800;
    const containerH = container.clientHeight || 600;

    const scaleX = containerW / graphW;
    const scaleY = containerH / graphH;
    let newScale = Math.min(scaleX, scaleY);

    if (newScale > 1.5) newScale = 1.5; 
    if (newScale < 0.2) newScale = 0.2;

    const cx = minX + graphW / 2;
    const cy = minY + graphH / 2;
    
    view.scale = newScale;
    view.x = (containerW / 2) - (cx * newScale);
    view.y = (containerH / 2) - (cy * newScale) + 20;

    updateTransform();
}

function onScroll(evt) {
    evt.preventDefault();
    const delta = evt.deltaY < 0 ? 0.1 : -0.1;
    const svg = document.getElementById('svg');
    const rect = svg.getBoundingClientRect();
    // Use first touch or mouse
    const clientX = (evt.touches && evt.touches[0]) ? evt.touches[0].clientX : evt.clientX;
    const clientY = (evt.touches && evt.touches[0]) ? evt.touches[0].clientY : evt.clientY;

    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const oldScale = view.scale;
    let newScale = oldScale + delta;
    if(newScale < 0.2) newScale = 0.2;
    if(newScale > 3) newScale = 3;

    view.x = mx - (mx - view.x) * (newScale / oldScale);
    view.y = my - (my - view.y) * (newScale / oldScale);
    view.scale = newScale;
    updateTransform();
}

function onPanStart(evt) {
    // Prevent default to stop scrolling on mobile while panning
    if(evt.type === 'touchstart') evt.preventDefault();
    
    if(evt.target.tagName !== 'svg' && evt.target.id !== 'scene') return;
    dragInfo.type = 'pan';
    dragInfo.startMouse = getEvtLoc(evt);
    dragInfo.startView = { x: view.x, y: view.y };
    
    if (evt.type === 'touchstart') {
        window.addEventListener('touchmove', onGlobalDrag, {passive: false});
        window.addEventListener('touchend', onGlobalEnd);
    } else {
        window.addEventListener('mousemove', onGlobalDrag);
        window.addEventListener('mouseup', onGlobalEnd);
    }
}

function getScenePoint(evt) {
    const scene = document.getElementById('scene');
    const pt = document.getElementById('svg').createSVGPoint();
    const loc = getEvtLoc(evt);
    pt.x = loc.x;
    pt.y = loc.y;
    return pt.matrixTransform(scene.getScreenCTM().inverse());
}

function onNodeDragStart(evt) {
    if(evt.type === 'touchstart') evt.preventDefault(); // Prevent scroll

    const group = evt.currentTarget;
    const nodeId = group.getAttribute('data-id');
    const nodeType = nodePos[nodeId]?.type;
    
    if(nodeType === 'hub_and') {
        dragInfo.type = 'hub';
        dragInfo.id = nodeId;
    } else {
        dragInfo.type = 'node';
        dragInfo.id = nodeId;
    }
    
    const pt = getScenePoint(evt);
    dragInfo.startMouse = pt;
    dragInfo.startObj = { ...nodePos[dragInfo.id] };
    
    if (evt.type === 'touchstart') {
        window.addEventListener('touchmove', onGlobalDrag, {passive: false});
        window.addEventListener('touchend', onGlobalEnd);
    } else {
        window.addEventListener('mousemove', onGlobalDrag);
        window.addEventListener('mouseup', onGlobalEnd);
    }
    evt.stopPropagation();
}

function onLoopDragStart(evt) {
    if(evt.type === 'touchstart') evt.preventDefault(); // Prevent scroll

    const line = evt.currentTarget;
    const key = line.getAttribute('data-key');
    const ids = key.split('-');
    const src = nodePos[ids[0]];
    const tgt = nodePos[ids[1]];

    dragInfo.type = 'loop';
    dragInfo.id = key;
    dragInfo.srcTgtCenter = (src.x + tgt.x) / 2;
    if(loopOffsets[key] === undefined) loopOffsets[key] = Math.max(src.x, tgt.x) + 80 - dragInfo.srcTgtCenter;

    const pt = getScenePoint(evt);
    dragInfo.startMouse = pt;
    dragInfo.startObj = { x: loopOffsets[key], y: 0 };
    
    if (evt.type === 'touchstart') {
        window.addEventListener('touchmove', onGlobalDrag, {passive: false});
        window.addEventListener('touchend', onGlobalEnd);
    } else {
        window.addEventListener('mousemove', onGlobalDrag);
        window.addEventListener('mouseup', onGlobalEnd);
    }
    evt.stopPropagation();
}

function onGlobalDrag(evt) {
    if(evt.type === 'touchmove') evt.preventDefault(); // Stop scrolling

    const cur = getEvtLoc(evt);

    if (dragInfo.type === 'pan') {
        const dx = cur.x - dragInfo.startMouse.x;
        const dy = cur.y - dragInfo.startMouse.y;
        view.x = dragInfo.startView.x + dx;
        view.y = dragInfo.startView.y + dy;
        updateTransform();
    }
    else if (dragInfo.type === 'node' || dragInfo.type === 'hub') {
        const pt = getScenePoint(evt);
        // Note: getScenePoint already uses getEvtLoc
        const dx = pt.x - dragInfo.startMouse.x;
        const dy = pt.y - dragInfo.startMouse.y;
        nodePos[dragInfo.id].x = dragInfo.startObj.x + dx;
        nodePos[dragInfo.id].y = dragInfo.startObj.y + dy;
        const el = document.querySelector(`.node-group[data-id="${dragInfo.id}"]`);
        if(el) el.setAttribute('transform', `translate(${nodePos[dragInfo.id].x},${nodePos[dragInfo.id].y})`);
        drawEdges(document.getElementById('edges'));
    }
}

function onGlobalEnd(evt) {
    dragInfo.type = null;
    window.removeEventListener('mousemove', onGlobalDrag);
    window.removeEventListener('mouseup', onGlobalEnd);
    window.removeEventListener('touchmove', onGlobalDrag);
    window.removeEventListener('touchend', onGlobalEnd);
}