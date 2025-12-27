// --- START OF FILE simulation.js ---

function startSim() {
    if(isRunning) return;
    
    // 1. If we have no active tokens, find initial steps
    if(activeTokens.size === 0) {
        let hasInit = false;
        Object.keys(nodePos).forEach(k => {
            if(nodePos[k].init) { activeTokens.add(k); hasInit=true; }
        });
        // Fallback if no init step defined
        if(!hasInit) {
            const first = Object.keys(nodePos).find(k => nodePos[k].type === 'step');
            if(first) activeTokens.add(first);
        }
    }

    isRunning = true;
    updateVisuals();
    // Run loop every 100ms
    simInterval = setInterval(simTick, 100); 
}

function stopSim() {
    isRunning = false;
    clearInterval(simInterval);
    updateVisuals();
}

function resetSim() {
    stopSim();
    activeTokens.clear();
    
    // Also reset the Digital Twin state
    if (window.resetSystem) {
        resetSystem();
    }

    updateVisuals();
    // Re-highlight initial steps if any
    Object.keys(nodePos).forEach(k => {
        if(nodePos[k].init) {
            const el = document.querySelector(`.node-group[data-id="${k}"]`);
            if(el) el.classList.add('step-active');
        }
    });
}

function simTick() {
    if(!isRunning) return;

    const transitionsToFire = [];
    const g = graphData;

    // 1. Find candidate transitions connected to active steps
    const candidateTrans = new Set();
    activeTokens.forEach(stepId => {
        const outEdges = g.outEdges(stepId);
        outEdges.forEach(e => {
            const target = g.node(e.w);
            if(target.type === 'trans') candidateTrans.add(e.w);
            else if(target.type === 'hub_and') {
                g.outEdges(e.w).forEach(e2 => candidateTrans.add(e2.w));
            }
        });
    });

    // 2. Check Conditions
    candidateTrans.forEach(tId => {
        const tNode = nodePos[tId];
        const condLabel = tNode.lbl || ""; 
        
        // A. Are all preceding steps active?
        const prev = getPrecedingSteps(tId);
        const allActive = prev.every(s => activeTokens.has(s));

        if(allActive) {
            // B. Check the Logic Condition (Handle AND/OR)
            // We pass the Label and the current Sensors (systemState)
            if(evaluateCondition(condLabel, systemState)) {
                transitionsToFire.push(tId);
            }
        }
    });

    // 3. Fire Transitions
    if(transitionsToFire.length > 0) {
        transitionsToFire.forEach(tId => {
            const prev = getPrecedingSteps(tId);
            const next = getSucceedingSteps(tId);
            
            // Consume tokens
            prev.forEach(s => activeTokens.delete(s));
            // Produce tokens
            next.forEach(s => activeTokens.add(s));
            
            highlightTrans(tId);
        });
        updateVisuals();
    }
}

// --- THE LOGIC PARSER (Crucial Fix) ---
function evaluateCondition(expr, sensors) {
    if(!expr || expr.trim() === "") return true; // Empty = Always True
    if(!sensors) return false;

    let clean = expr.trim();
    
    // 1. Handle AND Logic ( "." or "*" )
    // Example: "m . a0 . b1" -> ["m", "a0", "b1"]
    if(clean.includes('.') || clean.includes('*')) {
        const parts = clean.split(/[\.\*]/); 
        // Returns TRUE only if ALL parts are true
        return parts.every(p => sensors[p.trim()] === true);
    }
    
    // 2. Handle OR Logic ( "+" )
    if(clean.includes('+')) {
        const parts = clean.split('+');
        return parts.some(p => sensors[p.trim()] === true);
    }

    // 3. Single Variable
    return sensors[clean] === true;
}

// --- Helpers ---
function getPrecedingSteps(tId) {
    const res = [];
    const g = graphData;
    if(!g.inEdges(tId)) return res;
    g.inEdges(tId).forEach(e => {
        const n = g.node(e.v);
        if(n.type==='step') res.push(e.v);
        else if(n.type==='hub_and') g.inEdges(e.v).forEach(e2=>res.push(e2.v));
    });
    return res;
}
function getSucceedingSteps(tId) {
    const res = [];
    const g = graphData;
    if(!g.outEdges(tId)) return res;
    g.outEdges(tId).forEach(e => {
        const n = g.node(e.w);
        if(n.type==='step') res.push(e.w);
        else if(n.type==='hub_and') g.outEdges(e.w).forEach(e2=>res.push(e2.w));
    });
    return res;
}
function highlightTrans(id) {
    const el = document.querySelector(`.node-group[data-id="${id}"]`);
    if(el) {
        el.classList.add('trans-firing');
        setTimeout(()=>el.classList.remove('trans-firing'), 200);
    }
}
function updateVisuals() {
    document.querySelectorAll('.node-group').forEach(el => el.classList.remove('step-active'));
    activeTokens.forEach(id => {
        const el = document.querySelector(`.node-group[data-id="${id}"]`);
        if(el) el.classList.add('step-active');
    });
}