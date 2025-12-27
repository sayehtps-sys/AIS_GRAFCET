// --- Drawing Primitives ---
function createEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for(let k in attrs) el.setAttribute(k, attrs[k]);
    return el;
}
function createTxt(parent, x, y, txt, cls) {
    const t = createEl('text', {x, y, class:cls});
    t.textContent = txt;
    parent.appendChild(t);
}
function drawPath(parent, d, cls='path-conn') {
    parent.appendChild(createEl('path', { d, class: cls }));
}
function drawArrowHead(parent, x, y) {
    const d = `M ${x},${y-6} L ${x-5},${y+4} L ${x+5},${y+4} Z`;
    parent.appendChild(createEl('path', { d, class: 'arrow-head' }));
}
function drawVertical(p, x, y1, y2) {
    drawPath(p, `M ${x} ${y1} L ${x} ${y2}`);
}
function drawOrthogonal(p, src, tgt) {
    const y1 = src.y + (src.height/2);
    const y2 = tgt.y - (tgt.height/2);
    const midY = y1 + (y2-y1)/2;
    if(Math.abs(src.x - tgt.x) < 2) drawPath(p, `M ${src.x} ${y1} L ${tgt.x} ${y2}`);
    else drawPath(p, `M ${src.x} ${y1} L ${src.x} ${midY} L ${tgt.x} ${midY} L ${tgt.x} ${y2}`);
}
function drawOrDivergence(p, src, targets) {
    const y1 = src.y + (src.height/2);
    const topY = Math.min(...targets.map(t => t.y - t.height/2));
    const midY = y1 + (topY - y1)/2;
    const xs = targets.map(t => t.x);
    drawPath(p, `M ${src.x} ${y1} L ${src.x} ${midY}`);
    drawPath(p, `M ${Math.min(...xs)} ${midY} L ${Math.max(...xs)} ${midY}`, 'bar-or');
    targets.forEach(t => drawPath(p, `M ${t.x} ${midY} L ${t.x} ${t.y - t.height/2}`));
}
function drawOrConvergence(p, sources, tgt) {
    const y2 = tgt.y - (tgt.height/2);
    const botY = Math.max(...sources.map(s => s.y + s.height/2));
    const midY = botY + (y2 - botY)/2;
    const xs = sources.map(s => s.x);
    sources.forEach(s => drawPath(p, `M ${s.x} ${s.y + s.height/2} L ${s.x} ${midY}`));
    drawPath(p, `M ${Math.min(...xs)} ${midY} L ${Math.max(...xs)} ${midY}`, 'bar-or');
    drawPath(p, `M ${tgt.x} ${midY} L ${tgt.x} ${y2}`);
}
function drawDoubleBar(p, x1, x2, y) {
    if(Math.abs(x1-x2) < 20) { x1-=20; x2+=20; }
    p.appendChild(createEl('line', { x1:x1, y1:y, x2:x2, y2:y, class:'bar-and-outer' }));
    p.appendChild(createEl('line', { x1:x1, y1:y, x2:x2, y2:y, class:'bar-and-inner' }));
}
function drawLoop(p, src, tgt, key) {
    const center = (src.x + tgt.x) / 2;
    if(loopOffsets[key] === undefined) loopOffsets[key] = Math.max(src.x, tgt.x) + 80 - center;
    if (loopOffsets[key] > 0 && loopOffsets[key] < 40) loopOffsets[key] = 40;
    if (loopOffsets[key] < 0 && loopOffsets[key] > -40) loopOffsets[key] = -40;
    const xLoop = center + loopOffsets[key];
    const yStart = src.y + (src.height/2);
    const yEnd = tgt.y - (tgt.height/2);
    const yBot = yStart + 20;
    const yTop = yEnd - 20;
    drawPath(p, `M ${src.x} ${yStart} L ${src.x} ${yBot} L ${xLoop} ${yBot} L ${xLoop} ${yTop} L ${tgt.x} ${yTop} L ${tgt.x} ${yEnd}`);
    drawArrowHead(p, xLoop, (yBot+yTop)/2);
    const handle = createEl('line', { x1: xLoop, y1: yBot, x2: xLoop, y2: yTop, class: 'loop-handle', 'data-key': key });
    handle.addEventListener('mousedown', onLoopDragStart);
    handle.addEventListener('touchstart', onLoopDragStart, {passive: false});
    p.appendChild(handle);
}

window.onload = render;