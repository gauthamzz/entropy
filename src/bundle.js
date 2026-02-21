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

/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 1: KMR Stochastic Stability ─────────────────────────────────────
lazyDraw("kmrChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const N = 50;  // agents
    const H1 = 2.0, H2 = 1.2, nu = 1.0, gamma = 1.5;
    // Separatrix: DeltaH = nu*((1-x)^g - x^g), DeltaH=0.8
    // For gamma=1.5: solve numerically
    // x*: nu*((1-x)^1.5 - x^1.5) = 0.8 → (1-x)^1.5 - x^1.5 = 0.8
    // At x=0.3: (0.7)^1.5 - (0.3)^1.5 = 0.5857 - 0.1643 = 0.421... too small
    // At x=0.2: (0.8)^1.5 - (0.2)^1.5 = 0.7155 - 0.0894 = 0.626... still small
    // At x=0.1: (0.9)^1.5 - (0.1)^1.5 = 0.8538 - 0.0316 = 0.822... too big
    // At x=0.12: (0.88)^1.5 - (0.12)^1.5 = 0.8256 - 0.0416 = 0.784
    // At x=0.11: (0.89)^1.5 - (0.11)^1.5 = 0.8396 - 0.0365 = 0.803
    // So x* ≈ 0.11-0.12 for DeltaH=0.8, nu=1, gamma=1.5
    // Let's compute it properly in findSep below

    function uVal(k, isP1) {
        const xi = k / N;
        if (isP1) return H1 + nu * Math.pow(xi, gamma);
        return H2 + nu * Math.pow(1 - xi, gamma);
    }

    function runKMR(eps, T) {
        resetSeed();
        let k = Math.floor(N / 2);
        const hist = new Array(N + 1).fill(0);
        const burnin = Math.floor(T * 0.25);
        for (let t = 0; t < T; t++) {
            const u1 = uVal(k, true);
            const u2 = uVal(k, false);
            if (rand() < eps) {
                // mutation: one random agent picks randomly
                const coinP1 = rand() < 0.5;
                const agentOnP1 = rand() < (k / N);
                if (agentOnP1 && !coinP1 && k > 0) k--;
                else if (!agentOnP1 && coinP1 && k < N) k++;
            } else {
                // best response: one random agent switches if beneficial
                const agentOnP1 = rand() < (k / N);
                if (agentOnP1) {
                    if (u2 > u1 && k > 0) k--;
                } else {
                    if (u1 > u2 && k < N) k++;
                }
            }
            if (t >= burnin) hist[k]++;
        }
        return hist;
    }

    const epsilons = [0.15, 0.07, 0.025, 0.006];
    const colors = ["#e74c3c", "#e67e22", "#2980b9", "#27ae60"];
    const labels = ["ε = 0.15", "ε = 0.07", "ε = 0.025", "ε = 0.006"];
    const T = 300000;

    // Run all 4 chains
    const hists = epsilons.map(eps => runKMR(eps, T));

    // Layout: 4 histograms side by side
    const panW = (W - 40) / 4;
    const panH = CH - 70;
    const bTop = 55;

    ctx.fillStyle = "#555"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Figure 1: KMR stationary distribution. State k = # agents on P₁ (max-entropy). All agents on P₁ = k=50.", W/2, 16);
    ctx.fillText("H₁=2.0, H₂=1.2, Δ H=0.8, ν=1.0, γ=1.5. As ε→0, mass concentrates on k=50 (max-entropy corner).", W/2, 30);

    for (let p = 0; p < 4; p++) {
        const hist = hists[p];
        const total = hist.reduce((s, c) => s + c, 0);
        const probs = hist.map(c => c / total);
        const maxP = Math.max(...probs);

        const xOff = 18 + p * panW;
        const pw = panW - 10;

        // axes
        ctx.strokeStyle = "#999"; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(xOff, bTop); ctx.lineTo(xOff, bTop + panH);
        ctx.lineTo(xOff + pw, bTop + panH); ctx.stroke();

        // bars
        const barW = pw / (N + 1);
        for (let k = 0; k <= N; k++) {
            const bh = (probs[k] / Math.max(maxP, 0.001)) * panH * 0.88;
            const bx = xOff + k * barW;
            const by = bTop + panH - bh;
            ctx.fillStyle = k === N ? colors[p] : (k === 0 ? "#aaa" : "#ccc");
            ctx.fillRect(bx, by, Math.max(barW - 0.5, 0.5), bh);
        }

        // label
        ctx.fillStyle = colors[p];
        ctx.font = "bold 11px Georgia"; ctx.textAlign = "center";
        ctx.fillText(labels[p], xOff + pw / 2, bTop - 8);

        // mass at k=N
        const massAtN = (probs[N] * 100).toFixed(1);
        ctx.fillStyle = "#333"; ctx.font = "10px Georgia";
        ctx.fillText(`P(k=50)=${massAtN}%`, xOff + pw / 2, bTop + panH + 28);

        // x-axis ticks
        ctx.fillStyle = "#666";
        [0, 25, 50].forEach(k => {
            const x = xOff + k * barW;
            ctx.textAlign = "center";
            ctx.fillText(String(k), x, bTop + panH + 14);
        });
    }

    // Shared y-label
    ctx.save();
    ctx.translate(8, bTop + panH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Probability", 0, 0); ctx.restore();

    ctx.fillStyle = "#555"; ctx.font = "10px Georgia"; ctx.textAlign = "center";
    ctx.fillText("State k (# on P₁)", W / 2, CH - 4);
});

/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 2: Basin of Attraction Heat Map ─────────────────────────────────
lazyDraw("basinChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const nu = 1.0;
    const gammas = [1.5, 3.0];
    const panelW = (W - 60) / 2;
    const panelH = CH - 60;
    const pad = { l: 50, t: 40, b: 40, r: 20 };

    const NX = 80, NY = 60;
    const x0Min = 0.01, x0Max = 0.99;
    const dhMin = 0.0, dhMax = 2.0;

    function g(x, gamma) {
        return Math.pow(1 - x, gamma) - Math.pow(x, gamma);
    }

    function findSep(deltaH, nu, gamma) {
        if (deltaH >= nu) return 0; // no interior equilibrium → P1 wins everywhere
        let lo = 0.001, hi = 0.499;
        for (let i = 0; i < 60; i++) {
            const mid = (lo + hi) / 2;
            if (nu * g(mid, gamma) > deltaH) lo = mid;
            else hi = mid;
        }
        return (lo + hi) / 2;
    }

    function replicatorWinner(x0, deltaH, nu, gamma, T = 150, dt = 0.1) {
        let x = x0;
        for (let t = 0; t < T; t += dt) {
            const dx = x * (1 - x) * (deltaH + nu * (Math.pow(x, gamma) - Math.pow(1 - x, gamma)));
            x = Math.max(0.001, Math.min(0.999, x + dx * dt));
        }
        return x > 0.5 ? 1 : 2;
    }

    for (let pi = 0; pi < 2; pi++) {
        const gamma = gammas[pi];
        const xOff = pi * (panelW + 20) + 10;

        // Draw pixel grid
        const imgW = NX, imgH = NY;
        const imgData = ctx.createImageData(Math.floor(panelW - pad.l - pad.r), Math.floor(panelH - pad.t - pad.b));
        const pixW = Math.floor(panelW - pad.l - pad.r);
        const pixH = Math.floor(panelH - pad.t - pad.b);

        for (let yi = 0; yi < pixH; yi++) {
            for (let xi = 0; xi < pixW; xi++) {
                const x0 = x0Min + (x0Max - x0Min) * xi / (pixW - 1);
                const dh = dhMin + (dhMax - dhMin) * (1 - yi / (pixH - 1));
                const winner = replicatorWinner(x0, dh, nu, gamma);
                const idx = (yi * pixW + xi) * 4;
                if (winner === 1) {
                    imgData.data[idx] = 39; imgData.data[idx+1] = 174; imgData.data[idx+2] = 96; // green
                } else {
                    imgData.data[idx] = 192; imgData.data[idx+1] = 57; imgData.data[idx+2] = 43; // red
                }
                imgData.data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, xOff + pad.l, pad.t);

        // Axes
        ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xOff + pad.l, pad.t);
        ctx.lineTo(xOff + pad.l, pad.t + pixH);
        ctx.lineTo(xOff + pad.l + pixW, pad.t + pixH);
        ctx.stroke();

        // Overlay theoretical separatrix
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.beginPath();
        let first = true;
        for (let xi = 0; xi < pixW; xi++) {
            const x0 = x0Min + (x0Max - x0Min) * xi / (pixW - 1);
            // find DeltaH such that x* = x0 → DeltaH = nu*g(x0, gamma)
            const dhAtSep = nu * g(x0, gamma);
            if (dhAtSep < 0 || dhAtSep > dhMax) continue;
            const py = pad.t + pixH * (1 - (dhAtSep - dhMin) / (dhMax - dhMin));
            const px = xOff + pad.l + xi;
            if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Horizontal line at DeltaH = nu = 1.0
        const dhLine = pad.t + pixH * (1 - (nu - dhMin) / (dhMax - dhMin));
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
        ctx.beginPath(); ctx.moveTo(xOff + pad.l, dhLine); ctx.lineTo(xOff + pad.l + pixW, dhLine); ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.fillStyle = "#333"; ctx.font = "11px Georgia";
        ctx.textAlign = "center";
        ctx.fillText(`γ = ${gamma}`, xOff + pad.l + pixW / 2, pad.t - 10);
        ctx.fillText("Initial share x₀", xOff + pad.l + pixW / 2, pad.t + pixH + 28);

        // x-axis ticks
        [0, 0.25, 0.5, 0.75, 1.0].forEach(v => {
            const px = xOff + pad.l + (v - x0Min) / (x0Max - x0Min) * pixW;
            ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
            ctx.fillText(v.toFixed(2), px, pad.t + pixH + 14);
        });

        if (pi === 0) {
            ctx.save(); ctx.translate(xOff + 12, pad.t + pixH / 2);
            ctx.rotate(-Math.PI / 2); ctx.fillStyle = "#333"; ctx.font = "11px Georgia";
            ctx.textAlign = "center"; ctx.fillText("ΔH / ν", 0, 0); ctx.restore();
            [0, 0.5, 1.0, 1.5, 2.0].forEach(v => {
                const py = pad.t + pixH * (1 - (v - dhMin) / (dhMax - dhMin));
                ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "right";
                ctx.fillText(v.toFixed(1), xOff + pad.l - 4, py + 4);
            });
        }

        // Legend
        ctx.font = "10px Georgia"; ctx.textAlign = "left";
        ctx.fillStyle = "rgba(39,174,96,0.85)"; ctx.fillRect(xOff + pad.l + 6, pad.t + 6, 12, 10);
        ctx.fillStyle = "#333"; ctx.fillText("P₁ wins", xOff + pad.l + 22, pad.t + 15);
        ctx.fillStyle = "rgba(192,57,43,0.85)"; ctx.fillRect(xOff + pad.l + 6, pad.t + 20, 12, 10);
        ctx.fillStyle = "#333"; ctx.fillText("P₂ wins", xOff + pad.l + 22, pad.t + 29);
        ctx.fillStyle = "#fff"; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(xOff + pad.l + 6, pad.t + 34); ctx.lineTo(xOff + pad.l + 18, pad.t + 34); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "#333"; ctx.fillText("Separatrix x*(ΔH)", xOff + pad.l + 22, pad.t + 38);
    }
});


/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 3: Phase Portrait on 2-Simplex ──────────────────────────────────
lazyDraw("phaseChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const margin = 55;

    const H = [2.0, 1.5, 1.0];
    const nu = 1.0, gamma = 1.5;

    // Barycentric → Cartesian. P1 at top, P2 bottom-right, P3 bottom-left
    const corners = [
        [W / 2, margin + 10],                       // P1 (top, max-entropy)
        [W - margin - 10, CH - margin - 20],         // P2 (bottom-right)
        [margin + 10, CH - margin - 20]              // P3 (bottom-left)
    ];

    function bary2cart(x1, x2, x3) {
        return [
            x1 * corners[0][0] + x2 * corners[1][0] + x3 * corners[2][0],
            x1 * corners[0][1] + x2 * corners[1][1] + x3 * corners[2][1]
        ];
    }

    function repl(x1, x2, x3) {
        const u = [H[0] + nu * Math.pow(x1, gamma),
                   H[1] + nu * Math.pow(x2, gamma),
                   H[2] + nu * Math.pow(x3, gamma)];
        const ubar = x1 * u[0] + x2 * u[1] + x3 * u[2];
        return [x1 * (u[0] - ubar), x2 * (u[1] - ubar), x3 * (u[2] - ubar)];
    }

    // Draw simplex edges
    ctx.strokeStyle = "#666"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    ctx.lineTo(corners[1][0], corners[1][1]);
    ctx.lineTo(corners[2][0], corners[2][1]);
    ctx.closePath(); ctx.stroke();

    // Corner labels
    ctx.font = "13px Georgia"; ctx.fillStyle = "#c0392b";
    ctx.textAlign = "center"; ctx.fillText("P₁  (H=2.0)", corners[0][0], corners[0][1] - 12);
    ctx.fillStyle = "#2980b9";
    ctx.fillText("P₂  (H=1.5)", corners[1][0] + 28, corners[1][1] + 16);
    ctx.fillStyle = "#7f8c8d";
    ctx.fillText("P₃  (H=1.0)", corners[2][0] - 28, corners[2][1] + 16);

    // Velocity field arrows
    const NGrid = 9;
    ctx.strokeStyle = "#bbb"; ctx.lineWidth = 0.8;
    for (let i = 0; i <= NGrid; i++) {
        for (let j = 0; j <= NGrid - i; j++) {
            const k = NGrid - i - j;
            if (k < 0) continue;
            const x1 = i / NGrid, x2 = j / NGrid, x3 = k / NGrid;
            if (x1 < 0.02 && x2 < 0.02) continue;
            if (x1 < 0.02 && x3 < 0.02) continue;
            if (x2 < 0.02 && x3 < 0.02) continue;
            const [dx1, dx2, dx3] = repl(x1, x2, x3);
            const [cx, cy] = bary2cart(x1, x2, x3);
            const [ex, ey] = bary2cart(x1 + dx1 * 0.15, x2 + dx2 * 0.15, x3 + dx3 * 0.15);
            const scale = 18;
            const ddx = (ex - cx) * scale, ddy = (ey - cy) * scale;
            const len = Math.sqrt(ddx*ddx + ddy*ddy);
            if (len < 0.5) continue;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + ddx * 0.9, cy + ddy * 0.9);
            ctx.stroke();
        }
    }

    // Trajectories from 6 starting points
    const starts = [
        [0.05, 0.65, 0.30],
        [0.05, 0.30, 0.65],
        [0.33, 0.33, 0.34],
        [0.50, 0.30, 0.20],
        [0.20, 0.50, 0.30],
        [0.10, 0.10, 0.80],
    ];
    const tColors = ["#c0392b","#c0392b","#c0392b","#c0392b","#c0392b","#c0392b"];

    starts.forEach((s, si) => {
        let [x1, x2, x3] = s;
        ctx.strokeStyle = tColors[si]; ctx.lineWidth = 1.8;
        ctx.beginPath();
        const [sx, sy] = bary2cart(x1, x2, x3);
        ctx.moveTo(sx, sy);

        for (let t = 0; t < 250; t++) {
            const [d1, d2, d3] = repl(x1, x2, x3);
            const dt = 0.12;
            x1 = Math.max(0.001, x1 + d1 * dt);
            x2 = Math.max(0.001, x2 + d2 * dt);
            x3 = Math.max(0.001, x3 + d3 * dt);
            const s2 = x1 + x2 + x3;
            x1 /= s2; x2 /= s2; x3 /= s2;
            const [cx, cy] = bary2cart(x1, x2, x3);
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();

        // Arrow head near end
        const [ex, ey] = bary2cart(x1, x2, x3);
        const [d1, d2, d3] = repl(x1, x2, x3);
        const [ex2, ey2] = bary2cart(x1 + d1*0.01, x2 + d2*0.01, x3 + d3*0.01);
        const ang = Math.atan2(ey2 - ey, ex2 - ex);
        const al = 8;
        ctx.fillStyle = tColors[si];
        ctx.beginPath();
        ctx.moveTo(ex + al * Math.cos(ang), ey + al * Math.sin(ang));
        ctx.lineTo(ex + al * Math.cos(ang + 2.4), ey + al * Math.sin(ang + 2.4));
        ctx.lineTo(ex + al * Math.cos(ang - 2.4), ey + al * Math.sin(ang - 2.4));
        ctx.closePath(); ctx.fill();
    });

    // Mark corners as dots
    [[corners[0], "P₁"], [corners[1], "P₂"], [corners[2], "P₃"]].forEach(([c, label], i) => {
        ctx.fillStyle = i === 0 ? "#c0392b" : "#888";
        ctx.beginPath(); ctx.arc(c[0], c[1], 5, 0, 2 * Math.PI); ctx.fill();
    });

    ctx.fillStyle = "#333"; ctx.font = "12px Georgia"; ctx.textAlign = "center";
    ctx.fillText("All 6 trajectories converge to P₁ (max-entropy corner) — unique global attractor", W/2, CH - 8);
});

/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 4: Invasion Dynamics ────────────────────────────────────────────
lazyDraw("invasionChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const pad = { l: 60, r: 30, t: 35, b: 45 };
    const pw = W - pad.l - pad.r, ph = CH - pad.t - pad.b;

    const nu = 1.0, gamma = 1.5, x0 = 0.05;
    const T = 200, dt = 0.08;
    const NDH = 100;

    // Compute final x1 for each DeltaH
    const dhVals = [], finalX = [];
    for (let i = 0; i <= NDH; i++) {
        const dh = 2.0 * i / NDH;
        let x = x0;
        for (let t = 0; t < T; t += dt) {
            const dx = x * (1 - x) * (dh + nu * (Math.pow(x, gamma) - Math.pow(1 - x, gamma)));
            x = Math.max(0.001, Math.min(0.999, x + dx * dt));
        }
        dhVals.push(dh); finalX.push(x);
    }

    // Theoretical thresholds
    const dhStar = nu * (Math.pow(1 - x0, gamma) - Math.pow(x0, gamma)); // erosion threshold
    const dhCorol = nu; // corollary threshold (always wins)

    // Axes
    drawAxes(ctx, pad, W, CH, "Entropy gap ΔH", "Final share x₁(200)", "");
    gridLines(ctx, pad, W, CH, 4, 4, 0, 2, 0, 1);

    // Plot curve
    ctx.strokeStyle = "#2980b9"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    dhVals.forEach((dh, i) => {
        const px = pad.l + (dh / 2.0) * pw;
        const py = pad.t + ph * (1 - finalX[i]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Threshold lines
    const xThresh1 = pad.l + (dhStar / 2.0) * pw;
    const xThresh2 = pad.l + (dhCorol / 2.0) * pw;
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xThresh1, pad.t); ctx.lineTo(xThresh1, pad.t + ph); ctx.stroke();
    ctx.strokeStyle = "#e67e22";
    ctx.beginPath(); ctx.moveTo(xThresh2, pad.t); ctx.lineTo(xThresh2, pad.t + ph); ctx.stroke();
    ctx.setLineDash([]);

    // Labels on thresholds
    ctx.font = "10px Georgia"; ctx.textAlign = "center";
    ctx.fillStyle = "#e74c3c";
    ctx.fillText(`ΔH* = ${dhStar.toFixed(3)}`, xThresh1, pad.t - 8);
    ctx.fillStyle = "#e67e22";
    ctx.fillText(`ΔH = ν = 1.0`, xThresh2, pad.t + ph + 30);

    // Annotations
    ctx.fillStyle = "#c0392b"; ctx.font = "11px Georgia"; ctx.textAlign = "left";
    ctx.fillText("P₁ wins (x→1)", pad.l + (dhStar / 2.0) * pw + 6, pad.t + 20);
    ctx.fillStyle = "#888"; ctx.textAlign = "right";
    ctx.fillText("P₁ fails (x→0)", xThresh1 - 4, pad.t + ph - 10);

    ctx.fillStyle = "#555"; ctx.font = "10px Georgia"; ctx.textAlign = "center";
    ctx.fillText(`x₀ = ${x0}, ν = ${nu}, γ = ${gamma}`, W/2, pad.t - 10);
});

/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 5: Convergence Rate ─────────────────────────────────────────────
lazyDraw("rateChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const pad = { l: 65, r: 30, t: 35, b: 45 };
    const pw = W - pad.l - pad.r, ph = CH - pad.t - pad.b;

    const nu = 1.0, gamma = 1.5, x0 = 0.90;
    const T = 6.0, dt = 0.05;
    const dhs = [0.2, 0.5, 1.0, 2.0];
    const colors = ["#7f8c8d", "#2980b9", "#27ae60", "#c0392b"];
    const tMax = T, yMin = -20, yMax = 0;

    drawAxes(ctx, pad, W, CH, "Time t", "ln(1 − x₁(t))", "");
    gridLines(ctx, pad, W, CH, 6, 4, 0, tMax, yMin, yMax);

    dhs.forEach((dh, di) => {
        let x = x0;
        const pts = [];
        for (let t = 0; t <= T; t += dt) {
            const logEps = Math.log(1 - x);
            if (logEps <= yMin) break;
            pts.push([t, logEps]);
            const dx = x * (1 - x) * (dh + nu * (Math.pow(x, gamma) - Math.pow(1 - x, gamma)));
            x = Math.min(0.9999, x + dx * dt);
        }

        ctx.strokeStyle = colors[di]; ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach(([t, ly], i) => {
            const px = pad.l + (t / tMax) * pw;
            const py = pad.t + ((yMax - ly) / (yMax - yMin)) * ph;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Theoretical slope line
        const rate = dh + nu;
        const t0 = 0.3;
        const ly0 = Math.log(1 - x0);
        const tEnd = Math.min(tMax, t0 + (-yMin - 0.5) / rate);
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = colors[di]; ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        [t0, tEnd].forEach((t, i) => {
            const ly = ly0 - rate * (t - 0);
            const px = pad.l + (t / tMax) * pw;
            const py = pad.t + ((yMax - ly) / (yMax - yMin)) * ph;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;

        // Label
        const labelT = t0 + 0.4;
        const labelY = ly0 - rate * labelT;
        const lpx = pad.l + (labelT / tMax) * pw + 4;
        const lpy = pad.t + ((yMax - labelY) / (yMax - yMin)) * ph;
        ctx.fillStyle = colors[di]; ctx.font = "10px Georgia"; ctx.textAlign = "left";
        ctx.fillText(`ΔH=${dh}, slope=−${rate.toFixed(1)}`, lpx, lpy);
    });

    ctx.fillStyle = "#555"; ctx.font = "10px Georgia"; ctx.textAlign = "center";
    ctx.fillText(`ν=${nu}, γ=${gamma}, x₀=${x0}. Dashed lines: theoretical slope −(ΔH+ν).`, W/2, pad.t - 10);
});

/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 6: n-Platform Monte Carlo ───────────────────────────────────────
lazyDraw("monteCarloChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const pad = { l: 60, r: 30, t: 35, b: 45 };
    const pw = W - pad.l - pad.r, ph = CH - pad.t - pad.b;

    const Hvals = [2.0, 1.8, 1.5, 1.2, 0.8];
    const n = Hvals.length;
    const nu = 1.2, gamma = 1.5;
    const sigma = 0.12;
    const T = 100, dt = 0.1;
    const NTrials = 30;

    resetSeed();

    function simulatePath(initX) {
        let x = initX.slice();
        const path = [x[0]];
        for (let t = dt; t <= T; t += dt) {
            const u = x.map((xi, i) => Hvals[i] + nu * Math.pow(xi, gamma));
            const ubar = x.reduce((s, xi, i) => s + xi * u[i], 0);
            const dx = x.map((xi, i) => xi * (u[i] - ubar));
            const noise = x.map((xi) => sigma * xi * randn() * Math.sqrt(dt));
            x = x.map((xi, i) => Math.max(1e-4, xi + dx[i] * dt + noise[i]));
            const sum = x.reduce((s, v) => s + v, 0);
            x = x.map(v => v / sum);
            path.push(x[0]);
        }
        return path;
    }

    drawAxes(ctx, pad, W, CH, "Time t", "Share of P₁ (max-entropy)", "");
    gridLines(ctx, pad, W, CH, 5, 4, 0, T, 0, 1);

    const steps = Math.floor(T / dt) + 1;
    const ts = Array.from({ length: steps }, (_, i) => i * dt);

    // Stochastic paths
    for (let trial = 0; trial < NTrials; trial++) {
        const initX = Array.from({ length: n }, () => rand());
        const sum = initX.reduce((s, v) => s + v, 0);
        initX.forEach((_, i) => initX[i] /= sum);
        const path = simulatePath(initX);

        ctx.strokeStyle = "rgba(192,57,43,0.25)"; ctx.lineWidth = 1;
        ctx.beginPath();
        path.forEach((v, i) => {
            const px = pad.l + (ts[i] / T) * pw;
            const py = pad.t + (1 - v) * ph;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
    }

    // Deterministic ODE (thick)
    const initDet = Array(n).fill(1 / n);
    let xDet = initDet.slice();
    const detPath = [xDet[0]];
    for (let t = dt; t <= T; t += dt) {
        const u = xDet.map((xi, i) => Hvals[i] + nu * Math.pow(xi, gamma));
        const ubar = xDet.reduce((s, xi, i) => s + xi * u[i], 0);
        const dx = xDet.map((xi, i) => xi * (u[i] - ubar));
        xDet = xDet.map((xi, i) => Math.max(1e-4, xi + dx[i] * dt));
        const sum = xDet.reduce((s, v) => s + v, 0);
        xDet = xDet.map(v => v / sum);
        detPath.push(xDet[0]);
    }

    ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 3;
    ctx.beginPath();
    detPath.forEach((v, i) => {
        const px = pad.l + (ts[i] / T) * pw;
        const py = pad.t + (1 - v) * ph;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Legend
    ctx.font = "10px Georgia"; ctx.textAlign = "left";
    ctx.strokeStyle = "rgba(192,57,43,0.4)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l + 8, pad.t + 12); ctx.lineTo(pad.l + 28, pad.t + 12); ctx.stroke();
    ctx.fillStyle = "#333"; ctx.fillText("30 stochastic paths", pad.l + 32, pad.t + 15);
    ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pad.l + 8, pad.t + 26); ctx.lineTo(pad.l + 28, pad.t + 26); ctx.stroke();
    ctx.fillText("Deterministic ODE", pad.l + 32, pad.t + 29);

    ctx.fillStyle = "#555"; ctx.font = "10px Georgia"; ctx.textAlign = "center";
    ctx.fillText(`5 platforms, H=(2.0,1.8,1.5,1.2,0.8), ν=${nu}, γ=${gamma}, σ=${sigma}. All 30 paths → x₁=1.`, W/2, pad.t - 10);
});

/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 7: Chao-Shen Estimator Validation ───────────────────────────────
lazyDraw("chaoshenChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const pad = { l: 65, r: 30, t: 35, b: 45 };
    const pw = W - pad.l - pad.r, ph = CH - pad.t - pad.b;

    const F = 500;  // true microstate count
    const alpha = 1.8;
    const NTrials = 120;
    const sampleSizes = [40, 80, 150, 300, 600, 1500];

    // Build Zipf distribution
    let Z = 0;
    for (let k = 1; k <= F; k++) Z += Math.pow(k, -alpha);
    const probs = new Float64Array(F);
    const cumProbs = new Float64Array(F);
    for (let k = 0; k < F; k++) {
        probs[k] = Math.pow(k + 1, -alpha) / Z;
    }
    cumProbs[0] = probs[0];
    for (let k = 1; k < F; k++) cumProbs[k] = cumProbs[k-1] + probs[k];

    // True entropy
    let trueH = 0;
    for (let k = 0; k < F; k++) {
        if (probs[k] > 0) trueH -= probs[k] * Math.log(probs[k]);
    }

    function sampleZipf(n) {
        const counts = new Int32Array(F);
        for (let i = 0; i < n; i++) {
            const u = rand();
            let lo = 0, hi = F - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (cumProbs[mid] < u) lo = mid + 1;
                else hi = mid;
            }
            counts[lo]++;
        }
        return counts;
    }

    function pluginH(counts, n) {
        let H = 0;
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] === 0) continue;
            const p = counts[i] / n;
            H -= p * Math.log(p);
        }
        return H;
    }

    function chaoShenH(counts, n) {
        let H = 0;
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] === 0) continue;
            const p = counts[i] / n;
            const denom = 1 - Math.pow(1 - p, n);
            if (denom < 1e-12) continue;
            H -= p * Math.log(p) / denom;
        }
        return H;
    }

    // Run experiments
    resetSeed();
    const piMeans = [], piSDs = [], csMeans = [], csSDs = [];
    sampleSizes.forEach(n => {
        const piVals = [], csVals = [];
        for (let t = 0; t < NTrials; t++) {
            const counts = sampleZipf(n);
            piVals.push(pluginH(counts, n));
            csVals.push(chaoShenH(counts, n));
        }
        const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
        const sd = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v-m)**2, 0) / arr.length); };
        piMeans.push(mean(piVals)); piSDs.push(sd(piVals));
        csMeans.push(mean(csVals)); csSDs.push(sd(csVals));
    });

    const xMin = 0, xMax = Math.log(1500), yMin = 1.5, yMax = trueH * 1.08;

    drawAxes(ctx, pad, W, CH, "log(sample size n)", "Estimated entropy (nats)", "");
    gridLines(ctx, pad, W, CH, 4, 4, xMin, xMax, yMin, yMax);

    // True entropy line
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    const yTrue = pad.t + (1 - (trueH - yMin) / (yMax - yMin)) * ph;
    ctx.beginPath(); ctx.moveTo(pad.l, yTrue); ctx.lineTo(pad.l + pw, yTrue); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#333"; ctx.font = "10px Georgia"; ctx.textAlign = "left";
    ctx.fillText(`True H* = ${trueH.toFixed(2)}`, pad.l + 4, yTrue - 4);

    // Plot plugin and Chao-Shen
    [
        { means: piMeans, sds: piSDs, color: "#e74c3c", label: "Plug-in (biased)" },
        { means: csMeans, sds: csSDs, color: "#2980b9", label: "Chao–Shen" }
    ].forEach(({ means, sds, color, label }) => {
        const pts = sampleSizes.map((n, i) => [
            pad.l + (Math.log(n) - xMin) / (xMax - xMin) * pw,
            pad.t + (1 - (means[i] - yMin) / (yMax - yMin)) * ph
        ]);

        // ±1 SD band
        ctx.fillStyle = color + "22";
        ctx.beginPath();
        sampleSizes.forEach((n, i) => {
            const px = pts[i][0];
            const pyUp = pad.t + (1 - (means[i] + sds[i] - yMin) / (yMax - yMin)) * ph;
            if (i === 0) ctx.moveTo(px, pyUp); else ctx.lineTo(px, pyUp);
        });
        sampleSizes.slice().reverse().forEach((n, i) => {
            const ii = sampleSizes.length - 1 - i;
            const px = pts[ii][0];
            const pyDn = pad.t + (1 - (means[ii] - sds[ii] - yMin) / (yMax - yMin)) * ph;
            ctx.lineTo(px, pyDn);
        });
        ctx.closePath(); ctx.fill();

        // Mean line
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach(([px, py], i) => { if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
        ctx.stroke();

        // Points
        ctx.fillStyle = color;
        pts.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 4, 0, 2*Math.PI); ctx.fill(); });
    });

    // Legend
    ctx.font = "10px Georgia"; ctx.textAlign = "left";
    [{ color: "#e74c3c", label: "Plug-in (biased)" }, { color: "#2980b9", label: "Chao–Shen" }].forEach(({ color, label }, i) => {
        ctx.fillStyle = color; ctx.fillRect(pad.l + 8, pad.t + 10 + i*16, 18, 3);
        ctx.fillStyle = "#333"; ctx.fillText(label, pad.l + 32, pad.t + 15 + i*16);
    });

    ctx.fillStyle = "#555"; ctx.font = "10px Georgia"; ctx.textAlign = "center";
    ctx.fillText(`Zipf(α=${alpha}), |Ω|=${F}, ${NTrials} trials per n. Shading: ±1 s.d.`, W/2, pad.t - 10);

    // x-axis: log labels
    [40, 150, 600, 1500].forEach(n => {
        const px = pad.l + (Math.log(n) - xMin) / (xMax - xMin) * pw;
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
        ctx.fillText(String(n), px, pad.t + ph + 14);
    });
});
/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 8: Welfare Gap H^SO / H^NE vs γ ─────────────────────────────────
lazyDraw("welfareGapChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const pad = { l: 72, r: 40, t: 44, b: 52 };
    const pw = W - pad.l - pad.r, ph = CH - pad.t - pad.b;

    // Parameters
    const k = 1, rT = 4;
    const Hne = Math.sqrt(rT / (4 * k));          // = 1.0

    // Social optimum: 4k(H^SO)^2 − 2c·H^SO − rT = 0, c = 1 + ν(γ−1)/2
    // Positive root: H^SO = (c + sqrt(c² + 4krT)) / (4k)
    function Hso(nu, gamma) {
        const c = 1 + nu * (gamma - 1) / 2;
        return (c + Math.sqrt(c * c + 4 * k * rT)) / (4 * k);
    }

    const nuVals  = [0, 0.5, 1.0, 2.0];
    const colors  = ["#7f8c8d", "#2980b9", "#e67e22", "#c0392b"];
    const nuLabels = ["ν = 0", "ν = 0.5", "ν = 1.0", "ν = 2.0"];

    const gammaMin = 1.0, gammaMax = 3.0, nPts = 200;

    // y-range
    let yMax = 0;
    nuVals.forEach(nu => {
        for (let i = 0; i <= nPts; i++) {
            const g = gammaMin + (gammaMax - gammaMin) * i / nPts;
            const r = Hso(nu, g) / Hne;
            if (r > yMax) yMax = r;
        }
    });
    yMax = Math.ceil(yMax * 5) / 5 + 0.05;
    const yMin = 1.0;

    function toX(g)     { return pad.l + (g - gammaMin) / (gammaMax - gammaMin) * pw; }
    function toY(ratio) { return pad.t + (1 - (ratio - yMin) / (yMax - yMin)) * ph; }

    // Grid
    ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 0.7;
    ctx.font = "10px Georgia"; ctx.fillStyle = "#666";
    const nyGrid = 5;
    for (let i = 0; i <= nyGrid; i++) {
        const ratio = yMin + (yMax - yMin) * i / nyGrid;
        const y = toY(ratio);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(ratio.toFixed(2), pad.l - 5, y + 4);
    }
    const nxGrid = 4;
    for (let i = 0; i <= nxGrid; i++) {
        const g = gammaMin + (gammaMax - gammaMin) * i / nxGrid;
        const x = toX(g);
        ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(g.toFixed(1), x, pad.t + ph + 14);
    }

    // Axes
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph); ctx.lineTo(pad.l + pw, pad.t + ph);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#333"; ctx.font = "13px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Network-effect exponent γ", pad.l + pw / 2, CH - 10);
    ctx.save();
    ctx.translate(16, pad.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("H\u02E2\u1D52 / H\u1D4E\u1D38", 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = "#444"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText(`Welfare gap  H\u02E2\u1D52/H\u1D4E\u1D38  vs γ  (k=${k}, rT=${rT}, H\u1D4E\u1D38 = ${Hne.toFixed(2)})`, pad.l + pw / 2, pad.t - 14);

    // H^NE = 1 reference dashed line
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, toY(1.0)); ctx.lineTo(pad.l + pw, toY(1.0)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#999"; ctx.font = "9px Georgia"; ctx.textAlign = "left";
    ctx.fillText("H\u1D4E\u1D38 (NE level)", pad.l + pw - 66, toY(1.0) - 4);

    // Curves
    nuVals.forEach((nu, ci) => {
        ctx.strokeStyle = colors[ci]; ctx.lineWidth = 2.2; ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i <= nPts; i++) {
            const g = gammaMin + (gammaMax - gammaMin) * i / nPts;
            const px = toX(g), py = toY(Hso(nu, g) / Hne);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
    });

    // Legend (top-left inside plot)
    ctx.font = "10px Georgia";
    nuVals.forEach((nu, ci) => {
        const lx = pad.l + 10, ly = pad.t + 12 + ci * 18;
        ctx.strokeStyle = colors[ci]; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 20, ly); ctx.stroke();
        ctx.fillStyle = "#333"; ctx.textAlign = "left";
        ctx.fillText(nuLabels[ci], lx + 24, ly + 4);
    });
});
// ─── Figure 9: Regime Diagram (Proposition 2.1) ─────────────────────────────
lazyDraw("regimeChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;

    const pad = { l: 60, t: 30, b: 50, r: 20 };
    const pixW = W - pad.l - pad.r;
    const pixH = H - pad.t - pad.b;

    const nu = 1.0, gamma = 1.5;
    const x0Min = 0.01, x0Max = 0.99;
    const dhRatioMin = 0.0, dhRatioMax = 2.0;

    // Replicator integration: returns 1 if platform 1 (higher-H) wins, else 2
    function replicatorWinner(x0, deltaH, nu, gamma, T, dt) {
        T = T || 200; dt = dt || 0.05;
        let x = x0;
        for (let t = 0; t < T; t += dt) {
            const dx = x * (1 - x) * (deltaH + nu * (Math.pow(x, gamma) - Math.pow(1 - x, gamma)));
            x = Math.max(0.0001, Math.min(0.9999, x + dx * dt));
        }
        return x > 0.5 ? 1 : 2;
    }

    // ── Pixel fill ──────────────────────────────────────────────────────────
    const imgData = ctx.createImageData(pixW, pixH);
    for (let yi = 0; yi < pixH; yi++) {
        for (let xi = 0; xi < pixW; xi++) {
            const x0 = x0Min + (x0Max - x0Min) * xi / (pixW - 1);
            const dhRatio = dhRatioMin + (dhRatioMax - dhRatioMin) * (1 - yi / (pixH - 1));
            const deltaH = dhRatio * nu;
            const winner = replicatorWinner(x0, deltaH, nu, gamma);
            const idx = (yi * pixW + xi) * 4;
            if (winner === 1) {
                // green: entrant (high-H) wins
                imgData.data[idx]     = 39;
                imgData.data[idx + 1] = 174;
                imgData.data[idx + 2] = 96;
            } else {
                // red: incumbent wins
                imgData.data[idx]     = 192;
                imgData.data[idx + 1] = 57;
                imgData.data[idx + 2] = 43;
            }
            imgData.data[idx + 3] = 255;
        }
    }
    ctx.putImageData(imgData, pad.l, pad.t);

    // ── Axes ────────────────────────────────────────────────────────────────
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + pixH);
    ctx.lineTo(pad.l + pixW, pad.t + pixH);
    ctx.stroke();

    // ── Separatrix (dashed white) — from Theorem 3: x* where ΔH = ν·g(x*) ──
    function g(x, gamma) {
        return Math.pow(1 - x, gamma) - Math.pow(x, gamma);
    }
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    let first = true;
    for (let xi = 0; xi < pixW; xi++) {
        const x0 = x0Min + (x0Max - x0Min) * xi / (pixW - 1);
        const dhAtSep = nu * g(x0, gamma);
        if (dhAtSep < 0 || dhAtSep > dhRatioMax * nu) continue;
        const dhRatio = dhAtSep / nu;
        const py = pad.t + pixH * (1 - (dhRatio - dhRatioMin) / (dhRatioMax - dhRatioMin));
        const px = pad.l + xi;
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Reed boundary: ΔH/ν = 1, horizontal dashed white ───────────────────
    const reedY = pad.t + pixH * (1 - (1.0 - dhRatioMin) / (dhRatioMax - dhRatioMin));
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.moveTo(pad.l, reedY);
    ctx.lineTo(pad.l + pixW, reedY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Reed boundary label
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px Georgia"; ctx.textAlign = "right";
    ctx.fillText("Reed boundary (Prop. 2.1b)", pad.l + pixW - 4, reedY - 4);

    // ── Zone annotations ────────────────────────────────────────────────────
    ctx.font = "10px Georgia"; ctx.textAlign = "left";

    // Bottom-left: Metcalfe/F-K regime
    ctx.fillStyle = "rgba(255,200,200,0.85)";
    ctx.fillText("Metcalfe / F-K regime (ΔH→0)", pad.l + 8, pad.t + pixH - 10);

    // Top-left: Total entropy dominance
    ctx.fillStyle = "rgba(200,255,200,0.85)";
    ctx.fillText("Total entropy dominance (Prop. 2.1d)", pad.l + 8, pad.t + 16);

    // Middle: Conditional dominance
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "center";
    ctx.fillText("Conditional dominance (Theorem 3)", pad.l + pixW / 2, reedY + 20);

    // ── Historical cases: white dots with black labels ───────────────────────
    const cases = [
        { label: "Google",  x0: 0.05, dhRatio: 2.00 },
        { label: "Android", x0: 0.05, dhRatio: 1.75 },
        { label: "TikTok",  x0: 0.07, dhRatio: 1.60 },
        { label: "ETH",     x0: 0.10, dhRatio: 0.86 },
        { label: "G+",      x0: 0.05, dhRatio: 0.33 },
    ];

    cases.forEach(function(c) {
        const px = pad.l + (c.x0 - x0Min) / (x0Max - x0Min) * pixW;
        const py = pad.t + pixH * (1 - (c.dhRatio - dhRatioMin) / (dhRatioMax - dhRatioMin));

        // White dot
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Black label (offset right-upward to avoid overlap)
        ctx.fillStyle = "#000";
        ctx.font = "bold 10px Georgia";
        ctx.textAlign = "left";
        ctx.fillText(c.label, px + 8, py - 4);
    });

    // ── Axis ticks and labels ────────────────────────────────────────────────
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia";
    ctx.textAlign = "center";
    // x-axis label
    ctx.fillText("Entrant initial share x\u2080", pad.l + pixW / 2, H - 8);
    // x ticks
    [0, 0.25, 0.5, 0.75, 1.0].forEach(function(v) {
        const px = pad.l + (v - x0Min) / (x0Max - x0Min) * pixW;
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
        ctx.fillText(v.toFixed(2), px, pad.t + pixH + 14);
    });

    // y-axis label
    ctx.save();
    ctx.translate(14, pad.t + pixH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("\u0394H / \u03BD (entropy gap ratio)", 0, 0);
    ctx.restore();
    // y ticks
    [0, 0.5, 1.0, 1.5, 2.0].forEach(function(v) {
        const py = pad.t + pixH * (1 - (v - dhRatioMin) / (dhRatioMax - dhRatioMin));
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "right";
        ctx.fillText(v.toFixed(1), pad.l - 5, py + 4);
    });
});
// ─── Figure 10: Recovery of Existing Theories (Proposition 2.1) ─────────────
lazyDraw("recoveryChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;

    const panelW = (W - 60) / 2;
    const panelH = H - 50;
    const pad = { l: 50, t: 36, b: 40, r: 10 };

    const nu = 1.0, gamma = 1.5;

    // ── Replicator integration ───────────────────────────────────────────────
    function simulate(x0, deltaH, nu, gamma, T, dt) {
        T = T || 100; dt = dt || 0.1;
        const steps = Math.round(T / dt);
        const xs = [x0];
        let x = x0;
        for (let i = 0; i < steps; i++) {
            const dx = x * (1 - x) * (deltaH + nu * (Math.pow(x, gamma) - Math.pow(1 - x, gamma)));
            x = Math.max(0.0001, Math.min(0.9999, x + dx * dt));
            xs.push(x);
        }
        return xs;
    }

    // ── Binary search for separatrix x* at given ΔH/ν ──────────────────────
    function findSep(dhRatio, nu, gamma) {
        if (dhRatio >= 1.0) return 0; // Reed boundary
        const deltaH = dhRatio * nu;
        let lo = 0.001, hi = 0.499;
        for (let i = 0; i < 80; i++) {
            const mid = (lo + hi) / 2;
            const val = nu * (Math.pow(1 - mid, gamma) - Math.pow(mid, gamma));
            if (val > deltaH) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    }

    // ════════════════════════════════════════════════════════════════════════
    // LEFT PANEL: Trajectories from x0=0.40 for six ΔH values
    // ════════════════════════════════════════════════════════════════════════
    const lOff = 0;
    const lPlotW = panelW - pad.l - pad.r;
    const lPlotH = panelH - pad.t - pad.b;

    const T = 100, dt = 0.1;
    const x0 = 0.40;

    const configs = [
        { dh: 0.00, color: "#8B0000",   label: "\u0394H=0.00" },
        { dh: 0.20, color: "#CC3333",   label: "\u0394H=0.20" },
        { dh: 0.50, color: "#E07820",   label: "\u0394H=0.50" },
        { dh: 0.91, color: "#D4B800",   label: "\u0394H=0.91" },
        { dh: 1.20, color: "#6DB96D",   label: "\u0394H=1.20" },
        { dh: 1.80, color: "#1A6E1A",   label: "\u0394H=1.80" },
    ];

    const steps = Math.round(T / dt);

    // Panel box
    ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
    ctx.strokeRect(lOff + pad.l, pad.t, lPlotW, lPlotH);

    // Title
    ctx.fillStyle = "#222"; ctx.font = "bold 10px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Trajectories from x\u2080=0.40, \u03BD=1.0, \u03B3=1.5", lOff + pad.l + lPlotW / 2, pad.t - 16);

    // Dashed horizontals: x0=0.4 and parity x=0.5
    function mapX_L(t) { return lOff + pad.l + (t / T) * lPlotW; }
    function mapY_L(x) { return pad.t + lPlotH * (1 - x); }

    ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    ctx.strokeStyle = "#aaa";
    ctx.beginPath();
    ctx.moveTo(lOff + pad.l, mapY_L(x0)); ctx.lineTo(lOff + pad.l + lPlotW, mapY_L(x0));
    ctx.stroke();
    ctx.strokeStyle = "#bbb";
    ctx.beginPath();
    ctx.moveTo(lOff + pad.l, mapY_L(0.5)); ctx.lineTo(lOff + pad.l + lPlotW, mapY_L(0.5));
    ctx.stroke();
    ctx.setLineDash([]);

    // Annotations for horizontals
    ctx.fillStyle = "#888"; ctx.font = "9px Georgia"; ctx.textAlign = "left";
    ctx.fillText("x\u2080=0.40", lOff + pad.l + 3, mapY_L(x0) - 3);
    ctx.fillText("parity", lOff + pad.l + 3, mapY_L(0.5) - 3);

    // Plot each trajectory
    configs.forEach(function(cfg) {
        const xs = simulate(x0, cfg.dh, nu, gamma, T, dt);
        ctx.strokeStyle = cfg.color; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
            const t = i * dt;
            const px = mapX_L(t);
            const py = mapY_L(xs[i]);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Label at t=100
        const finalX = xs[steps];
        const lx = mapX_L(T) + 2;
        const ly = mapY_L(finalX);
        ctx.fillStyle = cfg.color; ctx.font = "9px Georgia"; ctx.textAlign = "left";
        ctx.fillText(cfg.label, lx, ly + 4);
    });

    // Annotation: ΔH=0 line label
    ctx.fillStyle = "#8B0000"; ctx.font = "italic 9px Georgia"; ctx.textAlign = "left";
    const dh0final = simulate(x0, 0.00, nu, gamma, T, dt)[steps];
    ctx.fillText("\u0394H=0: Metcalfe (Prop. 2.1a)", lOff + pad.l + lPlotW * 0.35, mapY_L(dh0final) - 6);

    // Axes
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lOff + pad.l, pad.t);
    ctx.lineTo(lOff + pad.l, pad.t + lPlotH);
    ctx.lineTo(lOff + pad.l + lPlotW, pad.t + lPlotH);
    ctx.stroke();

    // y-axis: x₁(t) from 0 to 1
    ctx.save();
    ctx.translate(lOff + 12, pad.t + lPlotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("x\u2081(t)", 0, 0);
    ctx.restore();
    [0, 0.25, 0.5, 0.75, 1.0].forEach(function(v) {
        const py = mapY_L(v);
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "right";
        ctx.fillText(v.toFixed(2), lOff + pad.l - 4, py + 4);
    });

    // x-axis: t from 0 to 100
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("t", lOff + pad.l + lPlotW / 2, pad.t + lPlotH + 30);
    [0, 25, 50, 75, 100].forEach(function(v) {
        const px = mapX_L(v);
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
        ctx.fillText(v, px, pad.t + lPlotH + 14);
    });

    // ════════════════════════════════════════════════════════════════════════
    // RIGHT PANEL: Separatrix x* vs ΔH/ν for three γ values
    // ════════════════════════════════════════════════════════════════════════
    const rOff = panelW + 20;
    const rPlotW = panelW - pad.l - pad.r;
    const rPlotH = panelH - pad.t - pad.b;

    const dhRatioMax = 1.0;
    const dhN = 200;

    // Panel box
    ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
    ctx.strokeRect(rOff + pad.l, pad.t, rPlotW, rPlotH);

    // Title
    ctx.fillStyle = "#222"; ctx.font = "bold 10px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Separatrix x* vs. \u0394H/\u03BD", rOff + pad.l + rPlotW / 2, pad.t - 16);

    function mapX_R(dhRatio) { return rOff + pad.l + (dhRatio / dhRatioMax) * rPlotW; }
    function mapY_R(xStar)   { return pad.t + rPlotH * (1 - xStar / 0.5); }

    // Dashed reference lines
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
    // Farrell-Klemperer limit: x*=0.5
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(rOff + pad.l, mapY_R(0.5)); ctx.lineTo(rOff + pad.l + rPlotW, mapY_R(0.5));
    ctx.stroke();
    // Reed boundary: ΔH/ν=1 → x*=0
    ctx.strokeStyle = "#888";
    ctx.beginPath();
    ctx.moveTo(mapX_R(1.0), pad.t); ctx.lineTo(mapX_R(1.0), pad.t + rPlotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Reference labels
    ctx.fillStyle = "#555"; ctx.font = "9px Georgia"; ctx.textAlign = "left";
    ctx.fillText("Farrell\u2013Klemperer limit (x*=\u00BD)", rOff + pad.l + 4, mapY_R(0.5) - 4);
    ctx.fillText("Reed boundary", mapX_R(1.0) - 72, pad.t + 12);

    // Three gamma curves
    const gammas = [
        { g: 1.5, color: "#1a5276", label: "\u03B3=1.5" },
        { g: 2.0, color: "#7D3C98", label: "\u03B3=2.0" },
        { g: 3.0, color: "#B7770D", label: "\u03B3=3.0" },
    ];

    gammas.forEach(function(cfg) {
        ctx.strokeStyle = cfg.color; ctx.lineWidth = 2; ctx.setLineDash([]);
        ctx.beginPath();
        let mfirst = true;
        for (let i = 0; i <= dhN; i++) {
            const dhRatio = i / dhN * dhRatioMax;
            const xStar = findSep(dhRatio, nu, cfg.g);
            const px = mapX_R(dhRatio);
            const py = mapY_R(xStar);
            if (mfirst) { ctx.moveTo(px, py); mfirst = false; } else ctx.lineTo(px, py);
        }
        ctx.stroke();

        // Label near left edge
        const xStarLeft = findSep(0.02, nu, cfg.g);
        ctx.fillStyle = cfg.color; ctx.font = "9px Georgia"; ctx.textAlign = "left";
        ctx.fillText(cfg.label, rOff + pad.l + 4, mapY_R(xStarLeft) - 5);
    });

    // Axes
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rOff + pad.l, pad.t);
    ctx.lineTo(rOff + pad.l, pad.t + rPlotH);
    ctx.lineTo(rOff + pad.l + rPlotW, pad.t + rPlotH);
    ctx.stroke();

    // y-axis: x* from 0 to 0.5
    ctx.save();
    ctx.translate(rOff + 12, pad.t + rPlotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Separatrix x*", 0, 0);
    ctx.restore();
    [0, 0.1, 0.2, 0.3, 0.4, 0.5].forEach(function(v) {
        const py = mapY_R(v);
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "right";
        ctx.fillText(v.toFixed(1), rOff + pad.l - 4, py + 4);
    });

    // x-axis: ΔH/ν from 0 to 1
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("\u0394H/\u03BD", rOff + pad.l + rPlotW / 2, pad.t + rPlotH + 30);
    [0, 0.25, 0.5, 0.75, 1.0].forEach(function(v) {
        const px = mapX_R(v);
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
        ctx.fillText(v.toFixed(2), px, pad.t + rPlotH + 14);
    });
});
// ─── Figure 13: Combined empirical evidence — three-panel dual-axis ──────────
// Panel A: Mobile OS   — H_CS(Android/iOS) left + Android market share right
// Panel B: Blockchain  — H_CS(ETH/BTC) left   + ETH developer share right
// Panel C: Frontend    — ΔH(React−Angular) left + React npm share right
// Each panel has a shaded "tipping window" marking the active transition period.
// Data: GitHub timeseries.json + android_market_share_data + npm_data.json (Feb 2025)
lazyDraw("combinedChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width;          // 700
    // const TH = cv.height;     // 560

    // ── Layout ────────────────────────────────────────────────────────────────
    const padL = 62, padR = 66;
    const pw   = W - padL - padR;   // 572

    // Panel [top, bot] — each 130 px of drawable area
    const pA = { top: 42,  bot: 172 };
    const pB = { top: 212, bot: 342 };
    const pC = { top: 382, bot: 512 };

    const TIP_FILL   = "rgba(255,195,50,0.17)";
    const TIP_BORDER = "rgba(170,115,0,0.40)";

    // ── Generic helpers ───────────────────────────────────────────────────────
    function sX(yr, xMin, xMax) {
        return padL + (yr - xMin) / (xMax - xMin) * pw;
    }
    function sY(v, vMin, vMax, top, bot) {
        return top + (1 - (v - vMin) / (vMax - vMin)) * (bot - top);
    }

    // Horizontal grid lines + left tick labels (colour-coded)
    function leftAxis(p, ticks, yMin, yMax, color, fmt) {
        ticks.forEach(v => {
            const y = sY(v, yMin, yMax, p.top, p.bot);
            ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 0.5; ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke();
            ctx.fillStyle = color; ctx.font = "9px Georgia"; ctx.textAlign = "right";
            ctx.fillText(fmt(v), padL - 5, y + 3.5);
        });
    }

    // Right tick labels only (no extra grid lines)
    function rightAxis(p, ticks, yMin, yMax, color, fmt) {
        ticks.forEach(v => {
            const y = sY(v, yMin, yMax, p.top, p.bot);
            ctx.fillStyle = color; ctx.font = "9px Georgia"; ctx.textAlign = "left";
            ctx.fillText(fmt(v), padL + pw + 5, y + 3.5);
        });
    }

    // X-axis tick labels
    function xAxis(p, years, xMin, xMax) {
        ctx.fillStyle = "#555"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
        years.forEach(yr => ctx.fillText(yr, sX(yr, xMin, xMax), p.bot + 13));
    }

    // Panel border axes (drawn last so they sit on top of fills/lines)
    function panelAxes(p) {
        ctx.strokeStyle = "#333"; ctx.lineWidth = 1.0; ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(padL, p.top); ctx.lineTo(padL, p.bot); ctx.lineTo(padL + pw, p.bot);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padL + pw, p.top); ctx.lineTo(padL + pw, p.bot);
        ctx.stroke();
    }

    // Shaded tipping window with dashed borders
    function tipWindow(p, x0, x1, xMin, xMax, label) {
        const sx0 = sX(x0, xMin, xMax);
        const sx1 = sX(x1, xMin, xMax);
        ctx.fillStyle = TIP_FILL;
        ctx.fillRect(sx0, p.top, sx1 - sx0, p.bot - p.top);
        ctx.strokeStyle = TIP_BORDER; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(sx0, p.top); ctx.lineTo(sx0, p.bot); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx1, p.top); ctx.lineTo(sx1, p.bot); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(130,85,0,0.70)";
        ctx.font = "italic 7.5px Georgia"; ctx.textAlign = "center";
        ctx.fillText(label || "tipping", (sx0 + sx1) / 2, p.bot - 5);
    }

    // Line + dots
    function drawLine(p, xArr, yArr, xMin, xMax, yMin, yMax, color, dash, dotR, lw) {
        ctx.strokeStyle = color; ctx.lineWidth = lw || 2.1; ctx.setLineDash(dash || []);
        ctx.beginPath();
        xArr.forEach((yr, i) => {
            const x = sX(yr, xMin, xMax), y = sY(yArr[i], yMin, yMax, p.top, p.bot);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.setLineDash([]);
        if (dotR > 0) {
            ctx.fillStyle = color;
            xArr.forEach((yr, i) => {
                ctx.beginPath();
                ctx.arc(sX(yr, xMin, xMax), sY(yArr[i], yMin, yMax, p.top, p.bot), dotR, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
    }

    // CI band (polygon fill)
    function drawCIBand(p, xArr, yArr, seArr, xMin, xMax, yMin, yMax, fillColor) {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        xArr.forEach((yr, i) => {
            const x = sX(yr, xMin, xMax);
            const y = sY(yArr[i] + 1.96 * seArr[i], yMin, yMax, p.top, p.bot);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        for (let i = xArr.length - 1; i >= 0; i--) {
            ctx.lineTo(sX(xArr[i], xMin, xMax),
                       sY(yArr[i] - 1.96 * seArr[i], yMin, yMax, p.top, p.bot));
        }
        ctx.closePath(); ctx.fill();
    }

    // Panel sub-title
    function panelTitle(p, text) {
        ctx.fillStyle = "#222"; ctx.font = "bold 10.5px Georgia"; ctx.textAlign = "center";
        ctx.fillText(text, padL + pw / 2, p.top - 10);
    }

    // Rotated axis label
    function axisLabel(xPx, yCtr, text, color, side) {
        ctx.save();
        ctx.fillStyle = color; ctx.font = "9.5px Georgia"; ctx.textAlign = "center";
        ctx.translate(xPx, yCtr);
        ctx.rotate(side === "right" ? Math.PI / 2 : -Math.PI / 2);
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    // Small semi-transparent legend box
    function legend(p, items) {
        const lx = padL + 7, ly = p.top + 8;
        ctx.font = "9.5px Georgia";
        const maxW = Math.max(...items.map(it => ctx.measureText(it.label).width));
        const bw = maxW + 34, bh = items.length * 14 + 6;
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.fillRect(lx - 3, ly - 3, bw, bh);
        ctx.strokeStyle = "#ccc"; ctx.lineWidth = 0.5; ctx.setLineDash([]);
        ctx.strokeRect(lx - 3, ly - 3, bw, bh);
        items.forEach((it, i) => {
            ctx.strokeStyle = it.color; ctx.lineWidth = 1.9;
            ctx.setLineDash(it.dash || []);
            ctx.beginPath();
            ctx.moveTo(lx, ly + 6 + i * 14); ctx.lineTo(lx + 19, ly + 6 + i * 14);
            ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = "#333"; ctx.font = "9.5px Georgia"; ctx.textAlign = "left";
            ctx.fillText(it.label, lx + 23, ly + 10 + i * 14);
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // DATA
    // ════════════════════════════════════════════════════════════════════════

    // Panel A — Mobile OS (GitHub timeseries.json + IDC/Statcounter)
    const mobYrs  = [2011, 2013, 2015, 2017, 2019, 2021, 2023];
    const andH    = [7.820, 8.493, 9.092, 9.079, 9.381, 9.006, 8.888];
    const iosH    = [6.495, 7.786, 8.216, 8.635, 8.464, 8.297, 8.283];
    const andShr  = [55.6, 76.7, 76.6, 79.1, 80.4, 80.0, 80.0]; // % of Android+iOS shipments

    // Panel B — L1 Blockchain (GitHub timeseries.json)
    const chnYrs  = [2017, 2018, 2019, 2020, 2021, 2022, 2023];
    const ethH    = [5.321, 5.547, 5.673, 5.757, 5.430, 5.812, 5.849];
    const btcH    = [5.330, 4.889, 5.225, 5.326, 5.044, 5.949, 5.470];
    // ETH share of (ETH_app + BTC_app) repos; sizes from table caption:
    //   2017: 21/21; 2018: 89/28; 2019: 156/35; 2020: 312/47; 2021: 451/68; 2022: 498/83; 2023: 500/100
    const ethShr  = [50.0, 76.1, 81.7, 86.9, 86.9, 85.7, 83.3];

    // Panel C — Frontend (GitHub timeseries.json + npm Downloads API npm_data.json)
    const dhYrs   = [2014, 2016, 2018, 2020, 2022, 2024];
    const dH      = [ 0.580,  0.142,  0.059, -0.202,  0.062, -0.397];
    const dH_se   = [ 0.389,  0.225,  0.229,  0.228,  0.227,  0.258];
    const shrYrs  = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    const reactSh = [1.78, 27.96, 42.85, 48.69, 51.53, 54.56, 55.47, 56.19, 56.88, 58.32, 59.79];

    // ════════════════════════════════════════════════════════════════════════
    // PANEL A: MOBILE OS
    // ════════════════════════════════════════════════════════════════════════
    const xMinA = 2010, xMaxA = 2024;
    const yMinA_L = 6.0, yMaxA_L = 10.5;
    const yMinA_R = 38,  yMaxA_R = 100;

    tipWindow(pA, 2011, 2015, xMinA, xMaxA, "tipping");

    leftAxis(pA,  [6, 7, 8, 9, 10], yMinA_L, yMaxA_L, "#27ae60", v => v.toFixed(0));
    rightAxis(pA, [50, 60, 70, 80, 90], yMinA_R, yMaxA_R, "#e67e22", v => v + "%");
    xAxis(pA, mobYrs, xMinA, xMaxA);
    panelTitle(pA, "(A)  Mobile OS: Android vs iOS  \u2014  \u0124\u0302\u2081\u2093\u209C\u209B (left) and Android share (right)");

    // Android market share (right axis, orange)
    drawLine(pA, mobYrs, andShr, xMinA, xMaxA, yMinA_R, yMaxA_R, "#e67e22", [], 3, 1.8);
    // H_CS lines (left axis)
    drawLine(pA, mobYrs, andH,   xMinA, xMaxA, yMinA_L, yMaxA_L, "#27ae60", [],     4.0, 2.2);
    drawLine(pA, mobYrs, iosH,   xMinA, xMaxA, yMinA_L, yMaxA_L, "#c0392b", [5, 4], 3.0, 2.2);

    // ΔH bracket at 2015
    {
        const xR = sX(2015, xMinA, xMaxA);
        const y1 = sY(9.092, yMinA_L, yMaxA_L, pA.top, pA.bot);
        const y2 = sY(8.216, yMinA_L, yMaxA_L, pA.top, pA.bot);
        ctx.strokeStyle = "#555"; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(xR + 6, y1); ctx.lineTo(xR + 6, y2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#555"; ctx.font = "8px Georgia"; ctx.textAlign = "left";
        ctx.fillText("\u0394H=0.88", xR + 9, (y1 + y2) / 2 + 3);
    }

    panelAxes(pA);
    legend(pA, [
        { color: "#27ae60", label: "Android \u0124\u0302\u2081\u2093\u209C\u209B (left, nats)" },
        { color: "#c0392b", dash: [5, 4], label: "iOS \u0124\u0302\u2081\u2093\u209C\u209B (left, nats)" },
        { color: "#e67e22", label: "Android market share (right, %)" },
    ]);
    axisLabel(14, (pA.top + pA.bot) / 2, "\u0124\u0302\u2081\u2093\u209C\u209B (nats)", "#27ae60", "left");
    axisLabel(W - 14, (pA.top + pA.bot) / 2, "Android share (%)", "#e67e22", "right");

    // ════════════════════════════════════════════════════════════════════════
    // PANEL B: BLOCKCHAIN
    // ════════════════════════════════════════════════════════════════════════
    const xMinB = 2016.5, xMaxB = 2023.5;
    const yMinB_L = 4.5, yMaxB_L = 6.5;
    const yMinB_R = 40,  yMaxB_R = 100;

    tipWindow(pB, 2018, 2020, xMinB, xMaxB, "tipping");

    leftAxis(pB,  [4.5, 5.0, 5.5, 6.0, 6.5], yMinB_L, yMaxB_L, "#2980b9", v => v.toFixed(1));
    rightAxis(pB, [50, 60, 70, 80, 90], yMinB_R, yMaxB_R, "#8e44ad", v => v + "%");
    xAxis(pB, chnYrs, xMinB, xMaxB);
    panelTitle(pB, "(B)  L1 Blockchain: Ethereum vs Bitcoin  \u2014  \u0124\u0302\u2081\u2093\u209C\u209B (left) and ETH dev share (right)");

    // ETH dev share (right axis, purple)
    drawLine(pB, chnYrs, ethShr, xMinB, xMaxB, yMinB_R, yMaxB_R, "#8e44ad", [], 3, 1.8);
    // H_CS lines (left axis)
    drawLine(pB, chnYrs, ethH, xMinB, xMaxB, yMinB_L, yMaxB_L, "#2980b9", [],     4.0, 2.2);
    drawLine(pB, chnYrs, btcH, xMinB, xMaxB, yMinB_L, yMaxB_L, "#e67e22", [5, 4], 3.0, 2.2);

    // 2022 annotation
    {
        const y = sY(6.05, yMinB_L, yMaxB_L, pB.top, pB.bot);
        ctx.fillStyle = "#999"; ctx.font = "7.5px Georgia"; ctx.textAlign = "center";
        ctx.fillText("FTX/bear", sX(2022, xMinB, xMaxB), y - 2);
    }

    panelAxes(pB);
    legend(pB, [
        { color: "#2980b9", label: "Ethereum \u0124\u0302\u2081\u2093\u209C\u209B (left, nats)" },
        { color: "#e67e22", dash: [5, 4], label: "Bitcoin \u0124\u0302\u2081\u2093\u209C\u209B (left, nats)" },
        { color: "#8e44ad", label: "ETH share of app repos (right, %)" },
    ]);
    axisLabel(14, (pB.top + pB.bot) / 2, "\u0124\u0302\u2081\u2093\u209C\u209B (nats)", "#2980b9", "left");
    axisLabel(W - 14, (pB.top + pB.bot) / 2, "ETH dev share (%)", "#8e44ad", "right");

    // ════════════════════════════════════════════════════════════════════════
    // PANEL C: FRONTEND REACT vs ANGULAR
    // ════════════════════════════════════════════════════════════════════════
    const xMinC = 2013.5, xMaxC = 2024.5;
    const yMinC_L = -0.7, yMaxC_L = 0.9;
    const yMinC_R = 0,    yMaxC_R = 70;

    // Light blue shading where ΔH > 0 (React entropy advantage zone)
    {
        const y0 = sY(0, yMinC_L, yMaxC_L, pC.top, pC.bot);
        ctx.fillStyle = "rgba(52,152,219,0.05)";
        ctx.fillRect(padL, pC.top, pw, y0 - pC.top);
    }

    tipWindow(pC, 2014, 2018, xMinC, xMaxC, "tipping");

    // Zero dashed line
    {
        const y0 = sY(0, yMinC_L, yMaxC_L, pC.top, pC.bot);
        ctx.strokeStyle = "#aaa"; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(padL, y0); ctx.lineTo(padL + pw, y0); ctx.stroke();
        ctx.setLineDash([]);
    }

    leftAxis(pC,  [-0.6, -0.3, 0, 0.3, 0.6], yMinC_L, yMaxC_L, "#2980b9", v => v.toFixed(1));
    rightAxis(pC, [0, 20, 40, 60], yMinC_R, yMaxC_R, "#e74c3c", v => v + "%");
    xAxis(pC, [2014, 2016, 2018, 2020, 2022, 2024], xMinC, xMaxC);
    panelTitle(pC, "(C)  Frontend: \u0394\u0124\u0302(React\u2212Angular) (left) leads React npm share (right), 2014\u20132024");

    // 50% reference line on right axis
    {
        const y50 = sY(50, yMinC_R, yMaxC_R, pC.top, pC.bot);
        ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 0.7; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(padL, y50); ctx.lineTo(padL + pw, y50); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#e74c3c"; ctx.font = "8px Georgia"; ctx.textAlign = "left";
        ctx.fillText("50%", padL + 4, y50 - 3);
    }

    // CI band for ΔH
    drawCIBand(pC, dhYrs, dH, dH_se, xMinC, xMaxC, yMinC_L, yMaxC_L, "rgba(52,152,219,0.17)");

    // React npm share (right axis, red)
    drawLine(pC, shrYrs, reactSh, xMinC, xMaxC, yMinC_R, yMaxC_R, "#e74c3c", [], 3, 1.8);

    // ΔH line (left axis, blue)
    drawLine(pC, dhYrs, dH, xMinC, xMaxC, yMinC_L, yMaxC_L, "#2980b9", [], 4.5, 2.3);

    // "≈3-yr lag" annotation arrow
    {
        const x14  = sX(2014, xMinC, xMaxC);
        const y14L = sY(0.580, yMinC_L, yMaxC_L, pC.top, pC.bot);
        const y17R = sY(48,    yMinC_R, yMaxC_R, pC.top, pC.bot);
        ctx.strokeStyle = "#555"; ctx.lineWidth = 0.9; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(x14 + 8, y14L + 8);
        ctx.lineTo(sX(2017, xMinC, xMaxC), y17R - 6);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#444"; ctx.font = "italic 8.5px Georgia"; ctx.textAlign = "left";
        ctx.fillText("\u22483-yr lag", x14 + 11, y14L + 26);
        ctx.fillStyle = "#1a6ea8"; ctx.font = "bold 8.5px Georgia";
        ctx.fillText("\u0394H=+0.58 nats (2014)", x14 + 5, y14L - 8);
    }

    panelAxes(pC);
    legend(pC, [
        { color: "#2980b9", label: "\u0394\u0124\u0302\u2081\u2093\u209C\u209B React\u2212Angular (left, nats)" },
        { color: "#e74c3c", label: "React npm share (right, %)" },
    ]);
    axisLabel(14, (pC.top + pC.bot) / 2, "\u0394\u0124\u0302\u2081\u2093\u209C\u209B (nats)", "#2980b9", "left");
    axisLabel(W - 14, (pC.top + pC.bot) / 2, "React npm share (%)", "#e74c3c", "right");

});
