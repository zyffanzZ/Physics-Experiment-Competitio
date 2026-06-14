// api.js - 后端 API 通信层
document.addEventListener('DOMContentLoaded', function() {
    let isSimulating = false;
    
    async function sendToAgent(sessionId, message) {
        try {
            const response = await fetch(`/agent/chat?sessionId=${sessionId}&message=${encodeURIComponent(message)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (error) {
            console.error('Agent API error:', error);
            throw error;
        }
    }
    
    async function getSessionHistory(sessionId) {
        try {
            const response = await fetch(`/agent/session/${sessionId}/history`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('History API error:', error);
            throw error;
        }
    }
    
    async function clearSession(sessionId) {
        try {
            const response = await fetch(`/agent/session/${sessionId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return true;
        } catch (error) {
            console.error('Clear session error:', error);
            throw error;
        }
    }
    
    let hardwarePollInterval = null;

    let simEndCount = 0;
    let simHasTriggeredEnd = false;

    function generateSimulationReport() {
        const angle = document.getElementById('angleSelect')?.value || '30';
        return '\u3010\u6a21\u62df\u5b9e\u9a8c\u7ed3\u9898\u62a5\u544a\u3011\n\n' +
            '\u4e00\u3001\u5b9e\u9a8c\u53c2\u6570\n' +
            '- \u659c\u9762\u89d2\u5ea6\uff1a' + angle + '\u00b0\n' +
            '- \u6ed1\u5757\u8d28\u91cf\uff1a30g\n' +
            '- \u8f68\u9053\u957f\u5ea6\uff1a2000mm\n' +
            '- \u78c1\u573a\u5f3a\u5ea6 B\uff1a0.5T\n' +
            '- \u57ab\u677f\u539a\u5ea6 d\uff1a0.02m\n' +
            '- \u6709\u6548\u63a5\u89e6\u9762\u79ef A\uff1a2\u00d710\u207b\u2075 m\u00b2\n\n' +
            '\u4e8c\u3001\u5b9e\u9a8c\u6570\u636e\n' +
            '- \u603b\u4f4d\u79fb\uff1a2000.00mm\n' +
            '- \u603b\u65f6\u95f4\uff1a2.30s\n' +
            '- \u7ec8\u7aef\u901f\u5ea6\uff1a981.00mm/s\n' +
            '- \u5e73\u5747\u52a0\u901f\u5ea6\uff1a436.00mm/s\u00b2\n\n' +
            '\u4e09\u3001\u7535\u5bfc\u7387\u63a8\u5bfc\n' +
            '\u65b0\u7269\u7406\u6a21\u578b\uff08\u4e09\u9636\u6bb5\u5206\u6790\uff09\uff1a\n' +
            '\u2460 \u91ca\u653e\u77ac\u95f4\uff08v=0\uff09\uff1ama\u2080 = mg\u00b7sin\u03b8 \u2212 f_k\n' +
            '\u2461 \u5300\u901f\u9636\u6bb5\uff08a=0\uff09\uff1aF_\u963b\u5c3c(v\u221e) = ma\u2080\n' +
            '\u2462 \u695e\u6b21\u5b9a\u5f8b\uff1aF_\u963b\u5c3c = \u03c3\u00b7B\u00b2\u00b7d\u00b7A\u00b7v\n' +
            '\u2463 \u6700\u7ec8\u516c\u5f0f\uff1a\u03c3 = m\u00b7a\u2080 / (B\u00b2\u00b7d\u00b7A\u00b7v\u221e)\n\n' +
            '\u5df2\u77e5\u6761\u4ef6\uff1a\n' +
            '- m = 0.03kg, g = 9.81m/s\u00b2, \u03b8 = ' + angle + '\u00b0\n' +
            '- a\u2080 = g\u00b7sin\u03b8 = 4905mm/s\u00b2\n' +
            '- B = 0.5T, d = 0.02m, A = 2\u00d710\u207b\u2075m\u00b2\n' +
            '- v\u221e = 0.981m/s\n\n' +
            '\u53cd\u63a8\u7535\u5bfc\u7387\uff1a\n' +
            '\u03c3 = m\u00b7a\u2080 / (B\u00b2\u00b7d\u00b7A\u00b7v\u221e)\n' +
            '    = (0.03 \u00d7 4.905) / (0.5\u00b2 \u00d7 0.02 \u00d7 2\u00d710\u207b\u2075 \u00d7 0.981)\n' +
            '    = 0.14715 / (9.81\u00d710\u207b\u2078)\n' +
            '    \u2248 1.50 \u00d7 10\u2076 S/m\n\n' +
            '\u56db\u3001\u6750\u8d28\u5224\u5b9a\n' +
            '\u5bf9\u7167\u5e38\u89c1\u91d1\u5c5e\u7535\u5bfc\u7387\u8868\uff1a\n' +
            '- \u4e0d\u9508\u94a2 304\uff1a\u03c3 \u2248 1.45 \u00d7 10\u2076 S/m \u2713\n' +
            '- \u94c5\uff1a\u03c3 \u2248 4.55 \u00d7 10\u2076 S/m \u2717\n' +
            '- \u950c\uff1a\u03c3 \u2248 1.69 \u00d7 10\u2077 S/m \u2717\n' +
            '- \u94dd\uff1a\u03c3 \u2248 3.50 \u00d7 10\u2077 S/m \u2717\n\n' +
            '\u8ba1\u7b97\u503c 1.50\u00d710\u2076 S/m \u4e0e\u4e0d\u9508\u94a2 304\u7684\u6807\u51c6\u7535\u5bfc\u7387 1.45\u00d710\u2076 S/m \u5904\u4e8e\u540c\u4e00\u6570\u91cf\u7ea7\uff0c\u5728\u5141\u8bb8\u8bef\u5dee\u8303\u56f4\u5185\u3002\n\n' +
            '\u7ed3\u8bba\uff1a\u68c0\u6d4b\u6750\u6599\u4e3a \u4e0d\u9508\u94a2 304\uff08Stainless Steel 304\uff09\n\n' +
            '\u6ce8\uff1a\u672c\u62a5\u544a\u57fa\u4e8e\u6807\u51c6\u6a21\u62df\u6570\u636e\u751f\u6210\uff0c\u4ec5\u7528\u4e8e\u529f\u80fd\u6f14\u793a\u3002\u5b9e\u9645\u5b9e\u9a8c\u8bf7\u4f7f\u7528\u771f\u5b9e\u4f20\u611f\u5668\u6570\u636e\u3002\n\n' +
            '\u5982\u679c\u60a8\u9700\u8981\u5c06\u8fd9\u4efd\u62a5\u544a\u4fdd\u5b58\u5230\u90ae\u7bb1\uff0c\u8bf7\u5728\u4e0b\u65b9\u5bf9\u8bdd\u6846\u4e2d\u76f4\u63a5\u8f93\u5165\u60a8\u7684\u90ae\u7bb1\u5730\u5740\uff0c\u7cfb\u7edf\u5c06\u81ea\u52a8\u4e3a\u60a8\u53d1\u9001\u3002';
    }
    window.generateSimulationReport = generateSimulationReport;

    function triggerSimulationEnd() {
        if (simHasTriggeredEnd) return;
        simHasTriggeredEnd = true;

        // ① pollActive=false → 封锁所有飞行中轮询，停止更新图表
        window.pollActive = false;

        // ② clearInterval → 停止定时器
        window.stopHardwarePolling();

        if (window.setSimulating) window.setSimulating(false);
        if (window.stopExperimentApi) window.stopExperimentApi();

        // ③ 等待 300ms → 确保所有飞行请求落地
        setTimeout(async () => {
            try {
                // ④ fetch(/api/sensor/list) → 获取全部数据点
                const response = await fetch('/api/sensor/list');
                if (!response.ok) throw new Error('Failed to fetch sensor list');
                const dataPoints = await response.json();

                if (!dataPoints || dataPoints.length === 0) {
                    window.addMessage('\u6a21\u62df\u5b9e\u9a8c\u5b8c\u6210\uff0c\u4f46\u672a\u83b7\u53d6\u5230\u6570\u636e\u3002', false);
                    window.pollActive = true;
                    restoreButtons();
                    return;
                }

                // ⑤ resetCharts() + 逐点回放 → 确保完整渲染
                window.resetCharts();

                // 逐点回放所有数据点
                dataPoints.forEach(function (point) {
                    window.updateCharts(
                        point.time,
                        point.displacement,
                        point.velocity,
                        point.acceleration
                    );
                });

                window.addMessage('\u6a21\u62df\u5b9e\u9a8c\u5b8c\u6210\u3002\u6570\u636e\u5df2\u52a0\u8f7d\u5b8c\u6bd5\uff08\u5171' + dataPoints.length + '\u4e2a\u6570\u636e\u70b9\uff09\u3002', false);

                // Auto-trigger report for simulation mode
                window.addMessage('\u6b63\u5728\u81ea\u52a8\u751f\u6210\u7ed3\u9898\u62a5\u544a...', false);
                const simReport = generateSimulationReport();
                if (window.lastAiResponse !== undefined && typeof window.lastAiResponse === 'string') {
                    // via setter in main.js
                    window.lastAiResponse = simReport;
                } else {
                    window._lastAiResponse = simReport;
                }
                window.addMessage(simReport, false);

                window.pollActive = true;
                restoreButtons();
            } catch (e) {
                console.error('Simulation end replay error:', e);
                window.addMessage('\u6a21\u62df\u5b9e\u9a8c\u5b8c\u6210\u3002\u6570\u636e\u5df2\u52a0\u8f7d\u5b8c\u6bd5\u3002', false);
                window.pollActive = true;
                restoreButtons();
            }
        }, 300);

        function restoreButtons() {
            const btn = document.getElementById('simulateDataBtn');
            if (btn) btn.disabled = false;
            const sBtn = document.getElementById('startExperimentBtn');
            if (sBtn) sBtn.disabled = false;
            const mBtn = document.getElementById('mobileSimulateBtn');
            if (mBtn) mBtn.disabled = false;
        }
    }

    async function fetchLatestSensorData() {
        // pollActive=false → 封锁飞行中轮询
        if (window.pollActive === false) return;

        try {
            const response = await fetch('/api/sensor/latest');
            if (response.status === 204) {
                if (window.getIsSimulating && window.getIsSimulating()) {
                    simEndCount++;
                    if (simEndCount >= 5) triggerSimulationEnd();
                }
                return;
            }
            simEndCount = 0;
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            window.updateCharts(data.time, data.displacement, data.velocity, data.acceleration);
            // Direct triggers: status=FINISHED flag OR displacement >= 2000mm OR velocity=0 after motion
            if (window.getIsSimulating && window.getIsSimulating()) {
                const disp = parseFloat(data.displacement);
                const vel = parseFloat(data.velocity);
                const t = parseFloat(data.time);
                if (data.status === 'FINISHED' || disp >= 1999 || (vel === 0 && t > 0.1)) {
                    triggerSimulationEnd();
                }
            }
        } catch (error) {
            console.warn('Sensor data poll failed:', error.message);
        }
    }

    function startHardwarePolling() {
        stopHardwarePolling();
        window.pollActive = true;
        simEndCount = 0;
        simHasTriggeredEnd = false;
        window.resetCharts();
        fetchLatestSensorData();
        hardwarePollInterval = setInterval(fetchLatestSensorData, 150);
    }

    function stopHardwarePolling() {
        if (hardwarePollInterval) {
            clearInterval(hardwarePollInterval);
            hardwarePollInterval = null;
        }
    }

    async function clearSensorData() {
        try {
            const response = await fetch('/api/sensor/clear', { method: 'POST' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            console.warn('Clear sensor data failed:', error.message);
        }
    }

    async function startExperimentApi() {
        try {
            await fetch('/api/experiment/start', { method: 'POST' });
        } catch (e) {
            console.warn('Start experiment API call failed:', e);
        }
    }

    async function stopExperimentApi() {
        try {
            await fetch('/api/experiment/stop', { method: 'POST' });
        } catch (e) {
            console.warn('Stop experiment API call failed:', e);
        }
    }
    
    async function sendExperimentData(sessionId, data) {
        try {
            const response = await fetch('/api/experiment/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, data })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (error) {
            console.error('Experiment data sync error:', error);
        }
    }

    let deviceStatusInterval = null;

    async function checkDeviceStatus() {
        try {
            const response = await fetch('/api/device/status?deviceId=esp8266');
            if (!response.ok) return;
            const data = await response.json();
            if (window.updateDeviceStatus) {
                window.updateDeviceStatus(data.online);
            }
        } catch (e) {
            if (window.updateDeviceStatus) window.updateDeviceStatus(false);
        }
    }

    function startDeviceStatusPolling() {
        stopDeviceStatusPolling();
        checkDeviceStatus();
        deviceStatusInterval = setInterval(checkDeviceStatus, 3000);
    }

    function stopDeviceStatusPolling() {
        if (deviceStatusInterval) {
            clearInterval(deviceStatusInterval);
            deviceStatusInterval = null;
        }
    }

    async function clearAllDataApi(sessionId) {
        try {
            await fetch('/api/experiment/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
        } catch (e) {
            console.warn('Clear all data API call failed:', e);
        }
    }

    async function disconnectDeviceApi() {
        try {
            await fetch('/api/device/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'esp8266' }) });
        } catch (e) {
            console.warn('Disconnect API call failed:', e);
        }
    }

    async function startSimulationApi() {
        try {
            await fetch('/api/simulation/start', { method: 'POST' });
        } catch (e) {
            console.warn('Start simulation API call failed:', e);
        }
    }

    async function stopSimulationApi() {
        try {
            await fetch('/api/simulation/stop', { method: 'POST' });
        } catch (e) {
            console.warn('Stop simulation API call failed:', e);
        }
    }

    async function sendMail(email, content) {
        try {
            const response = await fetch('/api/mail/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, content })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (error) {
            console.error('Mail API error:', error);
            throw error;
        }
    }

    async function setExperimentAngle(angle) {
        try {
            await fetch('/api/experiment/angle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ angle: parseFloat(angle) })
            });
        } catch (e) {
            console.warn('Set angle API call failed:', e);
        }
    }
    window.setExperimentAngle = setExperimentAngle;

    window.startHardwarePolling = startHardwarePolling;
    window.stopHardwarePolling = stopHardwarePolling;
    window.clearSensorData = clearSensorData;
    window.startExperimentApi = startExperimentApi;
    window.stopExperimentApi = stopExperimentApi;
    window.sendToAgent = sendToAgent;
    window.getSessionHistory = getSessionHistory;
    window.clearSession = clearSession;
    window.sendMail = sendMail;
    window.sendExperimentData = sendExperimentData;
    window.startDeviceStatusPolling = startDeviceStatusPolling;
    window.stopDeviceStatusPolling = stopDeviceStatusPolling;
    window.clearAllDataApi = clearAllDataApi;
    window.disconnectDeviceApi = disconnectDeviceApi;
    window.startSimulationApi = startSimulationApi;
    window.stopSimulationApi = stopSimulationApi;
    window.setSimulating = function(v) { isSimulating = v; };
    window.getIsSimulating = function() { return isSimulating; };
});