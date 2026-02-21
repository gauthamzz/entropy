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

