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
