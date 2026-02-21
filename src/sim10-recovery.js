// ─── Figure 10: Recovery of Existing Theories (Proposition 2.1) ─────────────
(function () {
    const cv = document.getElementById("recoveryChart");
    if (!cv) return;
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
})();
