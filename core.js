// --- Global State ---
let graphData = null;
let nodePos = {};
let loopOffsets = {};
let view = { x: 50, y: 50, scale: 1 };
let importedLayout = null; // NEW: Holds saved layout data

// Expose reset function to clearing global state
window.clearLayout = function() {
    importedLayout = null;
    nodePos = {};
    loopOffsets = {};
    console.log("Layout Cache Cleared");
};

// Animation State
let simInterval = null;
let activeTokens = new Set(); // Set of active Step IDs
let isRunning = false;

let dragInfo = { type: null, id: null, startMouse: {x:0, y:0}, startObj: {x:0, y:0}, startView: {x:0, y:0}, srcTgtCenter: 0 };

// --- Init ---
let timer;
function debounce() { clearTimeout(timer); timer = setTimeout(render, 500); }

function insert(txt) {
    const el = document.getElementById('code');
    const v = el.value;
    const s = el.selectionStart;
    el.value = v.slice(0,s) + "\n" + txt + v.slice(el.selectionEnd);
    render();
}

// --- Main Render ---
function render() {
    stopSim(); 
    activeTokens.clear(); // Ensure tokens are cleared on re-render
    const input = document.getElementById('code').value;
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 70, ranksep: 60, edgesep: 30 });
    g.setDefaultEdgeLabel(() => ({}));

    const steps = {};
    const rawFlows = [];

    const lines = input.split('\n');
    lines.forEach(l => {
        l = l.trim();
        if(!l || l.startsWith('//')) return;

        const sMatch = l.match(/^(S\d+)\s*(\*)?\s*(".*")?/);
        if(sMatch && !l.includes('->')) {
            steps[sMatch[1]] = {
                id: sMatch[1],
                lbl: sMatch[1].replace('S',''),
                init: !!sMatch[2],
                act: sMatch[3]?sMatch[3].replace(/"/g,''):null
            };
        }

        if(l.includes('->')) {
            const parts = l.split(':');
            const cond = parts[1] ? parts[1].trim() : "";
            const sides = parts[0].split('->');
            const srcs = sides[0].split('+').map(x=>x.trim());
            const tgts = sides[1].split('+').map(x=>x.trim());
            rawFlows.push({ srcs, tgts, cond });
        }
    });

    Object.keys(steps).forEach(k => {
        g.setNode(k, { ...steps[k], type: 'step', width: 40, height: 40 });
    });
    rawFlows.forEach(f => {
        [...f.srcs, ...f.tgts].forEach(s => {
            if(!g.node(s)) g.setNode(s, { id:s, lbl:s.replace('S',''), type:'step', width:40, height:40 });
        });
    });

    let uid = 0;
    rawFlows.forEach(f => {
        const isAndSplit = f.tgts.length > 1;
        const isAndJoin = f.srcs.length > 1;
        const tId = `T_${uid++}`;

        g.setNode(tId, { type:'trans', lbl: f.cond, width: 40, height: 20 });

        if(isAndJoin) {
            const hubId = `hub_j_${uid++}`;
            g.setNode(hubId, { type:'hub_and', width:1, height:10 });
            f.srcs.forEach(s => g.setEdge(s, hubId));
            g.setEdge(hubId, tId);
            f.tgts.forEach(t => g.setEdge(tId, t));
        }
        else if(isAndSplit) {
            const hubId = `hub_s_${uid++}`;
            g.setNode(hubId, { type:'hub_and', width:1, height:10 });
            g.setEdge(f.srcs[0], tId);
            g.setEdge(tId, hubId);
            f.tgts.forEach(t => g.setEdge(hubId, t));
        }
        else {
            g.setEdge(f.srcs[0], tId);
            g.setEdge(tId, f.tgts[0]);
        }
    });

    dagre.layout(g);

    // Apply Layout Persistence if available
    if (importedLayout) {
        if (importedLayout.nodes) {
            Object.keys(importedLayout.nodes).forEach(id => {
                const n = g.node(id);
                if (n) {
                    n.x = importedLayout.nodes[id].x;
                    n.y = importedLayout.nodes[id].y;
                }
            });
        }
        if (importedLayout.loops) {
            loopOffsets = { ...importedLayout.loops };
        } else {
            loopOffsets = {};
        }
    } else {
        loopOffsets = {};
    }

    graphData = g;
    nodePos = {};
    g.nodes().forEach(v => {
        const n = g.node(v);
        nodePos[v] = { x: n.x, y: n.y, width: n.width, height: n.height, type: n.type, ...n };
    });

    drawScene();
}