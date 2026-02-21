/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 8: Welfare Gap H^SO / H^NE vs γ ─────────────────────────────────
(function () {
    const cv = document.getElementById("welfareGapChart");
    if (!cv) return;
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
})();
