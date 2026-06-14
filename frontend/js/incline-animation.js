// incline-animation.js — 斜面滑块实时动画模拟 v2
// Canvas 绘制斜面 + 金属滑块，与实验数据实时同步
(function() {
    'use strict';

    const canvas = document.getElementById('inclineCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ========== State ==========
    let currentDisplacement = 0;        // mm (source data)
    let currentTime = 0;                // s
    let currentVelocity = 0;            // mm/s
    let currentAcceleration = 0;        // mm/s²
    let maxDisplacement = 2000;         // mm — track length, FIXED (no auto-expand)
    let angleDeg = 30;
    let isDarkMode = false;

    // Smooth interpolation state
    let displayDisp = 0;
    let displayVel = 0;
    let dispVelocity = 0;               // "velocity" of display (for snap-detection)

    // Particle system for sliding sparks
    let particles = [];

    // Track color theme
    let theme = {};

    // ========== Canvas Sizing ==========
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(200, rect.width * dpr);
        canvas.height = Math.max(150, canvas.clientHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ========== Theme ==========
    function updateTheme() {
        isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDarkMode) {
            theme = {
                bg: '#1e293b',
                bgGrid: '#1a2332',
                gridLine: 'rgba(71,85,105,0.25)',
                text: '#e2e8f0',
                textMuted: '#94a3b8',
                slopeBodyFill: '#334155',
                slopeBodyStroke: '#64748b',
                slopeSurface: '#94a3b8',
                slopeGripLine: 'rgba(148,163,184,0.3)',
                blockTop: '#60a5fa',
                blockFront: '#2563eb',
                blockSide: '#1d4ed8',
                blockBottom: '#1e40af',
                blockStroke: '#93c5fd',
                blockHighlight: 'rgba(255,255,255,0.18)',
                velArrow: '#f87171',
                velArrowGlow: 'rgba(248,113,113,0.3)',
                angleArc: '#fbbf24',
                angleFill: 'rgba(251,191,36,0.12)',
                angleText: '#fcd34d',
                dispLine: 'rgba(251,191,36,0.45)',
                dispText: '#fcd34d',
                dispBg: 'rgba(15,23,42,0.85)',
                shadowColor: 'rgba(0,0,0,0.5)',
                groundTop: '#1a2332',
                groundBottom: '#0f172a',
                pillarFill: '#2d3a50',
                pillarStroke: '#475569',
                stopperFill: '#ef4444',
                stopperStroke: '#dc2626',
                sparkColor: '#fbbf24',
            };
        } else {
            theme = {
                bg: '#f8fafc',
                bgGrid: '#f1f5f9',
                gridLine: 'rgba(148,163,184,0.15)',
                text: '#1e293b',
                textMuted: '#64748b',
                slopeBodyFill: '#dce5f0',
                slopeBodyStroke: '#94a3b8',
                slopeSurface: '#bcc8da',
                slopeGripLine: 'rgba(148,163,184,0.25)',
                blockTop: '#7cb3f2',
                blockFront: '#3b82f6',
                blockSide: '#2563eb',
                blockBottom: '#1d4ed8',
                blockStroke: '#1d4ed8',
                blockHighlight: 'rgba(255,255,255,0.35)',
                velArrow: '#ef4444',
                velArrowGlow: 'rgba(239,68,68,0.25)',
                angleArc: '#d97706',
                angleFill: 'rgba(217,119,6,0.1)',
                angleText: '#92400e',
                dispLine: 'rgba(217,119,6,0.25)',
                dispText: '#b45309',
                dispBg: 'rgba(255,255,255,0.85)',
                shadowColor: 'rgba(0,0,0,0.12)',
                groundTop: '#f1f5f9',
                groundBottom: '#e2e8f0',
                pillarFill: '#e2e8f0',
                pillarStroke: '#cbd5e1',
                stopperFill: '#ef4444',
                stopperStroke: '#b91c1c',
                sparkColor: '#f59e0b',
            };
        }
    }

    // ========== Drawing ==========
    function drawBackground(W, H, c) {
        // Subtle grid background
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, W, H);

        const gridSpacing = 20;
        ctx.strokeStyle = c.gridLine;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([1, gridSpacing]);
        for (let x = gridSpacing; x < W; x += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = gridSpacing; y < H; y += gridSpacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    }

    function drawScene() {
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        updateTheme();
        const c = theme;

        // Clear with grid
        drawBackground(W, H, c);

        const angleRad = angleDeg * Math.PI / 180;
        const padLeft = 55;
        const padRight = 35;
        const padTop = 50;
        const padBottom = 48;
        const availW = W - padLeft - padRight;
        const availH = H - padTop - padBottom;

        // Slope length (visual)
        const slopeLen = Math.min(availW * 0.85, availH / Math.sin(angleRad) * 0.75);

        // Pivot point
        const pivotX = padLeft + availW * 0.1;
        const pivotY = padTop + 8;

        // Bottom-right end of slope
        const endX = pivotX + slopeLen * Math.cos(angleRad);
        const endY = pivotY + slopeLen * Math.sin(angleRad);

        // Slope thickness
        const slopeThick = 24;

        // Perp direction (downward-into-slope)
        const perpX = Math.sin(angleRad);
        const perpY = -Math.cos(angleRad);

        // Slope corners
        const sTopL = { x: pivotX, y: pivotY };
        const sTopR = { x: endX, y: endY };
        const sBotR = { x: endX + perpX * slopeThick, y: endY + perpY * slopeThick };
        const sBotL = { x: pivotX + perpX * slopeThick, y: pivotY + perpY * slopeThick };

        const groundY = endY + slopeThick * Math.abs(perpY) + 20;

        // === GROUND ===
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, groundY + 30);
        groundGrad.addColorStop(0, c.groundTop);
        groundGrad.addColorStop(1, c.groundBottom);
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, W, 30);

        // Ground line
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.strokeStyle = c.slopeBodyStroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Ground hatching
        ctx.strokeStyle = c.slopeBodyStroke;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        for (let gx = 10; gx < W - 10; gx += 16) {
            ctx.beginPath();
            ctx.moveTo(gx, groundY);
            ctx.lineTo(gx - 6, groundY + 12);
            ctx.moveTo(gx + 8, groundY);
            ctx.lineTo(gx + 2, groundY + 12);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // === SUPPORT PILLARS ===
        // Vertical pillar at the high end
        const pillarW = 6;
        const pillarBaseX = pivotX - 6;
        const pillarBaseY = groundY;
        
        function drawPillar(baseX, baseY, topX, topY) {
            // Pillar body
            const pillarGrad = ctx.createLinearGradient(baseX, 0, baseX + pillarW, 0);
            pillarGrad.addColorStop(0, c.pillarFill);
            pillarGrad.addColorStop(0.5, c.slopeSurface);
            pillarGrad.addColorStop(1, c.pillarStroke);
            ctx.fillStyle = pillarGrad;
            ctx.beginPath();
            ctx.moveTo(baseX, baseY);
            ctx.lineTo(baseX + pillarW, baseY);
            ctx.lineTo(topX + perpX * pillarW * 0.5, topY + perpY * pillarW * 0.5);
            ctx.lineTo(topX, topY);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = c.pillarStroke;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Front pillar at bottom-right
        const pillarTopX = sBotR.x - 8;
        const pillarTopY = sBotR.y + 4;
        drawPillar(pillarTopX, pillarTopY, pillarTopX + perpX * 4, pillarTopY + perpY * 4);

        // === SLOPE BODY ===
        const slopeGrad = ctx.createLinearGradient(sTopL.x, sTopL.y, sBotR.x, sBotR.y);
        slopeGrad.addColorStop(0, c.slopeSurface);
        slopeGrad.addColorStop(0.3, c.slopeBodyFill);
        slopeGrad.addColorStop(1, c.pillarFill);

        ctx.beginPath();
        ctx.moveTo(sTopL.x, sTopL.y);
        ctx.lineTo(sTopR.x, sTopR.y);
        ctx.lineTo(sBotR.x, sBotR.y);
        ctx.lineTo(sBotL.x, sBotL.y);
        ctx.closePath();
        ctx.fillStyle = slopeGrad;
        ctx.fill();
        ctx.strokeStyle = c.slopeBodyStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Slope surface grip lines (like a rough surface)
        const gripCount = 30;
        const gripLength = slopeThick * 0.28;
        ctx.strokeStyle = c.slopeGripLine;
        ctx.lineWidth = 1;
        for (let i = 1; i < gripCount; i++) {
            const t = i / gripCount;
            const gx = sTopL.x + t * (sTopR.x - sTopL.x);
            const gy = sTopL.y + t * (sTopR.y - sTopL.y);
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.lineTo(gx - perpX * gripLength, gy - perpY * gripLength);
            ctx.stroke();
        }

        // === STOPPER at bottom ===
        const stopW = 10;
        const stopH = 16;
        const stopCx = endX - stopW * 0.3 * Math.cos(angleRad);
        const stopCy = endY - stopW * 0.3 * Math.sin(angleRad);
        const stopNx = -Math.sin(angleRad);  // normal (up from slope)
        const stopNy = Math.cos(angleRad);

        ctx.save();
        ctx.translate(stopCx + stopNx * (stopH / 2), stopCy + stopNy * (stopH / 2));
        ctx.rotate(angleRad);
        ctx.fillStyle = c.stopperFill;
        ctx.strokeStyle = c.stopperStroke;
        ctx.lineWidth = 1.5;
        roundRect(ctx, -stopW / 2, -stopH / 2, stopW, stopH, 3);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // === ANGLE ARC ===
        const arcRadius = 36;
        // Fill arc
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.arc(pivotX, pivotY, arcRadius, 0, angleRad, false);
        ctx.closePath();
        ctx.fillStyle = c.angleFill;
        ctx.fill();
        // Stroke arc
        ctx.beginPath();
        ctx.arc(pivotX, pivotY, arcRadius, 0, angleRad, false);
        ctx.strokeStyle = c.angleArc;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.stroke();

        // Angle label
        const midAngle = angleRad * 0.48;
        const labelR = arcRadius + 16;
        ctx.font = 'bold 13px -apple-system, "Segoe UI", "PingFang SC", sans-serif';
        ctx.fillStyle = c.angleText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(angleDeg + '\u00b0', pivotX + labelR * Math.cos(midAngle), pivotY + labelR * Math.sin(midAngle));

        // Horizontal reference dashed
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(pivotX + arcRadius + 8, pivotY);
        ctx.lineTo(pivotX + 55, pivotY);
        ctx.strokeStyle = c.gridLine;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // "水平面" label
        ctx.font = '9px -apple-system, "Segoe UI", "PingFang SC", sans-serif';
        ctx.fillStyle = c.textMuted;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('\u6c34\u5e73\u9762', pivotX + arcRadius + 10, pivotY - 4);

        // === BLOCK ===
        // Progress: clamp [0, 1]
        const progress = Math.max(0, Math.min(1, displayDisp / maxDisplacement));
        const blockCenterDist = progress * slopeLen;

        // Block position on slope surface
        const bcx = pivotX + blockCenterDist * Math.cos(angleRad);
        const bcy = pivotY + blockCenterDist * Math.sin(angleRad);

        // Block dimensions (px)
        const blockW = 34;
        const blockH = 20;

        // Normal from slope (upward)
        const nx = -Math.sin(angleRad);
        const ny = Math.cos(angleRad);

        // Block center (above slope surface)
        const blkCx = bcx + nx * (blockH / 2 + 2);
        const blkCy = bcy + ny * (blockH / 2 + 2);

        // Shadow on slope (offset down-slope, projected)
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = c.shadowColor;
        ctx.beginPath();
        ctx.moveTo(bcx - 16 * Math.cos(angleRad), bcy - 16 * Math.sin(angleRad));
        ctx.lineTo(bcx + 18 * Math.cos(angleRad), bcy + 18 * Math.sin(angleRad));
        ctx.lineTo(bcx + 18 * Math.cos(angleRad) + nx * 12, bcy + 18 * Math.sin(angleRad) + ny * 12);
        ctx.lineTo(bcx - 16 * Math.cos(angleRad) + nx * 12, bcy - 16 * Math.sin(angleRad) + ny * 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Draw block (3D isometric-ish appearance)
        ctx.save();
        ctx.translate(blkCx, blkCy);
        ctx.rotate(angleRad);

        // --- Block faces (pseudo-3D) ---
        const bw = blockW;
        const bh = blockH;
        const depth = 6;  // 3D depth (goes "into" the slope)

        // Top face
        ctx.fillStyle = c.blockTop;
        ctx.beginPath();
        ctx.moveTo(-bw / 2, -bh);
        ctx.lineTo(bw / 2, -bh);
        ctx.lineTo(bw / 2 - depth, -bh - depth);
        ctx.lineTo(-bw / 2 - depth, -bh - depth);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = c.blockStroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Front face
        const frontGrad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        frontGrad.addColorStop(0, c.blockFront);
        frontGrad.addColorStop(1, c.blockSide);
        ctx.fillStyle = frontGrad;
        ctx.beginPath();
        roundRect(ctx, -bw / 2, -bh, bw, bh, 5);
        ctx.fill();
        ctx.strokeStyle = c.blockStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Highlight (shine on top)
        ctx.fillStyle = c.blockHighlight;
        ctx.beginPath();
        ctx.moveTo(-bw / 2 + 4, -bh + 2);
        ctx.lineTo(bw / 2 - 8, -bh + 2);
        ctx.lineTo(bw / 2 - 10, -bh - depth + 1);
        ctx.lineTo(-bw / 2 + 2, -bh - depth + 1);
        ctx.closePath();
        ctx.fill();

        // Small detail: "Fe" label on block
        ctx.font = 'bold 10px "Courier New", monospace';
        ctx.fillStyle = c.blockHighlight;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Fe', 0, -bh / 2 - 2);

        ctx.restore();

        // === VELOCITY ARROW ===
        const velScale = 0.055;
        const velMag = Math.min(Math.abs(displayVel) * velScale, 58);
        if (velMag > 4) {
            // Arrow from block front edge along slope direction
            const arrBaseX = blkCx + (blockW / 2 + 3) * Math.cos(angleRad);
            const arrBaseY = blkCy + (blockW / 2 + 3) * Math.sin(angleRad);
            const arrTipX = arrBaseX + velMag * Math.cos(angleRad);
            const arrTipY = arrBaseY + velMag * Math.sin(angleRad);

            // Glow
            ctx.strokeStyle = c.velArrowGlow;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(arrBaseX, arrBaseY);
            ctx.lineTo(arrTipX, arrTipY);
            ctx.stroke();

            // Shaft
            ctx.strokeStyle = c.velArrow;
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(arrBaseX, arrBaseY);
            ctx.lineTo(arrTipX, arrTipY);
            ctx.stroke();

            // Arrowhead
            const hLen = 8 + velMag * 0.06;
            const hAngle = 0.5;
            ctx.fillStyle = c.velArrow;
            ctx.beginPath();
            ctx.moveTo(arrTipX, arrTipY);
            ctx.lineTo(
                arrTipX - hLen * Math.cos(angleRad - hAngle),
                arrTipY - hLen * Math.sin(angleRad - hAngle)
            );
            ctx.lineTo(
                arrTipX - hLen * Math.cos(angleRad + hAngle),
                arrTipY - hLen * Math.sin(angleRad + hAngle)
            );
            ctx.closePath();
            ctx.fill();

            // Velocity label
            ctx.font = 'bold 11px "Courier New", monospace';
            ctx.fillStyle = c.velArrow;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            const vLabX = arrBaseX + (velMag * 0.5 + 8) * Math.cos(angleRad);
            const vLabY = arrBaseY + (velMag * 0.5 + 8) * Math.sin(angleRad);
            ctx.fillText(Math.abs(displayVel).toFixed(0) + 'mm/s', vLabX, vLabY - 3);
        }

        // === DISPLACEMENT INDICATOR ===
        if (progress > 0.03) {
            const dOffset = slopeThick * 0.85;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(sTopL.x + perpX * dOffset, sTopL.y + perpY * dOffset);
            const dx = sTopL.x + perpX * dOffset + progress * slopeLen * Math.cos(angleRad);
            const dy = sTopL.y + perpY * dOffset + progress * slopeLen * Math.sin(angleRad);
            ctx.lineTo(dx, dy);
            ctx.strokeStyle = c.dispLine;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.setLineDash([]);

            // Two small tick marks at start and current position
            ctx.strokeStyle = c.dispText;
            ctx.lineWidth = 1.5;
            // Start tick
            const tSx = sTopL.x + perpX * dOffset;
            const tSy = sTopL.y + perpY * dOffset;
            ctx.beginPath();
            ctx.moveTo(tSx + nx * 4, tSy + ny * 4);
            ctx.lineTo(tSx - nx * 4, tSy - ny * 4);
            ctx.stroke();
            // Current tick (if not at edges)
            if (progress > 0.05 && progress < 0.97) {
                ctx.beginPath();
                ctx.moveTo(dx + nx * 5, dy + ny * 5);
                ctx.lineTo(dx - nx * 5, dy - ny * 5);
                ctx.stroke();
            }

            // Displacement text
            if (progress < 0.9) {
                ctx.font = 'bold 11px "Courier New", monospace';
                ctx.fillStyle = c.dispText;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const ttx = dx - nx * 8;
                const tty = dy - ny * 8;
                const txtStr = displayDisp.toFixed(0) + 'mm';
                const tw = ctx.measureText(txtStr).width;
                ctx.fillStyle = c.dispBg;
                roundRect(ctx, ttx - tw / 2 - 5, tty - 8, tw + 10, 16, 5);
                ctx.fill();
                ctx.fillStyle = c.dispText;
                ctx.fillText(txtStr, ttx, tty);
            }
        }

        // === PARTICLES (sparks) ===
        updateAndDrawParticles(c);

        // === RULER TICKS along slope ===
        ctx.strokeStyle = c.textMuted;
        ctx.font = '8px "Courier New", monospace';
        ctx.fillStyle = c.textMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const tickCount = 10;
        for (let i = 0; i <= tickCount; i++) {
            const t = i / tickCount;
            const tickX = sTopL.x + t * (sTopR.x - sTopL.x) + perpX * slopeThick * 0.6;
            const tickY = sTopL.y + t * (sTopR.y - sTopL.y) + perpY * slopeThick * 0.6;
            ctx.beginPath();
            ctx.moveTo(tickX, tickY);
            ctx.lineTo(tickX + perpX * 5, tickY + perpY * 5);
            ctx.stroke();
            if (i % 2 === 0) {
                const mmVal = Math.round(t * maxDisplacement);
                ctx.fillText(mmVal, tickX + perpX * 7, tickY + perpY * 7);
            }
        }

        // === INFO OVERLAY ===
        ctx.font = '10px -apple-system, "Segoe UI", "PingFang SC", sans-serif';
        ctx.fillStyle = c.textMuted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('\u23f1 t=' + currentTime.toFixed(2) + ' s  a=' + currentAcceleration.toFixed(0) + ' mm/s\u00b2', W - 8, 6);
    }

    // ========== Particle System ==========
    function spawnParticles() {
        if (Math.abs(displayVel) > 30 && particles.length < 20) {
            const count = Math.min(3, Math.floor(displayVel / 60));
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: bcx + (Math.random() - 0.5) * 10,
                    y: bcy + (Math.random() - 0.5) * 6,
                    vx: (Math.random() - 0.3) * 0.5,
                    vy: (Math.random() - 1) * 1.5,
                    life: 1.0,
                    decay: 0.02 + Math.random() * 0.04,
                    size: 1.2 + Math.random() * 2.5,
                });
            }
        }
    }

    function updateAndDrawParticles(c) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= p.decay;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98;
            p.vy += 0.03;
            ctx.fillStyle = c.sparkColor.replace(')', ', ' + (p.life * 0.7) + ')');
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ========== Drawing utility ==========
    function roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
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

    // ========== Animation Loop ==========
    // Track last set data timestamp to detect resets
    let lastDataTime = 0;
    let dataIsFlowing = false;

    function animate() {
        // Smooth interpolation (adaptive — slower when far, faster when close)
        const smoothFactor = 0.12;
        const rawDispDelta = currentDisplacement - displayDisp;

        // Detect sudden reset: if currentDisplacement dropped significantly
        // and displayDisp is far ahead, do a fast catch-up
        if (rawDispDelta < -300 && displayDisp > maxDisplacement * 0.8) {
            // Data likely got cleared/reset — snap quickly
            displayDisp += rawDispDelta * 0.25;
        } else {
            displayDisp += rawDispDelta * smoothFactor;
        }

        // If within 0.5mm, snap exactly
        if (Math.abs(rawDispDelta) < 0.5) {
            displayDisp = currentDisplacement;
        }

        displayVel += (currentVelocity - displayVel) * 0.15;
        if (Math.abs(currentVelocity - displayVel) < 0.3) {
            displayVel = currentVelocity;
        }

        // Spawn particles along block position
        const progress = Math.max(0, Math.min(1, displayDisp / maxDisplacement));
        const angleRad = angleDeg * Math.PI / 180;
        const slopeLen = Math.min(
            (canvas.clientWidth - 90) * 0.85,
            (canvas.clientHeight - 98) / Math.sin(angleRad) * 0.75
        );
        const blockCenterDist = progress * slopeLen;

        // Need pivot/reference for particle spawn position
        const padLeft = 55;
        const padTop = 50;
        const availW = canvas.clientWidth - padLeft - 35;
        const pivotX = padLeft + availW * 0.1;
        const pivotY = padTop + 8;
        const nx = -Math.sin(angleRad);
        const ny = Math.cos(angleRad);
        const blockW = 34;
        const blockH = 20;

        if (Math.abs(displayVel) > 50 && particles.length < 15 && Math.random() < 0.3) {
            // Correct block center for particle spawning
            const bcx = pivotX + blockCenterDist * Math.cos(angleRad);
            const bcy = pivotY + blockCenterDist * Math.sin(angleRad);
            const blkCx = bcx + nx * (blockH / 2 + 2);
            const blkCy = bcy + ny * (blockH / 2 + 2);
            const backEdgeX = blkCx - (blockW / 2) * Math.cos(angleRad);
            const backEdgeY = blkCy - (blockW / 2) * Math.sin(angleRad);

            particles.push({
                x: backEdgeX + (Math.random() - 0.5) * 8,
                y: backEdgeY + (Math.random() - 0.5) * 4,
                vx: (Math.random() - 0.2) * 0.8,
                vy: (Math.random() - 0.5) * 2,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.05,
                size: 1 + Math.random() * 2.5,
            });
        }

        // Update particles
        updateAndDrawParticles(theme);

        drawScene();
        requestAnimationFrame(animate);
    }

    // ========== Public API ==========
    function setDisplacement(disp, time, vel, acc) {
        // FIXED maxDisplacement length — no auto-expansion
        // Just clamp incoming data to avoid overshoot visual issues
        currentDisplacement = Math.max(0, Math.min(disp, maxDisplacement * 1.05));
        currentTime = time;
        currentVelocity = vel;
        currentAcceleration = acc;
        lastDataTime = performance.now();
    }

    function setAngle(deg) {
        angleDeg = deg;
        const badge = document.getElementById('animationAngleBadge');
        if (badge) badge.textContent = '\u03b8 = ' + deg + '\u00b0';
        // Reset particles on angle change
        particles = [];
    }

    function resetAnimation() {
        currentDisplacement = 0;
        currentTime = 0;
        currentVelocity = 0;
        currentAcceleration = 0;
        displayDisp = 0;
        displayVel = 0;
        particles = [];
    }

    function setDarkMode(dark) {
        isDarkMode = dark;
    }

    // ========== Init ==========
    updateTheme();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Watch theme changes
    new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            if (m.attributeName === 'data-theme') {
                updateTheme();
            }
        });
    }).observe(document.documentElement, { attributes: true });

    // Start loop
    requestAnimationFrame(animate);

    // Expose globally
    window.inclineAnimation = {
        setData: setDisplacement,
        setAngle: setAngle,
        reset: resetAnimation,
        setDarkMode: setDarkMode
    };

})();
