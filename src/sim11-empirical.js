/* global drawAxes, gridLines */
// ─── Figure 11: Empirical H_CS time series from GitHub data ─────────────────
// Data collected via GitHub Search API (1,000 repos per platform per year,
// stars ≥ 3). Microstate = secondary GitHub topic tag. Estimator: Chao–Shen.
lazyDraw("empiricalChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;

    // Split into two panels
    const leftW = Math.floor(W * 0.5);
    const rightW = W - leftW;

    // ── Panel A: Android vs iOS (2011–2023) ──────────────────────────────────
    const mobileYears = [2011, 2013, 2015, 2017, 2019, 2021, 2023];
    const androidH    = [7.820, 8.493, 9.092, 9.079, 9.381, 9.006, 8.888];
    const iosH        = [6.495, 7.786, 8.216, 8.635, 8.464, 8.297, 8.283];

    // ── Panel B: ETH app-layer vs BTC lightning (2017–2023) ─────────────────
    const chainYears = [2017, 2018, 2019, 2020, 2021, 2022, 2023];
    const ethH       = [5.321, 5.547, 5.673, 5.757, 5.430, 5.812, 5.849];
    const btcH       = [5.330, 4.889, 5.225, 5.326, 5.044, 5.949, 5.470];

    // ── Panel A layout ────────────────────────────────────────────────────────
    const padA = { l: 58, r: 14, t: 36, b: 44 };
    const pwA = leftW - padA.l - padA.r;
    const phA = CH - padA.t - padA.b;

    const xMinA = 2010, xMaxA = 2024;
    const yMinA = 6.0, yMaxA = 10.0;

    function txA(yr) { return padA.l + (yr - xMinA) / (xMaxA - xMinA) * pwA; }
    function tyA(h)  { return padA.t + (1 - (h - yMinA) / (yMaxA - yMinA)) * phA; }

    // axes
    ctx.save();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padA.l, padA.t); ctx.lineTo(padA.l, CH - padA.b);
    ctx.lineTo(padA.l + pwA, CH - padA.b); ctx.stroke();

    // grid + y-labels
    ctx.font = "9px Georgia"; ctx.fillStyle = "#666"; ctx.textAlign = "right";
    [6, 7, 8, 9, 10].forEach(v => {
        const y = tyA(v);
        ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(padA.l, y); ctx.lineTo(padA.l + pwA, y); ctx.stroke();
        ctx.fillStyle = "#666"; ctx.fillText(v.toFixed(0), padA.l - 4, y + 3);
    });
    // x-labels
    ctx.textAlign = "center"; ctx.strokeStyle = "#e8e8e8";
    mobileYears.forEach(yr => {
        const x = txA(yr);
        ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x, padA.t); ctx.lineTo(x, CH - padA.b); ctx.stroke();
        ctx.fillStyle = "#666"; ctx.fillText(yr, x, CH - padA.b + 13);
    });

    // axis labels
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Year", padA.l + pwA / 2, CH - 4);
    ctx.save();
    ctx.translate(13, padA.t + phA / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("H\u0302\u2081\u2093\u209C\u209B (nats)", 0, 0);
    ctx.restore();

    // Panel A title
    ctx.font = "bold 11px Georgia"; ctx.fillStyle = "#222"; ctx.textAlign = "center";
    ctx.fillText("(A) Mobile OS: Android vs iOS", padA.l + pwA / 2, padA.t - 14);

    // Android line
    ctx.strokeStyle = "#27ae60"; ctx.lineWidth = 2.2; ctx.setLineDash([]);
    ctx.beginPath();
    mobileYears.forEach((yr, i) => {
        if (i === 0) ctx.moveTo(txA(yr), tyA(androidH[i]));
        else ctx.lineTo(txA(yr), tyA(androidH[i]));
    });
    ctx.stroke();
    ctx.fillStyle = "#27ae60";
    mobileYears.forEach((yr, i) => {
        ctx.beginPath(); ctx.arc(txA(yr), tyA(androidH[i]), 4, 0, 2*Math.PI); ctx.fill();
    });

    // iOS line
    ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 2.2; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    mobileYears.forEach((yr, i) => {
        if (i === 0) ctx.moveTo(txA(yr), tyA(iosH[i]));
        else ctx.lineTo(txA(yr), tyA(iosH[i]));
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#c0392b";
    mobileYears.forEach((yr, i) => {
        ctx.beginPath(); ctx.arc(txA(yr), tyA(iosH[i]), 4, 0, 2*Math.PI); ctx.fill();
    });

    // ΔH annotation for 2015
    const xRef = txA(2015), y1 = tyA(9.092), y2 = tyA(8.216);
    ctx.strokeStyle = "#555"; ctx.lineWidth = 0.8; ctx.setLineDash([2,2]);
    ctx.beginPath(); ctx.moveTo(xRef + 6, y1); ctx.lineTo(xRef + 6, y2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#555"; ctx.font = "9px Georgia"; ctx.textAlign = "left";
    ctx.fillText("ΔH=0.88", xRef + 9, (y1+y2)/2 + 3);

    // Legend A
    ctx.font = "10px Georgia"; ctx.textAlign = "left";
    [["#27ae60", "Android (global winner, 72% share)"],
     ["#c0392b", "iOS (premium segment, 27% share)"]].forEach(([color, label], i) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(padA.l + 4, padA.t + 10 + i*16);
        ctx.lineTo(padA.l + 22, padA.t + 10 + i*16); ctx.stroke();
        ctx.fillStyle = "#333"; ctx.fillText(label, padA.l + 26, padA.t + 14 + i*16);
    });
    ctx.restore();

    // ── Panel B layout ────────────────────────────────────────────────────────
    ctx.save();
    ctx.translate(leftW, 0);
    const padB = { l: 50, r: 18, t: 36, b: 44 };
    const pwB = rightW - padB.l - padB.r;
    const phB = CH - padB.t - padB.b;

    const xMinB = 2016.5, xMaxB = 2023.5;
    const yMinB = 4.5, yMaxB = 6.5;

    function txB(yr) { return padB.l + (yr - xMinB) / (xMaxB - xMinB) * pwB; }
    function tyB(h)  { return padB.t + (1 - (h - yMinB) / (yMaxB - yMinB)) * phB; }

    // axes
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padB.l, padB.t); ctx.lineTo(padB.l, CH - padB.b);
    ctx.lineTo(padB.l + pwB, CH - padB.b); ctx.stroke();

    // grid
    [4.5, 5.0, 5.5, 6.0, 6.5].forEach(v => {
        const y = tyB(v);
        ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(padB.l, y); ctx.lineTo(padB.l + pwB, y); ctx.stroke();
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "right";
        ctx.fillText(v.toFixed(1), padB.l - 4, y + 3);
    });
    chainYears.forEach(yr => {
        const x = txB(yr);
        ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x, padB.t); ctx.lineTo(x, CH - padB.b); ctx.stroke();
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
        ctx.fillText(yr, x, CH - padB.b + 13);
    });

    // labels
    ctx.fillStyle = "#333"; ctx.font = "11px Georgia"; ctx.textAlign = "center";
    ctx.fillText("Year", padB.l + pwB / 2, CH - 4);
    ctx.save();
    ctx.translate(13, padB.t + phB / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("H\u0302\u2081\u2093\u209C\u209B (nats)", 0, 0);
    ctx.restore();

    ctx.font = "bold 11px Georgia"; ctx.fillStyle = "#222"; ctx.textAlign = "center";
    ctx.fillText("(B) L1 App Layer: Ethereum vs Bitcoin", padB.l + pwB / 2, padB.t - 14);

    // ETH line
    ctx.strokeStyle = "#2980b9"; ctx.lineWidth = 2.2; ctx.setLineDash([]);
    ctx.beginPath();
    chainYears.forEach((yr, i) => {
        if (i === 0) ctx.moveTo(txB(yr), tyB(ethH[i]));
        else ctx.lineTo(txB(yr), tyB(ethH[i]));
    });
    ctx.stroke();
    ctx.fillStyle = "#2980b9";
    chainYears.forEach((yr, i) => {
        ctx.beginPath(); ctx.arc(txB(yr), tyB(ethH[i]), 4, 0, 2*Math.PI); ctx.fill();
    });

    // BTC line
    ctx.strokeStyle = "#e67e22"; ctx.lineWidth = 2.2; ctx.setLineDash([5,4]);
    ctx.beginPath();
    chainYears.forEach((yr, i) => {
        if (i === 0) ctx.moveTo(txB(yr), tyB(btcH[i]));
        else ctx.lineTo(txB(yr), tyB(btcH[i]));
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#e67e22";
    chainYears.forEach((yr, i) => {
        ctx.beginPath(); ctx.arc(txB(yr), tyB(btcH[i]), 4, 0, 2*Math.PI); ctx.fill();
    });

    // annotation: 2022 BTC spike (bear market, Lightning surge)
    const x22 = txB(2022);
    ctx.fillStyle = "#888"; ctx.font = "8.5px Georgia"; ctx.textAlign = "center";
    ctx.fillText("2022: FTX/bear", x22, tyB(6.05));

    // Legend B
    ctx.font = "10px Georgia"; ctx.textAlign = "left";
    [["#2980b9", "Ethereum (smart-contract repos)"],
     ["#e67e22", "Bitcoin (Lightning-network repos)"]].forEach(([color, label], i) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(padB.l + 4, padB.t + 10 + i*16);
        ctx.lineTo(padB.l + 22, padB.t + 10 + i*16); ctx.stroke();
        ctx.fillStyle = "#333"; ctx.fillText(label, padB.l + 26, padB.t + 14 + i*16);
    });
    ctx.restore();

});
