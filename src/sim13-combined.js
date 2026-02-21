// ─── Figure 13: Combined empirical evidence — three-panel dual-axis ──────────
// Panel A: Mobile OS   — H_CS(Android/iOS) left + Android market share right
// Panel B: Blockchain  — H_CS(ETH/BTC) left   + ETH developer share right
// Panel C: Frontend    — ΔH(React−Angular) left + React npm share right
// Each panel has a shaded "tipping window" marking the active transition period.
// Data: GitHub timeseries.json + android_market_share_data + npm_data.json (Feb 2025)
(function () {
    const cv = document.getElementById("combinedChart");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = cv.width;          // 700
    // const TH = cv.height;     // 560

    // ── Layout ────────────────────────────────────────────────────────────────
    const padL = 62, padR = 66;
    const pw   = W - padL - padR;   // 572

    // Panel [top, bot] — each 130 px of drawable area
    const pA = { top: 42,  bot: 172 };
    const pB = { top: 212, bot: 342 };
    const pC = { top: 382, bot: 512 };

    const TIP_FILL   = "rgba(255,195,50,0.17)";
    const TIP_BORDER = "rgba(170,115,0,0.40)";

    // ── Generic helpers ───────────────────────────────────────────────────────
    function sX(yr, xMin, xMax) {
        return padL + (yr - xMin) / (xMax - xMin) * pw;
    }
    function sY(v, vMin, vMax, top, bot) {
        return top + (1 - (v - vMin) / (vMax - vMin)) * (bot - top);
    }

    // Horizontal grid lines + left tick labels (colour-coded)
    function leftAxis(p, ticks, yMin, yMax, color, fmt) {
        ticks.forEach(v => {
            const y = sY(v, yMin, yMax, p.top, p.bot);
            ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 0.5; ctx.setLineDash([]);
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + pw, y); ctx.stroke();
            ctx.fillStyle = color; ctx.font = "9px Georgia"; ctx.textAlign = "right";
            ctx.fillText(fmt(v), padL - 5, y + 3.5);
        });
    }

    // Right tick labels only (no extra grid lines)
    function rightAxis(p, ticks, yMin, yMax, color, fmt) {
        ticks.forEach(v => {
            const y = sY(v, yMin, yMax, p.top, p.bot);
            ctx.fillStyle = color; ctx.font = "9px Georgia"; ctx.textAlign = "left";
            ctx.fillText(fmt(v), padL + pw + 5, y + 3.5);
        });
    }

    // X-axis tick labels
    function xAxis(p, years, xMin, xMax) {
        ctx.fillStyle = "#555"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
        years.forEach(yr => ctx.fillText(yr, sX(yr, xMin, xMax), p.bot + 13));
    }

    // Panel border axes (drawn last so they sit on top of fills/lines)
    function panelAxes(p) {
        ctx.strokeStyle = "#333"; ctx.lineWidth = 1.0; ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(padL, p.top); ctx.lineTo(padL, p.bot); ctx.lineTo(padL + pw, p.bot);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(padL + pw, p.top); ctx.lineTo(padL + pw, p.bot);
        ctx.stroke();
    }

    // Shaded tipping window with dashed borders
    function tipWindow(p, x0, x1, xMin, xMax, label) {
        const sx0 = sX(x0, xMin, xMax);
        const sx1 = sX(x1, xMin, xMax);
        ctx.fillStyle = TIP_FILL;
        ctx.fillRect(sx0, p.top, sx1 - sx0, p.bot - p.top);
        ctx.strokeStyle = TIP_BORDER; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(sx0, p.top); ctx.lineTo(sx0, p.bot); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx1, p.top); ctx.lineTo(sx1, p.bot); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(130,85,0,0.70)";
        ctx.font = "italic 7.5px Georgia"; ctx.textAlign = "center";
        ctx.fillText(label || "tipping", (sx0 + sx1) / 2, p.bot - 5);
    }

    // Line + dots
    function drawLine(p, xArr, yArr, xMin, xMax, yMin, yMax, color, dash, dotR, lw) {
        ctx.strokeStyle = color; ctx.lineWidth = lw || 2.1; ctx.setLineDash(dash || []);
        ctx.beginPath();
        xArr.forEach((yr, i) => {
            const x = sX(yr, xMin, xMax), y = sY(yArr[i], yMin, yMax, p.top, p.bot);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.setLineDash([]);
        if (dotR > 0) {
            ctx.fillStyle = color;
            xArr.forEach((yr, i) => {
                ctx.beginPath();
                ctx.arc(sX(yr, xMin, xMax), sY(yArr[i], yMin, yMax, p.top, p.bot), dotR, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
    }

    // CI band (polygon fill)
    function drawCIBand(p, xArr, yArr, seArr, xMin, xMax, yMin, yMax, fillColor) {
        ctx.fillStyle = fillColor;
        ctx.beginPath();
        xArr.forEach((yr, i) => {
            const x = sX(yr, xMin, xMax);
            const y = sY(yArr[i] + 1.96 * seArr[i], yMin, yMax, p.top, p.bot);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        for (let i = xArr.length - 1; i >= 0; i--) {
            ctx.lineTo(sX(xArr[i], xMin, xMax),
                       sY(yArr[i] - 1.96 * seArr[i], yMin, yMax, p.top, p.bot));
        }
        ctx.closePath(); ctx.fill();
    }

    // Panel sub-title
    function panelTitle(p, text) {
        ctx.fillStyle = "#222"; ctx.font = "bold 10.5px Georgia"; ctx.textAlign = "center";
        ctx.fillText(text, padL + pw / 2, p.top - 10);
    }

    // Rotated axis label
    function axisLabel(xPx, yCtr, text, color, side) {
        ctx.save();
        ctx.fillStyle = color; ctx.font = "9.5px Georgia"; ctx.textAlign = "center";
        ctx.translate(xPx, yCtr);
        ctx.rotate(side === "right" ? Math.PI / 2 : -Math.PI / 2);
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    // Small semi-transparent legend box
    function legend(p, items) {
        const lx = padL + 7, ly = p.top + 8;
        ctx.font = "9.5px Georgia";
        const maxW = Math.max(...items.map(it => ctx.measureText(it.label).width));
        const bw = maxW + 34, bh = items.length * 14 + 6;
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.fillRect(lx - 3, ly - 3, bw, bh);
        ctx.strokeStyle = "#ccc"; ctx.lineWidth = 0.5; ctx.setLineDash([]);
        ctx.strokeRect(lx - 3, ly - 3, bw, bh);
        items.forEach((it, i) => {
            ctx.strokeStyle = it.color; ctx.lineWidth = 1.9;
            ctx.setLineDash(it.dash || []);
            ctx.beginPath();
            ctx.moveTo(lx, ly + 6 + i * 14); ctx.lineTo(lx + 19, ly + 6 + i * 14);
            ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = "#333"; ctx.font = "9.5px Georgia"; ctx.textAlign = "left";
            ctx.fillText(it.label, lx + 23, ly + 10 + i * 14);
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // DATA
    // ════════════════════════════════════════════════════════════════════════

    // Panel A — Mobile OS (GitHub timeseries.json + IDC/Statcounter)
    const mobYrs  = [2011, 2013, 2015, 2017, 2019, 2021, 2023];
    const andH    = [7.820, 8.493, 9.092, 9.079, 9.381, 9.006, 8.888];
    const iosH    = [6.495, 7.786, 8.216, 8.635, 8.464, 8.297, 8.283];
    const andShr  = [55.6, 76.7, 76.6, 79.1, 80.4, 80.0, 80.0]; // % of Android+iOS shipments

    // Panel B — L1 Blockchain (GitHub timeseries.json)
    const chnYrs  = [2017, 2018, 2019, 2020, 2021, 2022, 2023];
    const ethH    = [5.321, 5.547, 5.673, 5.757, 5.430, 5.812, 5.849];
    const btcH    = [5.330, 4.889, 5.225, 5.326, 5.044, 5.949, 5.470];
    // ETH share of (ETH_app + BTC_app) repos; sizes from table caption:
    //   2017: 21/21; 2018: 89/28; 2019: 156/35; 2020: 312/47; 2021: 451/68; 2022: 498/83; 2023: 500/100
    const ethShr  = [50.0, 76.1, 81.7, 86.9, 86.9, 85.7, 83.3];

    // Panel C — Frontend (GitHub timeseries.json + npm Downloads API npm_data.json)
    const dhYrs   = [2014, 2016, 2018, 2020, 2022, 2024];
    const dH      = [ 0.580,  0.142,  0.059, -0.202,  0.062, -0.397];
    const dH_se   = [ 0.389,  0.225,  0.229,  0.228,  0.227,  0.258];
    const shrYrs  = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    const reactSh = [1.78, 27.96, 42.85, 48.69, 51.53, 54.56, 55.47, 56.19, 56.88, 58.32, 59.79];

    // ════════════════════════════════════════════════════════════════════════
    // PANEL A: MOBILE OS
    // ════════════════════════════════════════════════════════════════════════
    const xMinA = 2010, xMaxA = 2024;
    const yMinA_L = 6.0, yMaxA_L = 10.5;
    const yMinA_R = 38,  yMaxA_R = 100;

    tipWindow(pA, 2011, 2015, xMinA, xMaxA, "tipping");

    leftAxis(pA,  [6, 7, 8, 9, 10], yMinA_L, yMaxA_L, "#27ae60", v => v.toFixed(0));
    rightAxis(pA, [50, 60, 70, 80, 90], yMinA_R, yMaxA_R, "#e67e22", v => v + "%");
    xAxis(pA, mobYrs, xMinA, xMaxA);
    panelTitle(pA, "(A)  Mobile OS: Android vs iOS  \u2014  \u0124\u0302\u2081\u2093\u209C\u209B (left) and Android share (right)");

    // Android market share (right axis, orange)
    drawLine(pA, mobYrs, andShr, xMinA, xMaxA, yMinA_R, yMaxA_R, "#e67e22", [], 3, 1.8);
    // H_CS lines (left axis)
    drawLine(pA, mobYrs, andH,   xMinA, xMaxA, yMinA_L, yMaxA_L, "#27ae60", [],     4.0, 2.2);
    drawLine(pA, mobYrs, iosH,   xMinA, xMaxA, yMinA_L, yMaxA_L, "#c0392b", [5, 4], 3.0, 2.2);

    // ΔH bracket at 2015
    {
        const xR = sX(2015, xMinA, xMaxA);
        const y1 = sY(9.092, yMinA_L, yMaxA_L, pA.top, pA.bot);
        const y2 = sY(8.216, yMinA_L, yMaxA_L, pA.top, pA.bot);
        ctx.strokeStyle = "#555"; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(xR + 6, y1); ctx.lineTo(xR + 6, y2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#555"; ctx.font = "8px Georgia"; ctx.textAlign = "left";
        ctx.fillText("\u0394H=0.88", xR + 9, (y1 + y2) / 2 + 3);
    }

    panelAxes(pA);
    legend(pA, [
        { color: "#27ae60", label: "Android \u0124\u0302\u2081\u2093\u209C\u209B (left, nats)" },
        { color: "#c0392b", dash: [5, 4], label: "iOS \u0124\u0302\u2081\u2093\u209C\u209B (left, nats)" },
        { color: "#e67e22", label: "Android market share (right, %)" },
    ]);
    axisLabel(14, (pA.top + pA.bot) / 2, "\u0124\u0302\u2081\u2093\u209C\u209B (nats)", "#27ae60", "left");
    axisLabel(W - 14, (pA.top + pA.bot) / 2, "Android share (%)", "#e67e22", "right");

    // ════════════════════════════════════════════════════════════════════════
    // PANEL B: BLOCKCHAIN
    // ════════════════════════════════════════════════════════════════════════
    const xMinB = 2016.5, xMaxB = 2023.5;
    const yMinB_L = 4.5, yMaxB_L = 6.5;
    const yMinB_R = 40,  yMaxB_R = 100;

    tipWindow(pB, 2018, 2020, xMinB, xMaxB, "tipping");

    leftAxis(pB,  [4.5, 5.0, 5.5, 6.0, 6.5], yMinB_L, yMaxB_L, "#2980b9", v => v.toFixed(1));
    rightAxis(pB, [50, 60, 70, 80, 90], yMinB_R, yMaxB_R, "#8e44ad", v => v + "%");
    xAxis(pB, chnYrs, xMinB, xMaxB);
    panelTitle(pB, "(B)  L1 Blockchain: Ethereum vs Bitcoin  \u2014  \u0124\u0302\u2081\u2093\u209C\u209B (left) and ETH dev share (right)");

    // ETH dev share (right axis, purple)
    drawLine(pB, chnYrs, ethShr, xMinB, xMaxB, yMinB_R, yMaxB_R, "#8e44ad", [], 3, 1.8);
    // H_CS lines (left axis)
    drawLine(pB, chnYrs, ethH, xMinB, xMaxB, yMinB_L, yMaxB_L, "#2980b9", [],     4.0, 2.2);
    drawLine(pB, chnYrs, btcH, xMinB, xMaxB, yMinB_L, yMaxB_L, "#e67e22", [5, 4], 3.0, 2.2);

    // 2022 annotation
    {
        const y = sY(6.05, yMinB_L, yMaxB_L, pB.top, pB.bot);
        ctx.fillStyle = "#999"; ctx.font = "7.5px Georgia"; ctx.textAlign = "center";
        ctx.fillText("FTX/bear", sX(2022, xMinB, xMaxB), y - 2);
    }

    panelAxes(pB);
    legend(pB, [
        { color: "#2980b9", label: "Ethereum \u0124\u0302\u2081\u2093\u209C\u209B (left, nats)" },
        { color: "#e67e22", dash: [5, 4], label: "Bitcoin \u0124\u0302\u2081\u2093\u209C\u209B (left, nats)" },
        { color: "#8e44ad", label: "ETH share of app repos (right, %)" },
    ]);
    axisLabel(14, (pB.top + pB.bot) / 2, "\u0124\u0302\u2081\u2093\u209C\u209B (nats)", "#2980b9", "left");
    axisLabel(W - 14, (pB.top + pB.bot) / 2, "ETH dev share (%)", "#8e44ad", "right");

    // ════════════════════════════════════════════════════════════════════════
    // PANEL C: FRONTEND REACT vs ANGULAR
    // ════════════════════════════════════════════════════════════════════════
    const xMinC = 2013.5, xMaxC = 2024.5;
    const yMinC_L = -0.7, yMaxC_L = 0.9;
    const yMinC_R = 0,    yMaxC_R = 70;

    // Light blue shading where ΔH > 0 (React entropy advantage zone)
    {
        const y0 = sY(0, yMinC_L, yMaxC_L, pC.top, pC.bot);
        ctx.fillStyle = "rgba(52,152,219,0.05)";
        ctx.fillRect(padL, pC.top, pw, y0 - pC.top);
    }

    tipWindow(pC, 2014, 2018, xMinC, xMaxC, "tipping");

    // Zero dashed line
    {
        const y0 = sY(0, yMinC_L, yMaxC_L, pC.top, pC.bot);
        ctx.strokeStyle = "#aaa"; ctx.lineWidth = 0.8; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(padL, y0); ctx.lineTo(padL + pw, y0); ctx.stroke();
        ctx.setLineDash([]);
    }

    leftAxis(pC,  [-0.6, -0.3, 0, 0.3, 0.6], yMinC_L, yMaxC_L, "#2980b9", v => v.toFixed(1));
    rightAxis(pC, [0, 20, 40, 60], yMinC_R, yMaxC_R, "#e74c3c", v => v + "%");
    xAxis(pC, [2014, 2016, 2018, 2020, 2022, 2024], xMinC, xMaxC);
    panelTitle(pC, "(C)  Frontend: \u0394\u0124\u0302(React\u2212Angular) (left) leads React npm share (right), 2014\u20132024");

    // 50% reference line on right axis
    {
        const y50 = sY(50, yMinC_R, yMaxC_R, pC.top, pC.bot);
        ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 0.7; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(padL, y50); ctx.lineTo(padL + pw, y50); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#e74c3c"; ctx.font = "8px Georgia"; ctx.textAlign = "left";
        ctx.fillText("50%", padL + 4, y50 - 3);
    }

    // CI band for ΔH
    drawCIBand(pC, dhYrs, dH, dH_se, xMinC, xMaxC, yMinC_L, yMaxC_L, "rgba(52,152,219,0.17)");

    // React npm share (right axis, red)
    drawLine(pC, shrYrs, reactSh, xMinC, xMaxC, yMinC_R, yMaxC_R, "#e74c3c", [], 3, 1.8);

    // ΔH line (left axis, blue)
    drawLine(pC, dhYrs, dH, xMinC, xMaxC, yMinC_L, yMaxC_L, "#2980b9", [], 4.5, 2.3);

    // "≈3-yr lag" annotation arrow
    {
        const x14  = sX(2014, xMinC, xMaxC);
        const y14L = sY(0.580, yMinC_L, yMaxC_L, pC.top, pC.bot);
        const y17R = sY(48,    yMinC_R, yMaxC_R, pC.top, pC.bot);
        ctx.strokeStyle = "#555"; ctx.lineWidth = 0.9; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(x14 + 8, y14L + 8);
        ctx.lineTo(sX(2017, xMinC, xMaxC), y17R - 6);
        ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#444"; ctx.font = "italic 8.5px Georgia"; ctx.textAlign = "left";
        ctx.fillText("\u22483-yr lag", x14 + 11, y14L + 26);
        ctx.fillStyle = "#1a6ea8"; ctx.font = "bold 8.5px Georgia";
        ctx.fillText("\u0394H=+0.58 nats (2014)", x14 + 5, y14L - 8);
    }

    panelAxes(pC);
    legend(pC, [
        { color: "#2980b9", label: "\u0394\u0124\u0302\u2081\u2093\u209C\u209B React\u2212Angular (left, nats)" },
        { color: "#e74c3c", label: "React npm share (right, %)" },
    ]);
    axisLabel(14, (pC.top + pC.bot) / 2, "\u0394\u0124\u0302\u2081\u2093\u209C\u209B (nats)", "#2980b9", "left");
    axisLabel(W - 14, (pC.top + pC.bot) / 2, "React npm share (%)", "#e74c3c", "right");

})();
