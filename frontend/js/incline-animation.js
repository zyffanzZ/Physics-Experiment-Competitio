// incline-animation.js — 斜面滑块实时动画模拟
// Canvas 绘制斜面 + 滑块，与实验数据实时同步
(function() {
    'use strict';

    const canvas = document.getElementById('inclineCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Animation state
    let currentDisplacement = 0;   // mm
    let currentTime = 0;            // s
    let currentVelocity = 0;        // mm/s
    let currentAcceleration = 0;    // mm/s²
    let maxDisplacement = 2000;     // mm (轨道总长度)
    let angleDeg = 30;
    let isDarkMode = false;

    // Smooth interpolation targets
    let displayDisp = 0;
    let displayVel = 0;

    // Animation frame ID
    let animFrameId = null;

    // ========== Canvas Sizing ==========
    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(200, rect.width * dpr);
        canvas.height = Math.max(150, canvas.clientHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ========== Drawing Helpers ==========
    function getThemeColors() {
        if (isDarkMode) {
            return {
                bg: '#1e293b',
                grid: 'rgba(71,85,105,0.35)',
                text: '#e2e8f0',
                textMuted: '#94a3b8',
                slopeFill: '#334155',
                slopeStroke: '#475569',
                slopeSurface: '#475569',
                blockGradStart: '#60a5fa',
                blockGradEnd: '#2563eb',
                blockStroke: '#93c5fd',
                velArrow: '#ef4444',
                velArrowHead: '#fca5a5',
                groundFill: '#0f172a',
                groundStroke: '#334155',
                angleArc: '#f59e0b',
                angleText: '#fbbf24',
                dispLine: 'rgba(245,158,11,0.5)',
                dispText: '#fcd34d',
                shadowColor: 'rgba(15,23,42,0.4)',
            };
        }
        return {
            bg: '#f8fafc',
            grid: 'rgba(148,163,184,0.2)',
            text: '#1e293b',
            textMuted: '#64748b',
            slopeFill: '#e2e8f0',
            slopeStroke: '#94a3b8',
            slopeSurface: '#cbd5e1',
            blockGradStart: '#60a5fa',
            blockGradEnd: '#3b82f6',
            blockStroke: '#2563eb',
            velArrow: '#ef4444',
            velArrowHead: '#fca5a5',
            groundFill: '#f1f5f9',
            groundStroke: '#cbd5e1',
            angleArc: '#d97706',
            angleText: '#b45309',
            dispLine: 'rgba(217,119,6,0.25)',
            dispText: '#d97706',
            shadowColor: 'rgba(0,0,0,0.12)',
        };
    }

    function drawScene() {
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        const c = getThemeColors();

        // Clear
        ctx.fillStyle = c.bg;
        ctx.fillRect(0, 0, W, H);

        const angleRad = angleDeg * Math.PI / 180;
        const padLeft = 50;
        const padRight = 30;
        const padTop = 45;
        const padBottom = 40;
        const availW = W - padLeft - padRight;
        const availH = H - padTop - padBottom;

        // Slope geometry: ramp goes from top-left area down to bottom-right
        // Slope length along surface
        const slopeLen = Math.min(availW * 0.88, availH / Math.sin(angleRad) * 0.82);

        // Pivot point (top of ramp)
        const pivotX = padLeft + availW * 0.08;
        const pivotY = padTop + 10;

        // End point (bottom of ramp)
        const endX = pivotX + slopeLen * Math.cos(angleRad);
        const endY = pivotY + slopeLen * Math.sin(angleRad);

        // Slope thickness (perpendicular)
        const slopeThick = 22;

        // Perpendicular direction (pointing "into" the slope, up-right)
        const perpX = Math.sin(angleRad);
        const perpY = -Math.cos(angleRad);

        // Four corners of the slope polygon (top surface visible)
        const sTopL = { x: pivotX, y: pivotY };
        const sTopR = { x: endX, y: endY };
        const sBotR = { x: endX + perpX * slopeThick, y: endY + perpY * slopeThick };
        const sBotL = { x: pivotX + perpX * slopeThick, y: pivotY + perpY * slopeThick };

        // --- Ground line ---
        ctx.beginPath();
        ctx.moveTo(padLeft * 0.5, endY + slopeThick * Math.abs(perpY) + 18);
        ctx.lineTo(W - padRight * 0.5, endY + slopeThick * Math.abs(perpY) + 18);
        ctx.strokeStyle = c.groundStroke;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Hatch marks under ground
        for (let gx = padLeft * 0.5 + 8; gx < W - padRight * 0.5; gx += 14) {
            ctx.beginPath();
            ctx.moveTo(gx, endY + slopeThick * Math.abs(perpY) + 18);
            ctx.lineTo(gx - 7, endY + slopeThick * Math.abs(perpY) + 28);
            ctx.strokeStyle = c.groundStroke;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // --- Slope body (filled polygon) ---
        ctx.beginPath();
        ctx.moveTo(sTopL.x, sTopL.y);
        ctx.lineTo(sTopR.x, sTopR.y);
        ctx.lineTo(sBotR.x, sBotR.y);
        ctx.lineTo(sBotL.x, sBotL.y);
        ctx.closePath();
        ctx.fillStyle = c.slopeFill;
        ctx.fill();
        ctx.strokeStyle = c.slopeStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Slope top surface highlight
        ctx.beginPath();
        ctx.moveTo(sTopL.x, sTopL.y);
        ctx.lineTo(sTopR.x, sTopR.y);
        ctx.strokeStyle = c.slopeSurface;
        ctx.lineWidth = 3;
        ctx.stroke();

        // --- Angle arc at pivot ---
        const arcRadius = 32;
        ctx.beginPath();
        ctx.moveTo(pivotX + arcRadius, pivotY);
        ctx.arc(pivotX, pivotY, arcRadius, 0, angleRad, false);
        ctx.strokeStyle = c.angleArc;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Angle label
        const labelAngle = angleDeg > 20 ? angleDeg * 0.52 : angleDeg * 0.62;
        const labelR = arcRadius + 14;
        ctx.font = 'bold 12px -apple-system, "Segoe UI", sans-serif';
        ctx.fillStyle = c.angleText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(angleDeg + '°', pivotX + labelR * Math.cos(labelAngle * Math.PI / 180), pivotY + labelR * Math.sin(labelAngle * Math.PI / 180));

        // Horizontal dashed reference line
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(pivotX + 48, pivotY);
        ctx.strokeStyle = c.grid;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // === BLOCK POSITION ===
        // Progress: 0 → at top, 1 → at bottom
        const progress = Math.max(0, Math.min(1, displayDisp / maxDisplacement));
        const blockCenterDist = progress * slopeLen;

        // Block center on slope surface
        const bcx = pivotX + blockCenterDist * Math.cos(angleRad);
        const bcy = pivotY + blockCenterDist * Math.sin(angleRad);

        // Block dimensions
        const blockW = 28;
        const blockH = 18;

        // Offset block so its bottom-center sits on the slope surface
        // The block's bottom-center is offset by half-width along slope and half-height perpendicular into slope
        const offsetX = (blockW / 2) * Math.cos(angleRad);
        const offsetY = (blockW / 2) * Math.sin(angleRad);
        const offPx = (blockH / 2) * Math.sin(angleRad);  // perpendicular component from height... actually we need proper rotation

        // Simpler approach: position block center slightly above the slope
        // Normal vector pointing UP from slope surface
        const nx = -Math.sin(angleRad);
        const ny = Math.cos(angleRad);

        // Block center: on surface + normal * halfHeight
        const blkCx = bcx + nx * (blockH / 2 + 1);
        const blkCy = bcy + ny * (blockH / 2 + 1);

        // Save context for rotation
        ctx.save();
        ctx.translate(blkCx, blkCy);
        ctx.rotate(angleRad);

        // Block shadow
        ctx.fillStyle = c.shadowColor;
        ctx.fillRect(-blockW / 2 + 3, -blockH + 3, blockW, blockH);

        // Block gradient
        const grad = ctx.createLinearGradient(-blockW / 2, -blockH, blockW / 2, 0);
        grad.addColorStop(0, c.blockGradStart);
        grad.addColorStop(1, c.blockGradEnd);
        ctx.fillStyle = grad;
        ctx.beginPath();
        roundRect(ctx, -blockW / 2, -blockH, blockW, blockH, 4);
        ctx.fill();
        ctx.strokeStyle = c.blockStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Block shine highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        roundRect(ctx, -blockW / 2 + 2, -blockH + 2, blockW - 4, blockH * 0.35, 2);
        ctx.fill();

        ctx.restore();

        // === Velocity Vector Arrow ===
        const velScale = 0.06; // pixels per (mm/s), capped
        const velMag = Math.min(displayVel * velScale, 55);
        if (velMag > 3) {
            // Arrow starts from block front edge, points down the slope
            const arrowBaseX = blkCx + (blockW / 2 + 2) * Math.cos(angleRad);
            const arrowBaseY = blkCy + (blockW / 2 + 2) * Math.sin(angleRad);
            const arrowTipX = arrowBaseX + velMag * Math.cos(angleRad);
            const arrowTipY = arrowBaseY + velMag * Math.sin(angleRad);

            // Arrow shaft
            ctx.beginPath();
            ctx.moveTo(arrowBaseX, arrowBaseY);
            ctx.lineTo(arrowTipX, arrowTipY);
            ctx.strokeStyle = c.velArrow;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Arrow head
            const headLen = 7 + Math.min(velMag * 0.08, 4);
            const headAngle = 0.45;
            ctx.beginPath();
            ctx.moveTo(arrowTipX, arrowTipY);
            ctx.lineTo(
                arrowTipX - headLen * Math.cos(angleRad - headAngle),
                arrowTipY - headLen * Math.sin(angleRad - headAngle)
            );
            ctx.moveTo(arrowTipX, arrowTipY);
            ctx.lineTo(
                arrowTipX - headLen * Math.cos(angleRad + headAngle),
                arrowTipY - headLen * Math.sin(angleRad + headAngle)
            );
            ctx.strokeStyle = c.velArrow;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Velocity value label near arrow
            ctx.font = 'bold 10px "Courier New", monospace';
            ctx.fillStyle = c.velArrow;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            const vLabelX = arrowBaseX + (velMag * 0.5 + 6) * Math.cos(angleRad);
            const vLabelY = arrowBaseY + (velMag * 0.5 + 6) * Math.sin(angleRad);
            ctx.fillText(displayVel.toFixed(0), vLabelX, vLabelY - 2);
        }

        // === Displacement indicator (dashed line showing traveled distance) ===
        if (progress > 0.02) {
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            // Line parallel to slope, below surface, showing displacement
            const dOffset = slopeThick * 0.7;
            ctx.moveTo(sTopL.x + perpX * dOffset, sTopL.y + perpY * dOffset);
            const dProgressX = sTopL.x + perpX * dOffset + progress * slopeLen * Math.cos(angleRad);
            const dProgressY = sTopL.y + perpY * dOffset + progress * slopeLen * Math.sin(angleRad);
            ctx.lineTo(dProgressX, dProgressY);
            ctx.strokeStyle = c.dispLine;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            ctx.setLineDash([]);

            // Displacement text
            if (progress < 0.95) {
                ctx.font = 'bold 10px "Courier New", monospace';
                ctx.fillStyle = c.dispText;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Position text below the displacement line
                const txtX = dProgressX - perpX * 8;
                const txtY = dProgressY - perpY * 8;
                
                // Background pill for readability
                const txtStr = displayDisp.toFixed(0) + 'mm';
                const tw = ctx.measureText(txtStr).width;
                ctx.fillStyle = isDarkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)';
                roundRect(ctx, txtX - tw/2 - 4, txtY - 7, tw + 8, 14, 4);
                ctx.fill();
                ctx.fillStyle = c.dispText;
                ctx.fillText(txtStr, txtX, txtY + 1);
            }
        }

        // === Info overlay (top-right corner of canvas) ===
        ctx.font = '10px -apple-system, "Segoe UI", sans-serif';
        ctx.fillStyle = c.textMuted;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('t=' + currentTime.toFixed(2) + 's', W - 8, 6);

        // Max distance marker at end
        ctx.font = '9px "Courier New", monospace';
        ctx.fillStyle = c.textMuted;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(maxDisplacement + 'mm', sBotR.x + 4, sBotR.y + 4);
    }

    function roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ========== Animation Loop ==========
    function animate() {
        // Smooth interpolation toward target values
        const smoothing = 0.15;
        displayDisp += (currentDisplacement - displayDisp) * smoothing;
        displayVel += (currentVelocity - displayVel) * smoothing;

        drawScene();
        animFrameId = requestAnimationFrame(animate);
    }

    // ========== Public API ==========
    function setDisplacement(disp, time, vel, acc) {
        currentDisplacement = disp;
        currentTime = time;
        currentVelocity = vel;
        currentAcceleration = acc;
        // Auto-expand max if needed
        if (disp > maxDisplacement && disp < 10000) {
            maxDisplacement = Math.ceil(disp / 100) * 100; // Round up to nearest 100
        }
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
        maxDisplacement = 2000;
    }

    function setDarkMode(dark) {
        isDarkMode = dark;
    }

    // ========== Init ==========
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Watch theme changes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
            if (m.attributeName === 'data-theme') {
                isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });

    // Initial theme detection
    isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

    // Start loop
    animate();

    // Expose globally
    window.inclineAnimation = {
        setData: setDisplacement,
        setAngle: setAngle,
        reset: resetAnimation,
        setDarkMode: setDarkMode
    };

})();
