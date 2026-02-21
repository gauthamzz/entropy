/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 5: Convergence Rate ─────────────────────────────────────────────
(function () {
    const cv = document.getElementById("rateChart");
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
})();

