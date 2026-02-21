"use strict";


// ─── Shared PRNG (seeded LCG for reproducibility) ───────────────────────────
let _seed = 98765;
function rand() {
    _seed = (Math.imul(_seed, 1664525) + 1013904223) | 0;
    return (_seed >>> 0) / 4294967296;
}
function resetSeed() { _seed = 98765; }

function randn() {
    // Box-Muller
    const u = 1 - rand(), v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─── Canvas drawing helpers ─────────────────────────────────────────────────
function drawAxes(ctx, pad, W, H, xLabel, yLabel, title) {
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, H - pad.b);
    ctx.lineTo(W - pad.r, H - pad.b);
    ctx.stroke();
    ctx.fillStyle = "#333";
    ctx.font = "13px Georgia";
    ctx.textAlign = "center";
    if (xLabel) ctx.fillText(xLabel, (pad.l + W - pad.r) / 2, H - 6);
    if (yLabel) {
        ctx.save();
        ctx.translate(14, (pad.t + H - pad.b) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
    }
    if (title) {
        ctx.font = "12px Georgia"; ctx.fillStyle = "#444";
        ctx.fillText(title, (pad.l + W - pad.r) / 2, pad.t - 6);
    }
}

function gridLines(ctx, pad, W, H, nx, ny, xMin, xMax, yMin, yMax) {
    ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 0.7;
    ctx.font = "10px Georgia"; ctx.fillStyle = "#666";
    for (let i = 0; i <= ny; i++) {
        const y = pad.t + (H - pad.t - pad.b) * (1 - i / ny);
        const val = yMin + (yMax - yMin) * i / ny;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(val.toFixed(val === Math.round(val) ? 0 : 2), pad.l - 4, y + 4);
    }
    for (let i = 0; i <= nx; i++) {
        const x = pad.l + (W - pad.l - pad.r) * i / nx;
        const val = xMin + (xMax - xMin) * i / nx;
        ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, H - pad.b); ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(val.toFixed(val === Math.round(val) ? 0 : 1), x, H - pad.b + 14);
    }
}

function toCanvasXY(val, min, max, pMin, pMax) {
    return pMin + (val - min) / (max - min) * (pMax - pMin);
}

// ─── Lazy canvas rendering ───────────────────────────────────────────────────
// Defers simulation drawing until the canvas is near the viewport.
// Falls back to immediate execution if IntersectionObserver is unavailable.
function lazyDraw(canvasId, drawFn) {
    const cv = document.getElementById(canvasId);
    if (!cv) return;
    if (!("IntersectionObserver" in window)) { drawFn(cv); return; }
    new IntersectionObserver(function(entries, obs) {
        if (entries[0].isIntersecting) {
            obs.disconnect();
            drawFn(cv);
        }
    }, { rootMargin: "150px 0px" }).observe(cv);
}

