// --- Draw Scene ---
function drawScene() {
    const scene = document.getElementById('scene');
    scene.innerHTML = '';
    updateTransform();

    const edgeGroup = createEl('g', {id:'edges'});
    const nodeGroup = createEl('g', {id:'nodes'});
    scene.appendChild(edgeGroup);
    scene.appendChild(nodeGroup);

    Object.keys(nodePos).forEach(k => {
        const n = nodePos[k];
        if(n.type === 'hub_and') return;

        const grp = createEl('g', {
            class: 'node-group',
            transform: `translate(${n.x},${n.y})`,
            'data-id': k
        });

        grp.addEventListener('mousedown', onNodeDragStart);

        if(n.type === 'step') {
            grp.appendChild(createEl('rect', {x:-20, y:-20, width:40, height:40, class:'box-step'}));
            if(n.init) grp.appendChild(createEl('rect', {x:-16, y:-16, width:32, height:32, class:'box-init'}));
            const txt = createEl('text', {class:'lbl-step'});
            txt.textContent = n.lbl;
            grp.appendChild(txt);

            if(n.act) {
                grp.appendChild(createEl('line', {x1:20, y1:0, x2:35, y2:0, stroke:'black'}));
                const w = Math.max(50, n.act.length*7+10);
                grp.appendChild(createEl('rect', {x:35, y:-15, width:w, height:30, class:'box-act'}));
                createTxt(grp, 40, 1, n.act, 'lbl-act');
            }
        }
        else if(n.type === 'trans') {
            grp.appendChild(createEl('line', {x1:-15, y1:0, x2:15, y2:0, class:'line-trans'}));
            grp.appendChild(createEl('rect', {x:-15, y:-10, width:30, height:20, fill:'transparent'}));

            if(n.lbl) {
                const w = n.lbl.length * 7 + 10;
                grp.appendChild(createEl('rect', {x:18, y:-8, width:w, height:16, class:'bg-cond'}));
                createTxt(grp, 20, 0, n.lbl, 'lbl-cond');
            }
        }
        nodeGroup.appendChild(grp);
    });
    
    // Add hub elements separately so they can be draggable
    Object.keys(nodePos).forEach(k => {
        const n = nodePos[k];
        if(n.type === 'hub_and') {
            const grp = createEl('g', {
                class: 'node-group',
                transform: `translate(${n.x},${n.y})`,
                'data-id': k
            });

            grp.addEventListener('mousedown', onNodeDragStart);

            // Create an invisible element for the hub to make it draggable
            grp.appendChild(createEl('circle', {
                cx: 0, 
                cy: 0, 
                r: 8, 
                fill: 'transparent', 
                stroke: 'transparent', 
                'stroke-width': 1,
                style: 'cursor: move;'
            }));
            
            nodeGroup.appendChild(grp);
        }
    });
    
    drawEdges(edgeGroup);
    updateVisuals(); // Apply animation classes
}

function drawEdges(container) {
    container.innerHTML = '';
    const drawnEdges = new Set();
    const g = graphData;
    const edges = g.edges();
    const getP = (id) => nodePos[id];

    // 1. AND Hubs
    const hubs = g.nodes().filter(v => getP(v).type === 'hub_and');
    hubs.forEach(hubId => {
        const hub = getP(hubId);
        const inEdges = g.inEdges(hubId);
        const outEdges = g.outEdges(hubId);
        const nodes = [...inEdges.map(e=>getP(e.v)), ...outEdges.map(e=>getP(e.w))];
        const xs = nodes.map(n => n.x);
        drawDoubleBar(container, Math.min(...xs), Math.max(...xs), hub.y);
        inEdges.forEach(e => {
            const src = getP(e.v);
            drawVertical(container, src.x, src.y+(src.height/2), hub.y);
            drawnEdges.add(e);
        });
        outEdges.forEach(e => {
            const tgt = getP(e.w);
            if(tgt.y < hub.y) drawLoop(container, hub, tgt, e.v+'-'+e.w);
            else drawVertical(container, tgt.x, hub.y, tgt.y-(tgt.height/2));
            drawnEdges.add(e);
        });
    });

    // 2. Standard
    const remaining = edges.filter(e => !drawnEdges.has(e));
    const bySrc = {};
    remaining.forEach(e => { if(!bySrc[e.v]) bySrc[e.v]=[]; bySrc[e.v].push(e); });

    Object.keys(bySrc).forEach(srcId => {
        const out = bySrc[srcId];
        const src = getP(srcId);
        const normal = [];
        out.forEach(e => {
            const tgt = getP(e.w);
            if(tgt.y < src.y) { drawLoop(container, src, tgt, e.v+'-'+e.w); drawnEdges.add(e); }
            else normal.push(e);
        });
        if(normal.length === 0) return;
        if(src.type === 'step' && normal.length > 1) {
            drawOrDivergence(container, src, normal.map(e => getP(e.w)));
            normal.forEach(e => drawnEdges.add(e));
        } else {
            normal.forEach(e => {
                const tgt = getP(e.w);
                // Simplified drawing for simulation view - just direct lines usually fine
                drawOrthogonal(container, src, tgt);
                drawnEdges.add(e);
            });
        }
    });
}