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

