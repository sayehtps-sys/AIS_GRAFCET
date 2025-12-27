// --- twin.js ---
// --- twin.js ---
let currentSystem = null;
let physicsInterval = null;
let systemState = {}; // Holds sensors: { "Level_High": true, ... }
let initialData = null; // NEW: Store for reset

// Called when you load a JSON file
function loadSystem(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        
        // CLEAR GLOBALS that systems might define (Critical for closures)
        if (window.pressDcy) delete window.pressDcy;
        if (window.toggleAuto) delete window.toggleAuto;

        // 1. Load Layout (NEW)
        if (data.layout) {
            importedLayout = data.layout;
        } else {
            importedLayout = null; // Reset if no layout in file
        }

        // 2. Inject Grafcet Code
        document.getElementById('code').value = data.grafcet;
        render(); // This will now use importedLayout
        
        // 3. Inject System SVG
        const container = document.getElementById('twin-container');
        container.innerHTML = data.svg;
        
        // 4. Initialize Logic
        const logicFn = new Function('inputs', 'dt', 'svg', 'state', data.logic);
        
        initialData = data; // Save for reset
        currentSystem = {
            logic: logicFn,
            state: JSON.parse(JSON.stringify(data.initialState || {})) // Deep clone for reset reliability
        };
        
        startPhysics();
        console.log("System Loaded:", data.title);
    } catch(e) {
        console.error("Invalid System JSON", e);
    }
}

// --- NEW FUNCTION: Call this to download the fixed JSON ---
function saveSystem() {
    if (!currentSystem) return alert("No system loaded to save.");

    // 1. Capture current Node Positions
    const layoutData = {
        nodes: {},
        loops: loopOffsets
    };
    
    Object.keys(nodePos).forEach(k => {
        layoutData.nodes[k] = { x: nodePos[k].x, y: nodePos[k].y };
    });

    // 2. Build the JSON Object
    // Extract logic body from the Function object
    let logicBody = "";
    try {
        const match = currentSystem.logic.toString().match(/\{([\s\S]*)\}/);
        logicBody = match ? match[1].trim() : currentSystem.logic.toString();
    } catch(e) {
        console.error("Logic extraction failed", e);
    }

    const exportData = {
        title: initialData ? initialData.title : "Saved System",
        grafcet: document.getElementById('code').value,
        svg: document.getElementById('twin-container').innerHTML,
        initialState: JSON.parse(JSON.stringify(currentSystem.state)), // Capture current state or initial? Usually initial for re-use.
        logic: logicBody,
        layout: layoutData // <--- This saves your design!
    };

    // 3. Trigger Download
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (initialData && initialData.title ? initialData.title.replace(/\s+/g, '_').toLowerCase() : "system") + "_fixed.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function startPhysics() {
    if(physicsInterval) clearInterval(physicsInterval);
    // Run physics at 60FPS for smooth animation
    physicsInterval = setInterval(() => {
        if(!currentSystem) return;
        
        // 1. Get Inputs from GRAFCET (Active Actions)
        const inputs = {};
        // activeTokens is a Set from core.js/simulation.js
        activeTokens.forEach(stepId => {
            const step = nodePos[stepId];
            if(step && step.act) {
                inputs[step.act] = true;
            }
        });

        // 2. Run System Physics & Update SVG
        const svg = document.getElementById('twin-container');
        // dt = 0.016 (approx 60fps)
        const sensors = currentSystem.logic(inputs, 0.016, svg, currentSystem.state);
        
        // 3. Store Sensors for GRAFCET to read
        systemState = sensors || {};
        
    }, 16);
}

function resetSystem() {
    if(!initialData || !currentSystem) return;
    
    // 1. Reset state IN PLACE (Critical for closure references)
    // Don't replace the object, overwrite properties
    const newState = JSON.parse(JSON.stringify(initialData.initialState || {}));
    
    // Clear current keys
    Object.keys(currentSystem.state).forEach(k => delete currentSystem.state[k]);
    // Assign new keys
    Object.assign(currentSystem.state, newState);

    systemState = {};
    
    // 2. Re-inject SVG to clear any stuck animations/styles
    const container = document.getElementById('twin-container');
    container.innerHTML = initialData.svg;
    
    console.log("System Reset");
}
window.loadSystemFromData = function(data) {
    if (data.svg) {
         const c = document.getElementById('twin-container');
         if(c) c.innerHTML = data.svg;
    }
    if (typeof loadSystem === 'function') {
        try { loadSystem(data); } catch(e) { console.error(e); }
    }
};

// --- NEW: Restore Original Auto-Layout ---
window.restoreOriginalLayout = function() {
    if (!initialData) return;
    
    // 1. Deep clone the original data
    const cleanData = JSON.parse(JSON.stringify(initialData));
    
    // 2. DO NOT delete layout. We want the "JSON Default", not "Auto Default".
    // if (cleanData.layout) delete cleanData.layout; 
    
    // 3. Force Clear Core Cache (Removes manual drags)
    if(window.clearLayout) window.clearLayout();
    
    // 4. Reload (This will re-apply cleanData.layout if it exists)
    loadSystem(JSON.stringify(cleanData));
    
    // 5. Center
    setTimeout(() => {
        if(window.resetView) window.resetView();
    }, 50);
    console.log("Original JSON Layout Restored");
};


window.loadSystemFromData = function(data) {
    if (data.svg) {
         const c = document.getElementById('twin-container');
         if(c) c.innerHTML = data.svg;
    }
    if (typeof g !== 'undefined' && data.grafcet) {
        g.setGraph({}); // Reset
        // Clear existing
        g.nodes().forEach(v => g.removeNode(v));
        
        if (data.grafcet.nodes) {
            data.grafcet.nodes.forEach(n => {
                 g.setNode(n.id, { label: n.label, type: n.type, ...n });
            });
        }
        if (data.grafcet.links) {
            data.grafcet.links.forEach(l => {
                 g.setEdge(l.source, l.target, { type: l.type, ...l });
            });
        }
        if(typeof drawScene === 'function') drawScene();
    } else {
        // Fallback to original just in case
        if (typeof loadSystem === 'function') {
            try { loadSystem(data); } catch(e) { }
        }
    }
};

