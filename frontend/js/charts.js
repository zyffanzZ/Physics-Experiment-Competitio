document.addEventListener('DOMContentLoaded', function() {
    const charts = {};
    // Charts canvas-id → Chart instance map for fullscreen zoom
    window._chartsMap = window._chartsMap || {};
    let timeData = [];
    let displacementData = [];
    let velocityData = [];
    let accelerationData = [];
    const MAX_DATA_POINTS = 50;

    const MASS = 0.03;
    const G = 9.81;
    const LENGTH = 2.0;
    const THETA = Math.PI / 6;

    function calcEnergy(dispMm, velMm_s) {
        const s = dispMm / 1000;
        const v = velMm_s / 1000;
        const ep = MASS * G * (LENGTH - s) * Math.sin(THETA);
        const ek = 0.5 * MASS * v * v;
        const total = MASS * G * LENGTH * Math.sin(THETA);
        const internal = Math.max(0, total - ep - ek);
        return { ep, ek, internal, total };
    }

    const BAR_COLORS = ['rgba(243,156,18,0.8)', 'rgba(46,204,113,0.8)'];

    const chartDefs = {
        displacement: {
            canvasId: 'displacementChart', itemClass: 'chart-item-displacement', visible: true,
            create: function(ctx) {
                return new Chart(ctx, {
                    type: 'line',
                    data: { labels: timeData, datasets: [{ label: '位移 (mm)', data: displacementData, borderColor: '#3498db', backgroundColor: 'rgba(52,152,219,0.1)', tension: 0.3, fill: true }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true, position: 'top' } } }
                });
            }
        },
        velocity: {
            canvasId: 'velocityChart', itemClass: 'chart-item-velocity', visible: true,
            create: function(ctx) {
                return new Chart(ctx, {
                    type: 'line',
                    data: { labels: timeData, datasets: [{ label: '速度 (mm/s)', data: velocityData, borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.1)', tension: 0.3, fill: true }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true, position: 'top' } } }
                });
            }
        },
        acceleration: {
            canvasId: 'accelerationChart', itemClass: 'chart-item-acceleration', visible: true,
            create: function(ctx) {
                return new Chart(ctx, {
                    type: 'line',
                    data: { labels: timeData, datasets: [{ label: '加速度 (mm/s²)', data: accelerationData, borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)', tension: 0.3, fill: true }] },
                    options: { responsive: true, maintainAspectRatio: false, animation: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: true, position: 'top' } } }
                });
            }
        },
        energy: {
            canvasId: 'energyPieChart', itemClass: 'chart-item-energy', visible: true,
            create: function(ctx) {
                return new Chart(ctx, {
                    type: 'pie',
                    data: { labels: ['重力势能', '动能', '内能'], datasets: [{ data: [100, 0, 0], backgroundColor: ['#f39c12', '#2ecc71', '#9b59b6'] }] },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        plugins: {legend: {display: true, position: 'bottom'}}
                    }
                });
            }
        },
        energyBar: {
            canvasId: 'energyBarChart', itemClass: 'chart-item-energybar', visible: true,
            create: function(ctx) {
                return new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['能量 (J)'],
                        datasets: [
                            { label: '势能 Ep', data: [0], backgroundColor: BAR_COLORS[0], borderRadius: 8 },
                            { label: '动能 Ek', data: [0], backgroundColor: BAR_COLORS[1], borderRadius: 8 }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, animation: false,
                        scales: { x: { stacked: false }, y: { beginAtZero: true, title: { display: true, text: '焦耳 (J)' } } },
                        plugins: { legend: { display: true, position: 'top' } }
                    }
                });
            }
        }
    };

    function initCharts() {
        for (const [id, def] of Object.entries(chartDefs)) {
            if (def.visible) createChart(id);
            else hideChartItem(id);
        }
    }

    function createChart(id) {
        const def = chartDefs[id];
        if (!def || charts[id]) return;
        const canvas = document.getElementById(def.canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        showChartItem(id);
        charts[id] = def.create(ctx);
        // Register for fullscreen zoom
        registerChartCanvas(def.canvasId, charts[id]);
    }

    function destroyChart(id) {
        if (charts[id]) { charts[id].destroy(); charts[id] = null; }
        unregisterChartCanvas(chartDefs[id].canvasId);
        hideChartItem(id);
    }

    function registerChartCanvas(canvasId, chart) {
        if (window._chartsMap) {
            window._chartsMap[canvasId] = chart;
        }
    }

    function unregisterChartCanvas(canvasId) {
        if (window._chartsMap && window._chartsMap[canvasId]) {
            delete window._chartsMap[canvasId];
        }
    }

    function toggleChart(id, visible) {
        const def = chartDefs[id];
        if (!def) return;
        def.visible = visible;
        if (visible) createChart(id);
        else destroyChart(id);
    }

    function showChartItem(id) {
        document.querySelectorAll('.' + chartDefs[id].itemClass).forEach(el => el.classList.remove('hidden'));
    }

    function hideChartItem(id) {
        document.querySelectorAll('.' + chartDefs[id].itemClass).forEach(el => el.classList.add('hidden'));
    }

    function updateCharts(time, displacement, velocity, acceleration) {
        timeData.push(parseFloat(time).toFixed(3));
        displacementData.push(parseFloat(displacement).toFixed(3));
        velocityData.push(parseFloat(velocity).toFixed(3));
        accelerationData.push(parseFloat(acceleration).toFixed(3));

        if (timeData.length > MAX_DATA_POINTS) {
            timeData.shift(); displacementData.shift(); velocityData.shift(); accelerationData.shift();
        }

        const lineIds = ['displacement', 'velocity', 'acceleration'];
        for (const id of lineIds) {
            if (charts[id]) {
                charts[id].data.labels = timeData;
                charts[id].data.datasets[0].data = id === 'displacement' ? displacementData : id === 'velocity' ? velocityData : accelerationData;
                charts[id].update();
            }
        }

        document.getElementById('displacementValue').textContent = parseFloat(displacement).toFixed(2);
        document.getElementById('timeValue').textContent = parseFloat(time).toFixed(2);
        document.getElementById('velocityValue').textContent = parseFloat(velocity).toFixed(2);
        document.getElementById('accelerationValue').textContent = parseFloat(acceleration).toFixed(2);

        // Compute energy from physical formula and update charts
        const energy = calcEnergy(displacement, velocity);
        if (charts.energy) {
            charts.energy.data.datasets[0].data = [
                Math.max(0, energy.ep), Math.max(0, energy.ek), Math.max(0, energy.internal)
            ];
            charts.energy.update();
        }
        if (charts.energyBar) {
            charts.energyBar.data.datasets[0].data = [Math.max(0, energy.ep)];
            charts.energyBar.data.datasets[1].data = [Math.max(0, energy.ek)];
            charts.energyBar.update();
        }
    }

    function resetCharts() {
        timeData = []; displacementData = []; velocityData = []; accelerationData = [];
        const lineIds = ['displacement', 'velocity', 'acceleration'];
        for (const id of lineIds) {
            if (charts[id]) {
                charts[id].data.labels = timeData;
                charts[id].data.datasets[0].data = [];
                charts[id].update();
            }
        }
        if (charts.energy) {
            charts.energy.data.datasets[0].data = [100, 0, 0];
            charts.energy.update();
        }
        if (charts.energyBar) {
            charts.energyBar.data.datasets[0].data = [0];
            charts.energyBar.data.datasets[1].data = [0];
            charts.energyBar.update();
        }
        document.getElementById('displacementValue').textContent = '0.00';
        document.getElementById('timeValue').textContent = '0.00';
        document.getElementById('velocityValue').textContent = '0.00';
        document.getElementById('accelerationValue').textContent = '0.00';
    }

    window.initCharts = initCharts;
    window.updateCharts = updateCharts;
    window.resetCharts = resetCharts;
    window.toggleChart = toggleChart;

    window.addEventListener('resize', function() {
        for (const [id, chart] of Object.entries(charts)) {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        }
    });

    initCharts();
});
