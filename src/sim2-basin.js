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


