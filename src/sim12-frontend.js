// ─── Figure 12: React/Angular ΔH vs npm Download Share ─────────────────────
// Dual-axis chart showing:
//   Left axis  : ΔH(React − Angular) in nats  (GitHub H_CS time series)
//   Right axis : React's npm download share %  (react / react+angular+vue+svelte)
// Data: GitHub timeseries.json + npm Downloads API (npm_data.json, collected Feb 2025)
// Proposition 9.1 visual: entropy advantage at t₀ leads market-share transition.
(function () {
    const cv = document.getElementById("frontendChart");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;

    // ── Data ────────────────────────────────────────────────────────────────
    // ΔH = H_CS(React) − H_CS(Angular), from timeseries.json
    const deltaHYears  = [2014, 2016, 2018, 2020, 2022, 2024];
    const deltaH       = [0.580, 0.142, 0.059, -0.202, 0.062, -0.397];

    // 95% CI half-widths for ΔH  (from bootstrap_ci.json: 1.96*SE quadrature)
    // deltaH_se = sqrt(se_react^2 + se_angular^2) for each year
    const deltaH_se    = [0.389, 0.225, 0.229, 0.228, 0.227, 0.258];

    // npm React download share (react / all 5 packages), from npm_data.json
    const shareYears   = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    const reactShare   = [1.78, 27.96, 42.85, 48.69, 51.53, 54.56, 55.47, 56.19, 56.88, 58.32, 59.79];
    // (values are percentages)

    // ── Layout ───────────────────────────────────────────────────────────────
    const pad = { l: 62, r: 66, t: 42, b: 48 };
    const pw  = W - pad.l - pad.r;
    const ph  = H - pad.t - pad.b;

    const xMin = 2013.5, xMax = 2024.5;
    const yMinL = -0.7, yMaxL = 0.9;   // left axis: ΔH (nats)
    const yMinR = 0,    yMaxR = 70;     // right axis: share (%)

    function tx(yr)   { return pad.l + (yr - xMin) / (xMax - xMin) * pw; }
    function tyL(dh)  { return pad.t + (1 - (dh - yMinL) / (yMaxL - yMinL)) * ph; }
    function tyR(s)   { return pad.t + (1 - (s  - yMinR) / (yMaxR - yMinR)) * ph; }

    // ── Background ───────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);

    // Shade the "React entropy advantage" region (ΔH > 0) lightly
    ctx.fillStyle = "rgba(52,152,219,0.06)";
    ctx.fillRect(pad.l, pad.t, pw, tyL(0) - pad.t);

    // ── Axes ─────────────────────────────────────────────────────────────────
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + ph);
    ctx.lineTo(pad.l + pw, pad.t + ph);
    ctx.stroke();
    // Right axis
    ctx.beginPath();
    ctx.moveTo(pad.l + pw, pad.t); ctx.lineTo(pad.l + pw, pad.t + ph);
    ctx.stroke();

    // Zero line for ΔH
    ctx.strokeStyle = "#aaa"; ctx.lineWidth = 0.8; ctx.setLineDash([4,3]);
    ctx.beginPath();
    ctx.moveTo(pad.l, tyL(0)); ctx.lineTo(pad.l + pw, tyL(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Grid + left y-labels (ΔH) ────────────────────────────────────────────
    ctx.font = "9px Georgia"; ctx.textAlign = "right";
    [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8].forEach(v => {
        const y = tyL(v);
        ctx.strokeStyle = "#ececec"; ctx.lineWidth = 0.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
        ctx.fillStyle = "#3498db";
        ctx.fillText(v.toFixed(1), pad.l - 5, y + 3.5);
    });

    // ── Right y-labels (share %) ──────────────────────────────────────────────
    ctx.textAlign = "left";
    [0, 10, 20, 30, 40, 50, 60, 70].forEach(v => {
        const y = tyR(v);
        ctx.fillStyle = "#e74c3c";
        ctx.fillText(v + "%", pad.l + pw + 6, y + 3.5);
    });

    // ── X-axis labels ─────────────────────────────────────────────────────────
    ctx.textAlign = "center"; ctx.fillStyle = "#555"; ctx.font = "10px Georgia";
    [2014, 2016, 2018, 2020, 2022, 2024].forEach(yr => {
        const x = tx(yr);
        ctx.fillText(yr, x, pad.t + ph + 16);
    });

    // ── Axis titles ───────────────────────────────────────────────────────────
    ctx.fillStyle = "#3498db"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.save();
    ctx.translate(16, pad.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("\u0394H\u0302\u2081\u2093\u209C\u209B (React \u2212 Angular, nats)", 0, 0);
    ctx.restore();

    ctx.fillStyle = "#e74c3c"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.save();
    ctx.translate(W - 14, pad.t + ph / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText("React npm share (% of React+Angular+Vue+Svelte)", 0, 0);
    ctx.restore();

    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Year", pad.l + pw / 2, H - 8);

    // ── npm share line (right axis) ───────────────────────────────────────────
    ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 2.0; ctx.setLineDash([]);
    ctx.beginPath();
    shareYears.forEach((yr, i) => {
        const x = tx(yr), y = tyR(reactShare[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "#e74c3c";
    shareYears.forEach((yr, i) => {
        ctx.beginPath(); ctx.arc(tx(yr), tyR(reactShare[i]), 3, 0, 2 * Math.PI); ctx.fill();
    });

    // 50% reference line
    ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 0.7; ctx.setLineDash([3,3]);
    ctx.beginPath();
    ctx.moveTo(pad.l, tyR(50)); ctx.lineTo(pad.l + pw, tyR(50));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#e74c3c"; ctx.font = "8.5px Georgia"; ctx.textAlign = "left";
    ctx.fillText("50%", pad.l + 3, tyR(50) - 4);

    // ── ΔH line + CI band (left axis) ────────────────────────────────────────
    // CI band first (light fill)
    ctx.fillStyle = "rgba(52,152,219,0.18)";
    ctx.beginPath();
    deltaHYears.forEach((yr, i) => {
        const x = tx(yr), y = tyL(deltaH[i] + 1.96 * deltaH_se[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    for (let i = deltaHYears.length - 1; i >= 0; i--) {
        const x = tx(deltaHYears[i]), y = tyL(deltaH[i] - 1.96 * deltaH_se[i]);
        ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();

    // ΔH line
    ctx.strokeStyle = "#2980b9"; ctx.lineWidth = 2.4; ctx.setLineDash([]);
    ctx.beginPath();
    deltaHYears.forEach((yr, i) => {
        const x = tx(yr), y = tyL(deltaH[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ΔH points
    ctx.fillStyle = "#2980b9";
    deltaHYears.forEach((yr, i) => {
        ctx.beginPath();
        ctx.arc(tx(yr), tyL(deltaH[i]), 4.5, 0, 2 * Math.PI);
        ctx.fill();
    });

    // ── Annotation: entropy surge → share surge ────────────────────────────
    // Arrow from 2014 ΔH peak to 2016/17 share surge zone
    const x14 = tx(2014), y14 = tyL(0.580);
    ctx.strokeStyle = "#555"; ctx.lineWidth = 1.0; ctx.setLineDash([2,2]);
    ctx.beginPath();
    ctx.moveTo(x14 + 8, y14 + 8);
    ctx.lineTo(tx(2017), tyR(48) - 8);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#444"; ctx.font = "italic 9px Georgia"; ctx.textAlign = "left";
    ctx.fillText("\u2248 3-yr lag", tx(2014) + 12, tyL(0.580) + 32);
    ctx.fillText("to 50% share", tx(2014) + 12, tyL(0.580) + 44);

    // 2014 entropy label
    ctx.fillStyle = "#1a6ea8"; ctx.font = "bold 9.5px Georgia"; ctx.textAlign = "left";
    ctx.fillText("\u0394H = +0.58 nats (2014)", x14 + 6, y14 - 8);

    // ── Title ──────────────────────────────────────────────────────────────
    ctx.fillStyle = "#222"; ctx.font = "bold 12px Georgia"; ctx.textAlign = "center";
    ctx.fillText("(A) Entropy gap ΔH(React\u2212Angular) and React npm share, 2014\u20132024",
                 pad.l + pw / 2, pad.t - 18);

    // ── Legend ─────────────────────────────────────────────────────────────
    const lx = pad.l + 12, ly = pad.t + 14;
    ctx.font = "10px Georgia"; ctx.textAlign = "left";
    // ΔH legend
    ctx.strokeStyle = "#2980b9"; ctx.lineWidth = 2.4; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 22, ly); ctx.stroke();
    ctx.fillStyle = "#333"; ctx.fillText("\u0394H\u0302\u2081\u2093\u209C\u209B (left axis, nats)", lx + 26, ly + 4);
    // share legend
    ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 2.0;
    ctx.beginPath(); ctx.moveTo(lx, ly + 17); ctx.lineTo(lx + 22, ly + 17); ctx.stroke();
    ctx.fillStyle = "#333"; ctx.fillText("React npm share (right axis, %)", lx + 26, ly + 21);

})();
