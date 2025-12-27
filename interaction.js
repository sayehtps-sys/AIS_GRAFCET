// --- View Logic ---
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
        // Approximate node size for bounding box (allow some padding)
        const w = 60; // Estimated width
        const h = 60; // Estimated height
        if (n.x - w/2 < minX) minX = n.x - w/2;
        if (n.x + w/2 > maxX) maxX = n.x + w/2;
        if (n.y - h/2 < minY) minY = n.y - h/2;
        if (n.y + h/2 > maxY) maxY = n.y + h/2;
    });

    // Add extra padding around the graph
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const graphW = maxX - minX;
    const graphH = maxY - minY;

    // 2. Get Container Dimensions
    const container = document.getElementById('canvas-container');
    const containerW = container.clientWidth || 800;
    const containerH = container.clientHeight || 600;

    // 3. Calculate Scale to Fit
    const scaleX = containerW / graphW;
    const scaleY = containerH / graphH;
    let newScale = Math.min(scaleX, scaleY);

    // Limit scale
    if (newScale > 1.5) newScale = 1.5; 
    if (newScale < 0.2) newScale = 0.2;

    // 4. Center the View
    // The graph center in "scene coordinates"
    const cx = minX + graphW / 2;
    const cy = minY + graphH / 2;

    // We want this (cx, cy) to be at the center of the container (containerW/2, containerH/2)
    // Formula: view.x + cx * view.scale = containerW / 2
    // So: view.x = (containerW / 2) - (cx * newScale)
    
    view.scale = newScale;
    view.x = (containerW / 2) - (cx * newScale);
    view.y = (containerH / 2) - (cy * newScale) + 20; // +20 for top padding adjustment

    updateTransform();
}

function onScroll(evt) {
    evt.preventDefault();
    const delta = evt.deltaY < 0 ? 0.1 : -0.1;
    const svg = document.getElementById('svg');
    const rect = svg.getBoundingClientRect();
    const mx = evt.clientX - rect.left;
    const my = evt.clientY - rect.top;

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
    if(evt.target.tagName !== 'svg' && evt.target.id !== 'scene') return;
    dragInfo.type = 'pan';
    dragInfo.startMouse = { x: evt.clientX, y: evt.clientY };
    dragInfo.startView = { x: view.x, y: view.y };
    window.addEventListener('mousemove', onGlobalDrag);
    window.addEventListener('mouseup', onGlobalEnd);
}

function getScenePoint(evt) {
    const scene = document.getElementById('scene');
    const pt = document.getElementById('svg').createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(scene.getScreenCTM().inverse());
}

function onNodeDragStart(evt) {
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
    window.addEventListener('mousemove', onGlobalDrag);
    window.addEventListener('mouseup', onGlobalEnd);
    evt.stopPropagation();
}

function onLoopDragStart(evt) {
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
    window.addEventListener('mousemove', onGlobalDrag);
    window.addEventListener('mouseup', onGlobalEnd);
    evt.stopPropagation();
}

function onGlobalDrag(evt) {
    if (dragInfo.type === 'pan') {
        const dx = evt.clientX - dragInfo.startMouse.x;
        const dy = evt.clientY - dragInfo.startMouse.y;
        view.x = dragInfo.startView.x + dx;
        view.y = dragInfo.startView.y + dy;
        updateTransform();
    }
    else if (dragInfo.type === 'node' || dragInfo.type === 'hub') {
        const pt = getScenePoint(evt);
        const dx = pt.x - dragInfo.startMouse.x;
        const dy = pt.y - dragInfo.startMouse.y;
        nodePos[dragInfo.id].x = dragInfo.startObj.x + dx;
        nodePos[dragInfo.id].y = dragInfo.startObj.y + dy;
        const el = document.querySelector(`.node-group[data-id="${dragInfo.id}"]`);
        if(el) el.setAttribute('transform', `translate(${nodePos[dragInfo.id].x},${nodePos[dragInfo.id].y})`);
        drawEdges(document.getElementById('edges'));
    }
    else if (dragInfo.type === 'loop') {
        const pt = getScenePoint(evt);
        const dx = pt.x - dragInfo.startMouse.x;
        loopOffsets[dragInfo.id] = dragInfo.startObj.x + dx;
        drawEdges(document.getElementById('edges'));
    }
}

function onGlobalEnd() {
    dragInfo.type = null;
    window.removeEventListener('mousemove', onGlobalDrag);
    window.removeEventListener('mouseup', onGlobalEnd);
}