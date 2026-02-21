/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 4: Invasion Dynamics ────────────────────────────────────────────
(function () {
    const cv = document.getElementById("invasionChart");
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
})();

