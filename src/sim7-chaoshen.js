/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 7: Chao-Shen Estimator Validation ───────────────────────────────
lazyDraw("chaoshenChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const pad = { l: 65, r: 30, t: 35, b: 45 };
    const pw = W - pad.l - pad.r, ph = CH - pad.t - pad.b;

    const F = 500;  // true microstate count
    const alpha = 1.8;
    const NTrials = 120;
    const sampleSizes = [40, 80, 150, 300, 600, 1500];

    // Build Zipf distribution
    let Z = 0;
    for (let k = 1; k <= F; k++) Z += Math.pow(k, -alpha);
    const probs = new Float64Array(F);
    const cumProbs = new Float64Array(F);
    for (let k = 0; k < F; k++) {
        probs[k] = Math.pow(k + 1, -alpha) / Z;
    }
    cumProbs[0] = probs[0];
    for (let k = 1; k < F; k++) cumProbs[k] = cumProbs[k-1] + probs[k];

    // True entropy
    let trueH = 0;
    for (let k = 0; k < F; k++) {
        if (probs[k] > 0) trueH -= probs[k] * Math.log(probs[k]);
    }

    function sampleZipf(n) {
        const counts = new Int32Array(F);
        for (let i = 0; i < n; i++) {
            const u = rand();
            let lo = 0, hi = F - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (cumProbs[mid] < u) lo = mid + 1;
                else hi = mid;
            }
            counts[lo]++;
        }
        return counts;
    }

    function pluginH(counts, n) {
        let H = 0;
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] === 0) continue;
            const p = counts[i] / n;
            H -= p * Math.log(p);
        }
        return H;
    }

    function chaoShenH(counts, n) {
        let H = 0;
        for (let i = 0; i < counts.length; i++) {
            if (counts[i] === 0) continue;
            const p = counts[i] / n;
            const denom = 1 - Math.pow(1 - p, n);
            if (denom < 1e-12) continue;
            H -= p * Math.log(p) / denom;
        }
        return H;
    }

    // Run experiments
    resetSeed();
    const piMeans = [], piSDs = [], csMeans = [], csSDs = [];
    sampleSizes.forEach(n => {
        const piVals = [], csVals = [];
        for (let t = 0; t < NTrials; t++) {
            const counts = sampleZipf(n);
            piVals.push(pluginH(counts, n));
            csVals.push(chaoShenH(counts, n));
        }
        const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
        const sd = arr => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v-m)**2, 0) / arr.length); };
        piMeans.push(mean(piVals)); piSDs.push(sd(piVals));
        csMeans.push(mean(csVals)); csSDs.push(sd(csVals));
    });

    const xMin = 0, xMax = Math.log(1500), yMin = 1.5, yMax = trueH * 1.08;

    drawAxes(ctx, pad, W, CH, "log(sample size n)", "Estimated entropy (nats)", "");
    gridLines(ctx, pad, W, CH, 4, 4, xMin, xMax, yMin, yMax);

    // True entropy line
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    const yTrue = pad.t + (1 - (trueH - yMin) / (yMax - yMin)) * ph;
    ctx.beginPath(); ctx.moveTo(pad.l, yTrue); ctx.lineTo(pad.l + pw, yTrue); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#333"; ctx.font = "10px Georgia"; ctx.textAlign = "left";
    ctx.fillText(`True H* = ${trueH.toFixed(2)}`, pad.l + 4, yTrue - 4);

    // Plot plugin and Chao-Shen
    [
        { means: piMeans, sds: piSDs, color: "#e74c3c", label: "Plug-in (biased)" },
        { means: csMeans, sds: csSDs, color: "#2980b9", label: "Chao–Shen" }
    ].forEach(({ means, sds, color, label }) => {
        const pts = sampleSizes.map((n, i) => [
            pad.l + (Math.log(n) - xMin) / (xMax - xMin) * pw,
            pad.t + (1 - (means[i] - yMin) / (yMax - yMin)) * ph
        ]);

        // ±1 SD band
        ctx.fillStyle = color + "22";
        ctx.beginPath();
        sampleSizes.forEach((n, i) => {
            const px = pts[i][0];
            const pyUp = pad.t + (1 - (means[i] + sds[i] - yMin) / (yMax - yMin)) * ph;
            if (i === 0) ctx.moveTo(px, pyUp); else ctx.lineTo(px, pyUp);
        });
        sampleSizes.slice().reverse().forEach((n, i) => {
            const ii = sampleSizes.length - 1 - i;
            const px = pts[ii][0];
            const pyDn = pad.t + (1 - (means[ii] - sds[ii] - yMin) / (yMax - yMin)) * ph;
            ctx.lineTo(px, pyDn);
        });
        ctx.closePath(); ctx.fill();

        // Mean line
        ctx.strokeStyle = color; ctx.lineWidth = 2;
        ctx.beginPath();
        pts.forEach(([px, py], i) => { if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
        ctx.stroke();

        // Points
        ctx.fillStyle = color;
        pts.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, 4, 0, 2*Math.PI); ctx.fill(); });
    });

    // Legend
    ctx.font = "10px Georgia"; ctx.textAlign = "left";
    [{ color: "#e74c3c", label: "Plug-in (biased)" }, { color: "#2980b9", label: "Chao–Shen" }].forEach(({ color, label }, i) => {
        ctx.fillStyle = color; ctx.fillRect(pad.l + 8, pad.t + 10 + i*16, 18, 3);
        ctx.fillStyle = "#333"; ctx.fillText(label, pad.l + 32, pad.t + 15 + i*16);
    });

    ctx.fillStyle = "#555"; ctx.font = "10px Georgia"; ctx.textAlign = "center";
    ctx.fillText(`Zipf(α=${alpha}), |Ω|=${F}, ${NTrials} trials per n. Shading: ±1 s.d.`, W/2, pad.t - 10);

    // x-axis: log labels
    [40, 150, 600, 1500].forEach(n => {
        const px = pad.l + (Math.log(n) - xMin) / (xMax - xMin) * pw;
        ctx.fillStyle = "#666"; ctx.font = "9px Georgia"; ctx.textAlign = "center";
        ctx.fillText(String(n), px, pad.t + ph + 14);
    });
});
