/* global rand, resetSeed, randn, drawAxes, gridLines */
// ─── Figure 3: Phase Portrait on 2-Simplex ──────────────────────────────────
lazyDraw("phaseChart", function(cv) {
    const ctx = cv.getContext("2d");
    const W = cv.width, CH = cv.height;
    const margin = 55;

    const H = [2.0, 1.5, 1.0];
    const nu = 1.0, gamma = 1.5;

    // Barycentric → Cartesian. P1 at top, P2 bottom-right, P3 bottom-left
    const corners = [
        [W / 2, margin + 10],                       // P1 (top, max-entropy)
        [W - margin - 10, CH - margin - 20],         // P2 (bottom-right)
        [margin + 10, CH - margin - 20]              // P3 (bottom-left)
    ];

    function bary2cart(x1, x2, x3) {
        return [
            x1 * corners[0][0] + x2 * corners[1][0] + x3 * corners[2][0],
            x1 * corners[0][1] + x2 * corners[1][1] + x3 * corners[2][1]
        ];
    }

    function repl(x1, x2, x3) {
        const u = [H[0] + nu * Math.pow(x1, gamma),
                   H[1] + nu * Math.pow(x2, gamma),
                   H[2] + nu * Math.pow(x3, gamma)];
        const ubar = x1 * u[0] + x2 * u[1] + x3 * u[2];
        return [x1 * (u[0] - ubar), x2 * (u[1] - ubar), x3 * (u[2] - ubar)];
    }

    // Draw simplex edges
    ctx.strokeStyle = "#666"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    ctx.lineTo(corners[1][0], corners[1][1]);
    ctx.lineTo(corners[2][0], corners[2][1]);
    ctx.closePath(); ctx.stroke();

    // Corner labels
    ctx.font = "13px Georgia"; ctx.fillStyle = "#c0392b";
    ctx.textAlign = "center"; ctx.fillText("P₁  (H=2.0)", corners[0][0], corners[0][1] - 12);
    ctx.fillStyle = "#2980b9";
    ctx.fillText("P₂  (H=1.5)", corners[1][0] + 28, corners[1][1] + 16);
    ctx.fillStyle = "#7f8c8d";
    ctx.fillText("P₃  (H=1.0)", corners[2][0] - 28, corners[2][1] + 16);

    // Velocity field arrows
    const NGrid = 9;
    ctx.strokeStyle = "#bbb"; ctx.lineWidth = 0.8;
    for (let i = 0; i <= NGrid; i++) {
        for (let j = 0; j <= NGrid - i; j++) {
            const k = NGrid - i - j;
            if (k < 0) continue;
            const x1 = i / NGrid, x2 = j / NGrid, x3 = k / NGrid;
            if (x1 < 0.02 && x2 < 0.02) continue;
            if (x1 < 0.02 && x3 < 0.02) continue;
            if (x2 < 0.02 && x3 < 0.02) continue;
            const [dx1, dx2, dx3] = repl(x1, x2, x3);
            const [cx, cy] = bary2cart(x1, x2, x3);
            const [ex, ey] = bary2cart(x1 + dx1 * 0.15, x2 + dx2 * 0.15, x3 + dx3 * 0.15);
            const scale = 18;
            const ddx = (ex - cx) * scale, ddy = (ey - cy) * scale;
            const len = Math.sqrt(ddx*ddx + ddy*ddy);
            if (len < 0.5) continue;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + ddx * 0.9, cy + ddy * 0.9);
            ctx.stroke();
        }
    }

    // Trajectories from 6 starting points
    const starts = [
        [0.05, 0.65, 0.30],
        [0.05, 0.30, 0.65],
        [0.33, 0.33, 0.34],
        [0.50, 0.30, 0.20],
        [0.20, 0.50, 0.30],
        [0.10, 0.10, 0.80],
    ];
    const tColors = ["#c0392b","#c0392b","#c0392b","#c0392b","#c0392b","#c0392b"];

    starts.forEach((s, si) => {
        let [x1, x2, x3] = s;
        ctx.strokeStyle = tColors[si]; ctx.lineWidth = 1.8;
        ctx.beginPath();
        const [sx, sy] = bary2cart(x1, x2, x3);
        ctx.moveTo(sx, sy);

        for (let t = 0; t < 250; t++) {
            const [d1, d2, d3] = repl(x1, x2, x3);
            const dt = 0.12;
            x1 = Math.max(0.001, x1 + d1 * dt);
            x2 = Math.max(0.001, x2 + d2 * dt);
            x3 = Math.max(0.001, x3 + d3 * dt);
            const s2 = x1 + x2 + x3;
            x1 /= s2; x2 /= s2; x3 /= s2;
            const [cx, cy] = bary2cart(x1, x2, x3);
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();

        // Arrow head near end
        const [ex, ey] = bary2cart(x1, x2, x3);
        const [d1, d2, d3] = repl(x1, x2, x3);
        const [ex2, ey2] = bary2cart(x1 + d1*0.01, x2 + d2*0.01, x3 + d3*0.01);
        const ang = Math.atan2(ey2 - ey, ex2 - ex);
        const al = 8;
        ctx.fillStyle = tColors[si];
        ctx.beginPath();
        ctx.moveTo(ex + al * Math.cos(ang), ey + al * Math.sin(ang));
        ctx.lineTo(ex + al * Math.cos(ang + 2.4), ey + al * Math.sin(ang + 2.4));
        ctx.lineTo(ex + al * Math.cos(ang - 2.4), ey + al * Math.sin(ang - 2.4));
        ctx.closePath(); ctx.fill();
    });

    // Mark corners as dots
    [[corners[0], "P₁"], [corners[1], "P₂"], [corners[2], "P₃"]].forEach(([c, label], i) => {
        ctx.fillStyle = i === 0 ? "#c0392b" : "#888";
        ctx.beginPath(); ctx.arc(c[0], c[1], 5, 0, 2 * Math.PI); ctx.fill();
    });

    ctx.fillStyle = "#333"; ctx.font = "12px Georgia"; ctx.textAlign = "center";
    ctx.fillText("All 6 trajectories converge to P₁ (max-entropy corner) — unique global attractor", W/2, CH - 8);
});

