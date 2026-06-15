// incline-animation.js — 斜面滑块实时动画模拟 v3
// Canvas 绘制斜面 + 金属滑块，与实验数据实时同步
(function() {
    'use strict';

    const canvas = document.getElementById('inclineCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ========== State ==========
    let currentDisplacement = 0;   // mm (source data)
    let currentTime = 0;           // s
    let currentVelocity = 0;       // mm/s
    let currentAcceleration = 0;   // mm/s²
    let maxDisplacement = 2000;    // mm — track length (fixed)
    let angleDeg = 30;

    // Force analysis toggle
    let showForceAnalysis = false;

    // Smooth interpolation (display values lag behind source data)
    let displayDisp = 0;
    let displayVel = 0;

    // ========== Monotonic guard — only go forward ==========
    // This prevents the block from ever sliding backward due
    // to data fluctuations, chat refreshes, or polling glitches.
    let lastAcceptedDisp = -Infinity;

    // ========== Theme ==========
    let isDark = false;
    let C = {};

    function loadTheme() {
        isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            C = {
                bg: '#1e293b',
                grid: 'rgba(71,85,105,0.2)',
                text: '#e2e8f0',
                muted: '#94a3b8',
                slopeBody: '#2d3b4f',
                slopeStroke: '#475569',
                slopeFace: '#64748b',
                grip: 'rgba(148,163,184,0.22)',
                blockTop: '#60a5fa',
                blockFront: '#2563eb',
                blockSide: '#1d4ed8',
                blockEdge: '#93c5fd',
                blockShine: 'rgba(255,255,255,0.16)',
                shadow: 'rgba(0,0,0,0.4)',
                arrow: '#f87171',
                arrowGlow: 'rgba(248,113,113,0.2)',
                angleArc: '#fbbf24',
                angleFill: 'rgba(251,191,36,0.1)',
                angleTxt: '#fcd34d',
                dispLine: 'rgba(251,191,36,0.45)',
                dispTxt: '#fcd34d',
                dispBg: 'rgba(15,23,42,0.85)',
                groundT: '#1e293b',
                groundB: '#0f172a',
                pillar: '#2d3a50',
                pillarS: '#475569',
                stopper: '#ef4444',
            };
        } else {
            C = {
                bg: '#f8fafc',
                grid: 'rgba(148,163,184,0.12)',
                text: '#1e293b',
                muted: '#64748b',
                slopeBody: '#c8d6e5',
                slopeStroke: '#94a3b8',
                slopeFace: '#9aa8bd',
                grip: 'rgba(148,163,184,0.18)',
                blockTop: '#93c5fd',
                blockFront: '#3b82f6',
                blockSide: '#2563eb',
                blockEdge: '#1d4ed8',
                blockShine: 'rgba(255,255,255,0.3)',
                shadow: 'rgba(0,0,0,0.1)',
                arrow: '#ef4444',
                arrowGlow: 'rgba(239,68,68,0.18)',
                angleArc: '#d97706',
                angleFill: 'rgba(217,119,6,0.08)',
                angleTxt: '#92400e',
                dispLine: 'rgba(217,119,6,0.22)',
                dispTxt: '#b45309',
                dispBg: 'rgba(255,255,255,0.8)',
                groundT: '#f1f5f9',
                groundB: '#e2e8f0',
                pillar: '#dce5f0',
                pillarS: '#cbd5e1',
                stopper: '#ef4444',
            };
        }
    }

    // ========== Canvas Sizing ==========
    function sizeCanvas() {
        const r = canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width  = Math.max(200, r.width  * dpr);
        canvas.height = Math.max(150, r.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ========== Round Rect Helper ==========
    function roundRect(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ========== DRAW ==========
    function draw() {
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        loadTheme();
        const c = C;

        // --- Background ---
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, W, H);

        // --- Clip all content to canvas bounds (prevents arrow overflow) ---
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.clip();

        // Subtle grid
        ctx.strokeStyle = c.grid;
        ctx.lineWidth = 0.4;
        for (let x = 20; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 20; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        const ang = angleDeg * Math.PI / 180;
        const sinA = Math.sin(ang);
        const cosA = Math.cos(ang);

        // === Layout: compute slope geometry first, then center vertically ===
        const slopeThick = 20;                     // slope body thickness (px)
        const groundH = 20;                         // ground strip height

        // Pivot (top-left of ramp surface) — start from top-left
        const pivotX = 60;
        const pivotY = 30;

        // Maximum horizontal run available
        const maxRun = W - pivotX - 40;
        // Maximum vertical drop available
        const maxDrop = H - groundH - pivotY - 10;

        // Slope length: use whichever is the limiting factor
        const slopeLen = Math.min(
            maxRun / cosA - 4,
            maxDrop / sinA - slopeThick * Math.abs(-cosA) / sinA
        );

        // End point of slope surface
        const endX = pivotX + slopeLen * cosA;
        const endY = pivotY + slopeLen * sinA;

        // Perpendicular direction (into the slope body, down-right-ish)
        const perpX = sinA;
        const perpY = -cosA;

        // Four corners of slope trapezoid
        const p1 = { x: pivotX, y: pivotY };
        const p2 = { x: endX,   y: endY };
        const p3 = { x: endX   + perpX * slopeThick, y: endY   + perpY * slopeThick };
        const p4 = { x: pivotX + perpX * slopeThick, y: pivotY + perpY * slopeThick };

        // === VERTICAL CENTERING (slightly biased upward) ===
        // Bounding box of all visible elements
        const contentTop    = Math.min(p1.y, p4.y);
        const contentBottom = Math.max(p3.y, p2.y) + groundH;
        const contentHeight = contentBottom - contentTop;
        const vOffset = (H - contentHeight) / 2 - contentTop - 4;

        ctx.save();
        ctx.translate(0, vOffset);

        // Recompute ground position after translation
        const groundY = H - vOffset - groundH;

        // === GROUND ===
        const gGrad = ctx.createLinearGradient(0, groundY, 0, groundY + groundH);
        gGrad.addColorStop(0, c.groundT);
        gGrad.addColorStop(1, c.groundB);
        ctx.fillStyle = gGrad;
        ctx.fillRect(0, groundY, W, groundH);
        ctx.strokeStyle = c.slopeStroke;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();

        // Ground hatching
        ctx.strokeStyle = c.slopeStroke;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.4;
        for (let gx = 6; gx < W; gx += 14) {
            ctx.beginPath();
            ctx.moveTo(gx, groundY);
            ctx.lineTo(gx - 5, groundY + 10);
            ctx.moveTo(gx + 7, groundY);
            ctx.lineTo(gx + 2, groundY + 10);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // === SLOPE BODY ===
        const sGrad = ctx.createLinearGradient(p1.x, p1.y, p3.x, p3.y);
        sGrad.addColorStop(0, c.slopeFace);
        sGrad.addColorStop(0.2, c.slopeBody);
        sGrad.addColorStop(1, c.pillar);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fillStyle = sGrad;
        ctx.fill();
        ctx.strokeStyle = c.slopeStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Top surface highlight line
        ctx.strokeStyle = c.slopeFace;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Grip marks on slope surface (physics experiment look)
        const nGrip = 28;
        ctx.strokeStyle = c.grip;
        ctx.lineWidth = 1;
        for (let i = 1; i < nGrip; i++) {
            const t = i / nGrip;
            const gx = p1.x + t * (p2.x - p1.x);
            const gy = p1.y + t * (p2.y - p1.y);
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx - perpX * 5, gy - perpY * 5);
            ctx.stroke();
        }

        // Normal vector pointing UP from slope surface
        const nx = -sinA;
        const ny = cosA;

        // === ANGLE ARC ===
        const arcR = 34;
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.arc(pivotX, pivotY, arcR, 0, ang, false);
        ctx.closePath();
        ctx.fillStyle = c.angleFill;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pivotX, pivotY, arcR, 0, ang, false);
        ctx.strokeStyle = c.angleArc;
        ctx.lineWidth = 2;
        ctx.stroke();

        const midA = ang * 0.48;
        ctx.font = 'bold 12px -apple-system, "Segoe UI", "PingFang SC", sans-serif';
        ctx.fillStyle = c.angleTxt;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(angleDeg + '\u00b0', pivotX + (arcR + 15) * Math.cos(midA), pivotY + (arcR + 15) * Math.sin(midA));

        // Horizontal reference dashed line
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = c.grid;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(pivotX + arcR + 6, pivotY);
        ctx.lineTo(pivotX + 52, pivotY);
        ctx.stroke();
        ctx.setLineDash([]);

        // === BLOCK ===
        const progress = Math.max(0, Math.min(1, displayDisp / maxDisplacement));
        const bDist = progress * slopeLen;

        // Block center on slope surface
        const bcx = pivotX + bDist * cosA;
        const bcy = pivotY + bDist * sinA;

        const bw = 32;
        const bh = 18;
        const depth = 5;  // 3D depth

        // Center above surface
        const blkCx = bcx + nx * (bh / 2 + 2);
        const blkCy = bcy + ny * (bh / 2 + 2);

        // Shadow cast on slope
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = c.shadow;
        ctx.beginPath();
        ctx.ellipse(bcx + 2 * cosA, bcy + 2 * sinA, bw / 2 + 2, 4, ang, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3D Block
        ctx.save();
        ctx.translate(blkCx, blkCy);
        ctx.rotate(ang);

        // Top face
        ctx.fillStyle = c.blockTop;
        ctx.beginPath();
        ctx.moveTo(-bw / 2, -bh);
        ctx.lineTo(bw / 2, -bh);
        ctx.lineTo(bw / 2 - depth, -bh - depth);
        ctx.lineTo(-bw / 2 - depth, -bh - depth);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = c.blockEdge;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Front face
        const fGrad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        fGrad.addColorStop(0, c.blockFront);
        fGrad.addColorStop(1, c.blockSide);
        ctx.fillStyle = fGrad;
        roundRect(-bw / 2, -bh, bw, bh, 5);
        ctx.fill();
        ctx.strokeStyle = c.blockEdge;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // Shine highlight
        ctx.fillStyle = c.blockShine;
        ctx.beginPath();
        ctx.moveTo(-bw / 2 + 5, -bh + 2);
        ctx.lineTo(bw / 2 - 9, -bh + 2);
        ctx.lineTo(bw / 2 - 10, -bh - depth + 1);
        ctx.lineTo(-bw / 2 + 3, -bh - depth + 1);
        ctx.closePath();
        ctx.fill();

        // "Fe" label
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.fillStyle = c.blockShine;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Fe', 0, -bh / 2 - 1);

        ctx.restore();

        // === FORCE ANALYSIS VECTORS ===
        if (showForceAnalysis) {
            const fLenG = 50;     // gravity arrow length (px)
            const fLenN = 38;     // normal force length
            const fLenD = 30;     // damping force length

            // Origin: block center (blkCx, blkCy)
            const ox = blkCx;
            const oy = blkCy;

            // --- G: Gravity (straight down) ---
            ctx.save();
            // Glow
            ctx.strokeStyle = 'rgba(139,92,246,0.25)';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + fLenG); ctx.stroke();
            // Arrow shaft
            ctx.strokeStyle = '#7c3aed';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy + fLenG); ctx.stroke();
            // Arrowhead
            ctx.fillStyle = '#7c3aed';
            ctx.beginPath();
            ctx.moveTo(ox, oy + fLenG);
            ctx.lineTo(ox - 5, oy + fLenG - 9);
            ctx.lineTo(ox + 5, oy + fLenG - 9);
            ctx.closePath(); ctx.fill();
            // Label
            ctx.font = 'bold 11px "Courier New", monospace';
            ctx.fillStyle = '#7c3aed';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText('G', ox + 8, oy + fLenG * 0.55);
            ctx.restore();

            // --- Fn: Normal force (perpendicular to slope, up/out) ---
            ctx.save();
            // Direction: perpendicular to slope surface, pointing AWAY from slope body (visually "up")
            const fnDirX = -nx;   // opposite of nx,ny → points "up" relative to slope
            const fnDirY = -ny;
            const fnEndX = ox + fnDirX * fLenN;
            const fnEndY = oy + fnDirY * fLenN;
            // Glow
            ctx.strokeStyle = 'rgba(16,185,129,0.25)';
            ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(fnEndX, fnEndY); ctx.stroke();
            // Shaft
            ctx.strokeStyle = '#059669';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(fnEndX, fnEndY); ctx.stroke();
            // Arrowhead
            const fnAng = Math.atan2(fnDirY, fnDirX);
            ctx.fillStyle = '#059669'; ctx.beginPath();
            ctx.moveTo(fnEndX, fnEndY);
            ctx.lineTo(fnEndX - 9 * Math.cos(fnAng - 0.45), fnEndY - 9 * Math.sin(fnAng - 0.45));
            ctx.lineTo(fnEndX - 9 * Math.cos(fnAng + 0.45), fnEndY - 9 * Math.sin(fnAng + 0.45));
            ctx.closePath(); ctx.fill();
            // Label
            ctx.font = 'bold 11px "Courier New", monospace';
            ctx.fillStyle = '#059669';
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText('Fn', fnEndX + fnDirX * 10, fnEndY + fnDirY * 10);
            ctx.restore();

            // --- Fd: Damping force (along slope, up / opposing motion) ---
            ctx.save();
            // Direction: up the slope = opposite of slide direction
            const fdDirX = -cosA;
            const fdDirY = -sinA;
            const fdEndX = ox + fdDirX * fLenD;
            const fdEndY = oy + fdDirY * fLenD;
            // Glow
            ctx.strokeStyle = 'rgba(245,158,11,0.25)';
            ctx.lineWidth = 5; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(fdEndX, fdEndY); ctx.stroke();
            // Shaft
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(fdEndX, fdEndY); ctx.stroke();
            // Arrowhead
            const fdAng = Math.atan2(fdDirY, fdDirX);
            ctx.fillStyle = '#d97706'; ctx.beginPath();
            ctx.moveTo(fdEndX, fdEndY);
            ctx.lineTo(fdEndX - 8 * Math.cos(fdAng - 0.45), fdEndY - 8 * Math.sin(fdAng - 0.45));
            ctx.lineTo(fdEndX - 8 * Math.cos(fdAng + 0.45), fdEndY - 8 * Math.sin(fdAng + 0.45));
            ctx.closePath(); ctx.fill();
            // Label
            ctx.font = 'bold 11px "Courier New", monospace';
            ctx.fillStyle = '#d97706';
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.fillText('Fd', fdEndX + fdDirX * 10 - 4, fdEndY + fdDirY * 10);
            ctx.restore();
        }

        // === VELOCITY ARROW ===
        const velMag = Math.min(Math.abs(displayVel) * 0.055, 55);
        if (velMag > 5) {
            const aBx = blkCx + (bw / 2 + 3) * cosA;
            const aBy = blkCy + (bw / 2 + 3) * sinA;
            const aTx = aBx + velMag * cosA;
            const aTy = aBy + velMag * sinA;

            // Glow under
            ctx.strokeStyle = c.arrowGlow;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(aBx, aBy);
            ctx.lineTo(aTx, aTy);
            ctx.stroke();

            // Arrow shaft
            ctx.strokeStyle = c.arrow;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(aBx, aBy);
            ctx.lineTo(aTx, aTy);
            ctx.stroke();

            // Arrowhead
            const hl = 8 + velMag * 0.05;
            const ha = 0.5;
            ctx.fillStyle = c.arrow;
            ctx.beginPath();
            ctx.moveTo(aTx, aTy);
            ctx.lineTo(aTx - hl * Math.cos(ang - ha), aTy - hl * Math.sin(ang - ha));
            ctx.lineTo(aTx - hl * Math.cos(ang + ha), aTy - hl * Math.sin(ang + ha));
            ctx.closePath();
            ctx.fill();

            // Velocity text
            ctx.font = 'bold 10px "Courier New", monospace';
            ctx.fillStyle = c.arrow;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(
                Math.abs(displayVel).toFixed(0) + ' mm/s',
                aBx + (velMag * 0.5 + 10) * cosA,
                aBy + (velMag * 0.5 + 10) * sinA - 2
            );
        }

        // === DISPLACEMENT INDICATOR ===
        if (progress > 0.04) {
            const doff = slopeThick * 0.9;
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = c.dispLine;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p1.x + perpX * doff, p1.y + perpY * doff);
            const dx = p1.x + perpX * doff + progress * slopeLen * cosA;
            const dy = p1.y + perpY * doff + progress * slopeLen * sinA;
            ctx.lineTo(dx, dy);
            ctx.stroke();
            ctx.setLineDash([]);

            // Tick mark at current position
            if (progress > 0.06 && progress < 0.96) {
                ctx.strokeStyle = c.dispTxt;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(dx + nx * 4, dy + ny * 4);
                ctx.lineTo(dx - nx * 4, dy - ny * 4);
                ctx.stroke();
            }

            // Displacement text
            if (progress < 0.9) {
                const text = displayDisp.toFixed(0) + ' mm';
                ctx.font = 'bold 10px "Courier New", monospace';
                const tw = ctx.measureText(text).width;
                const ttx = dx - nx * 9;
                const tty = dy - ny * 9;

                ctx.fillStyle = c.dispBg;
                roundRect(ttx - tw / 2 - 5, tty - 7, tw + 10, 15, 4);
                ctx.fill();

                ctx.fillStyle = c.dispTxt;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, ttx, tty);
            }
        }

        // === TOP-RIGHT INFO ===
        ctx.font = '9.5px -apple-system, "Segoe UI", "PingFang SC", sans-serif';
        ctx.fillStyle = c.muted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(
            't=' + currentTime.toFixed(2) + ' s  a=' + currentAcceleration.toFixed(0) + ' mm/s\u00b2',
            W - 8, 5
        );

        // === BOTTOM-LABEL ===
        ctx.font = '8px -apple-system, "Segoe UI", sans-serif';
        ctx.fillStyle = c.muted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('轨道总长 ' + maxDisplacement + ' mm', p3.x + 4, p3.y);

        // Restore vertical centering translation
        ctx.restore();

        // Restore clip region
        ctx.restore();
    }

    // ========== Animation Loop ==========
    let lastDrawTime = 0;

    function tick(now) {
        lastDrawTime = now;

        // Smooth interpolation
        const delta = currentDisplacement - displayDisp;

        // If data is going backwards more than a tiny amount, it's
        // likely a data reset — snap immediately to match.
        if (delta < -200) {
            displayDisp += delta * 0.3;  // fast catch-up on reset
        } else if (delta > 0) {
            displayDisp += delta * 0.12;  // normal smooth follow
        }

        // Snap within tolerance
        if (Math.abs(delta) < 0.5) displayDisp = currentDisplacement;

        // Velocity smoothing
        const vd = currentVelocity - displayVel;
        if (Math.abs(vd) < 0.3) displayVel = currentVelocity;
        else displayVel += vd * 0.15;

        draw();
        requestAnimationFrame(tick);
    }

    // ========== Public API ==========
    function setData(disp, time, vel, acc) {
        // === MONOTONIC GUARD ===
        // Only move forward. If incoming displacement drops significantly
        // compared to what we've already accepted, it's a data glitch or
        // a chat-response wave restart — IGNORE it unless it's a real reset
        // (close to 0). This keeps the block moving smoothly forward only.
        const rawDisp = Math.max(0, Math.min(disp, maxDisplacement * 1.05));

        if (rawDisp < lastAcceptedDisp - 800) {
            // Huge drop (>80cm) — genuine reset, accept it
            lastAcceptedDisp = rawDisp;
        } else if (rawDisp < lastAcceptedDisp - 10) {
            // Small backward jump — ignore (keep last accepted value)
            // But still update time/vel/acc for display
            currentTime = time;
            currentVelocity = Math.max(0, vel);  // don't show negative velocity
            currentAcceleration = acc;
            return;
        } else if (rawDisp > lastAcceptedDisp) {
            lastAcceptedDisp = rawDisp;
        }
        // if equal, no-op for displacement tracking

        currentDisplacement = lastAcceptedDisp;
        currentTime = time;
        currentVelocity = Math.max(0, vel);
        currentAcceleration = acc;
    }

    function setAngle(deg) {
        angleDeg = deg;
        const badge = document.getElementById('animationAngleBadge');
        if (badge) badge.textContent = '\u03b8 = ' + deg + '\u00b0';
    }

    function resetAnimation() {
        currentDisplacement = 0;
        currentTime = 0;
        currentVelocity = 0;
        currentAcceleration = 0;
        displayDisp = 0;
        displayVel = 0;
        lastAcceptedDisp = -Infinity;
    }

    function toggleForceAnalysis(force) {
        if (typeof force === 'boolean') {
            showForceAnalysis = force;
        } else {
            showForceAnalysis = !showForceAnalysis;
        }
        var btn = document.getElementById('forceAnalysisBtn');
        var legend = document.getElementById('forceLegend');
        if (btn) btn.classList.toggle('active', showForceAnalysis);
        if (legend) legend.style.display = showForceAnalysis ? 'flex' : 'none';
        return showForceAnalysis;
    }

    // ========== Init ==========
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width  = Math.max(200, rect.width  * dpr);
        canvas.height = Math.max(150, rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Theme watch
    new MutationObserver(function(ms) {
        ms.forEach(function(m) {
            if (m.attributeName === 'data-theme') loadTheme();
        });
    }).observe(document.documentElement, { attributes: true });

    loadTheme();
    requestAnimationFrame(tick);

    // Expose
    window.inclineAnimation = {
        setData: setData,
        setAngle: setAngle,
        reset: resetAnimation,
        toggleForceAnalysis: toggleForceAnalysis,
    };

    // Wire force analysis button
    var faBtn = document.getElementById('forceAnalysisBtn');
    if (faBtn) {
        faBtn.addEventListener('click', function() { toggleForceAnalysis(); });
    }

})();
