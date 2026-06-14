// main.js - UI 交互逻辑
document.addEventListener('DOMContentLoaded', function() {
    const connectionStatus = document.getElementById('connectionStatus');
    const userInput = document.getElementById('userInput');
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    const chatMessages = document.getElementById('chatMessages');
    const startExperimentBtn = document.getElementById('startExperimentBtn');
    const stopExperimentBtn = document.getElementById('stopExperimentBtn');
    const simulateDataBtn = document.getElementById('simulateDataBtn');
    const clearDataBtn = document.getElementById('clearDataBtn');
    const panelResizer = document.getElementById('panelResizer');
    const leftPanel = document.getElementById('aiAssistantPanel');
    const chartToggleBtn = document.getElementById('chartToggleBtn');
    const chartDropdown = document.getElementById('chartDropdown');
    
    // Mobile action buttons
    const mobileSimulateBtn = document.getElementById('mobileSimulateBtn');
    const mobileClearBtn = document.getElementById('mobileClearBtn');
    
    let isExperimentRunning = false;
    let experimentSource = null; // 'hardware' | 'simulation'
    let sessionId = generateSessionId();
    
    updateConnectionStatus('disconnected');
    
    sendMessageBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    startExperimentBtn.addEventListener('click', startExperiment);
    stopExperimentBtn.addEventListener('click', stopExperiment);
    simulateDataBtn.addEventListener('click', simulateData);
    clearDataBtn.addEventListener('click', clearAllData);
    
    // Mobile button event bindings
    mobileSimulateBtn.addEventListener('click', simulateData);
    mobileClearBtn.addEventListener('click', clearAllData);
    
    // ===== Resizable Split Pane =====
    let isResizing = false;
    
    panelResizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        document.body.classList.add('is-resizing');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        const container = document.querySelector('.two-panel-layout');
        const containerRect = container.getBoundingClientRect();
        const resizerWidth = panelResizer.offsetWidth;
        let leftWidth = e.clientX - containerRect.left;
        leftWidth -= resizerWidth / 2;
        const maxWidth = containerRect.width * 0.65;
        leftWidth = Math.max(300, Math.min(leftWidth, maxWidth));
        leftPanel.style.width = leftWidth + 'px';
    });
    
    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            document.body.classList.remove('is-resizing');
        }
    });
    
    // ===== Chart Selector Dropdown =====
    chartToggleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        chartDropdown.classList.toggle('open');
        chartToggleBtn.classList.toggle('active');
    });
    
    chartDropdown.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    document.addEventListener('click', function() {
        chartDropdown.classList.remove('open');
        chartToggleBtn.classList.remove('active');
    });
    
    // Chart checkbox toggle
    chartDropdown.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
            const chartId = e.target.dataset.chart;
            if (window.toggleChart) {
                window.toggleChart(chartId, e.target.checked);
            }
        }
    });
    
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    }
    
    const deviceStatus = document.getElementById('deviceStatus');
    const deviceDot = document.getElementById('deviceDot');
    const deviceStatusText = document.getElementById('deviceStatusText');

    function updateDeviceStatus(online) {
        const simHintBanner = document.getElementById('simHintBanner');
        if (online) {
            deviceStatus.classList.add('online');
            deviceStatusText.textContent = '● 终端已在线';
            connectionStatus.textContent = '断开终端';
            connectionStatus.classList.add('online');
            if (simHintBanner) simHintBanner.classList.add('hidden');
        } else {
            deviceStatus.classList.remove('online');
            deviceStatusText.textContent = '● 终端未连接';
            connectionStatus.textContent = '检测终端';
            connectionStatus.classList.remove('online');
            if (simHintBanner) simHintBanner.classList.remove('hidden');
        }
    }

    // Connect button click: disconnect if online, re-check if offline
    connectionStatus.addEventListener('click', function() {
        if (connectionStatus.classList.contains('online')) {
            if (window.disconnectDeviceApi) {
                window.disconnectDeviceApi();
                updateDeviceStatus(false);
            }
        } else {
            if (window.startDeviceStatusPolling) {
                window.startDeviceStatusPolling();
            }
        }
    });

    // Start device status polling
    if (window.startDeviceStatusPolling) {
        window.startDeviceStatusPolling();
    }

    function updateConnectionStatus(status) {
        // No longer used — button repurposed as device action
    }
    
    function addMessage(content, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + (isUser ? 'user-message' : 'ai-message');
        let html = escapeHtml(content);
        if (!isUser) {
            // Highlight mail hint in AI messages
            const mailHintRegex = /(如果您需要将这份报告保存到邮箱，请在下方对话框中直接输入您的邮箱地址，系统将自动为您发送。)/g;
            html = html.replace(mailHintRegex, '<span class="mail-highlight">$1</span>');
        }
        messageDiv.innerHTML = '<p>' + html + '</p>';
        chatMessages.appendChild(messageDiv);
        // Scroll the outer chat container (not inner messages div)
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    function escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }
    
    let lastAiResponse = '';

    function isEmail(str) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
    }

    function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Guard: report request requires experiment data
        if (message === '\u7ed3\u9898\u62a5\u544a') {
            const displacement = parseFloat(document.getElementById('displacementValue').textContent);
            if (displacement <= 0 || isNaN(displacement)) {
                addMessage('\u26a0\ufe0f \u6682\u65e0\u5b9e\u9a8c\u6570\u636e\u3002\u8bf7\u5148\u70b9\u51fb\u4e0b\u65b9\u300c\u5f00\u59cb\u5b9e\u9a8c\u300d\u8fdb\u884c\u771f\u5b9e\u6d4b\u91cf\uff0c\u6216\u4f7f\u7528\u300c\u4f7f\u7528\u6807\u51c6\u6570\u636e\u6a21\u62df\u300d\u529f\u80fd\u751f\u6210\u6570\u636e\u540e\uff0c\u518d\u751f\u6210\u7ed3\u9898\u62a5\u544a\u3002', false);
                userInput.value = '';
                return;
            }
            // Simulation mode: show fixed template
            if (experimentSource === 'simulation') {
                const angle = document.getElementById('angleSelect').value || '30';
                const simReport =
                    '\u3010\u6a21\u62df\u5b9e\u9a8c\u7ed3\u9898\u62a5\u544a\u3011\n\n' +
                    '\u5b9e\u9a8c\u53c2\u6570\uff1a\n' +
                    '- \u659c\u9762\u89d2\u5ea6\uff1a' + angle + '\u00b0\n' +
                    '- \u6ed1\u5757\u8d28\u91cf\uff1a30g\n' +
                    '- \u8f68\u9053\u957f\u5ea6\uff1a2000mm\n\n' +
                    '\u5b9e\u9a8c\u7ed3\u679c\uff1a\n' +
                    '- \u603b\u4f4d\u79fb\uff1a2000.00mm\n' +
                    '- \u603b\u65f6\u95f4\uff1a2.30s\n' +
                    '- \u7ec8\u7aef\u901f\u5ea6\uff1a981.00mm/s\n' +
                    '- \u5e73\u5747\u52a0\u901f\u5ea6\uff1a436.00mm/s\u00b2\n\n' +
                    '\u7535\u5bfc\u7387\u63a8\u5bfc\uff1a\n' +
                    '\u03c3 = m\u00b7a\u2080 / (B\u00b2\u00b7d\u00b7A\u00b7v\u221e)\n' +
                    '\u03c3 \u2248 1.50\u00d710\u2076 S/m \u2192 \u4e0d\u9508\u94a2 304\n\n' +
                    '\u6ce8\uff1a\u672c\u62a5\u544a\u57fa\u4e8e\u6807\u51c6\u6a21\u62df\u6570\u636e\u751f\u6210\uff0c\u4ec5\u7528\u4e8e\u529f\u80fd\u6f14\u793a\u3002\u5b9e\u9645\u5b9e\u9a8c\u8bf7\u4f7f\u7528\u771f\u5b9e\u4f20\u611f\u5668\u6570\u636e\u3002\n\n' +
                    '\u5982\u679c\u60a8\u9700\u8981\u5c06\u8fd9\u4efd\u62a5\u544a\u4fdd\u5b58\u5230\u90ae\u7bb1\uff0c\u8bf7\u5728\u4e0b\u65b9\u5bf9\u8bdd\u6846\u4e2d\u76f4\u63a5\u8f93\u5165\u60a8\u7684\u90ae\u7bb1\u5730\u5740\uff0c\u7cfb\u7edf\u5c06\u81ea\u52a8\u4e3a\u60a8\u53d1\u9001\u3002';
                addMessage(simReport, false);
                lastAiResponse = simReport;
                userInput.value = '';
                return;
            }
            // Hardware mode: proceed to AI below
        }

        addMessage(message, true);
        userInput.value = '';

        // Email detected → send report via mail API
        if (isEmail(message)) {
            const reportToSend = lastAiResponse || window._lastAiResponse || '';
            if (!reportToSend) {
                addMessage('\u5f53\u524d\u6ca1\u6709\u53ef\u53d1\u9001\u7684\u7ed3\u9898\u62a5\u544a\uff0c\u8bf7\u5148\u751f\u6210\u62a5\u544a\u3002', false);
                return;
            }
            addMessage('\u6b63\u5728\u53d1\u9001\u90ae\u4ef6...', false);
            if (window.sendMail) {
                // Strip the web-only mail hint before sending email
                const mailHintPattern = /\u5982\u679c\u60a8\u9700\u8981\u5c06\u8fd9\u4efd\u62a5\u544a\u4fdd\u5b58\u5230\u90ae\u7bb1.*\u7cfb\u7edf\u5c06\u81ea\u52a8\u4e3a\u60a8\u53d1\u9001\u3002/;
                const emailContent = reportToSend.replace(mailHintPattern, '').trim();
                window.sendMail(message, emailContent)
                    .then(data => {
                        removeTypingIndicator();
                        addMessage(data, false);
                    })
                    .catch(() => {
                        removeTypingIndicator();
                        addMessage('\u90ae\u4ef6\u53d1\u9001\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u90ae\u7bb1\u5730\u5740\u6216\u7a0d\u540e\u91cd\u8bd5\u3002', false);
                    });
            }
            return;
        }

        // Normal message → call AI agent
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) typingIndicator.style.display = 'flex';

        if (window.sendToAgent) {
            window.sendToAgent(sessionId, message)
                .then(data => {
                    removeTypingIndicator();
                    lastAiResponse = data;
                    addMessage(data, false);
                })
                .catch(() => {
                    removeTypingIndicator();
                    addMessage('抱歉，发生了错误。请稍后重试。', false);
                });
        } else {
            fetch(`/agent/chat?sessionId=${sessionId}&message=${encodeURIComponent(message)}`)
                .then(response => response.text())
                .then(data => {
                    removeTypingIndicator();
                    lastAiResponse = data;
                    addMessage(data, false);
                })
                .catch(() => {
                    removeTypingIndicator();
                    addMessage('抱歉，发生了错误。请稍后重试。', false);
                });
        }
    }
    
    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) typingIndicator.style.display = 'none';
        const msgs = chatMessages.children;
        if (msgs.length > 0 && msgs[msgs.length - 1].textContent.includes('正在思考')) {
            chatMessages.removeChild(msgs[msgs.length - 1]);
        }
    }
    
    function startExperiment() {
        isExperimentRunning = true;
        experimentSource = 'hardware';
        startExperimentBtn.disabled = true;
        stopExperimentBtn.disabled = false;
        updateConnectionStatus('connected');
        addMessage('实验已开始。正在收集位移和时间数据...', false);
        if (window.startExperimentApi) window.startExperimentApi();
        if (window.startHardwarePolling) window.startHardwarePolling();
    }

    function stopExperiment() {
        isExperimentRunning = false;
        startExperimentBtn.disabled = false;
        stopExperimentBtn.disabled = true;
        updateConnectionStatus('disconnected');
        addMessage('实验已停止。', false);
        if (window.stopExperimentApi) window.stopExperimentApi();
        if (window.stopHardwarePolling) window.stopHardwarePolling();
    }
    
    function simulateData() {
        experimentSource = 'simulation';
        startExperimentBtn.disabled = true;
        stopExperimentBtn.disabled = true;
        simulateDataBtn.disabled = true;
        mobileSimulateBtn.disabled = true;
        updateConnectionStatus('模拟中');
        addMessage('开始使用标准数据进行模拟实验...', false);
        if (window.setSimulating) window.setSimulating(true);
        if (window.startSimulationApi) window.startSimulationApi();
        if (window.startHardwarePolling) window.startHardwarePolling();
    }

    function clearAllData() {
        if (window.stopHardwarePolling) window.stopHardwarePolling();
        if (window.stopSimulationApi) window.stopSimulationApi();
        if (window.setSimulating) window.setSimulating(false);
        if (window.clearAllDataApi) window.clearAllDataApi(sessionId);

        if (window.resetCharts) window.resetCharts();

        isExperimentRunning = false;
        experimentSource = null;
        startExperimentBtn.disabled = false;
        stopExperimentBtn.disabled = true;
        simulateDataBtn.disabled = false;
        mobileSimulateBtn.disabled = false;
        updateConnectionStatus('disconnected');
        lastAiResponse = '';

        // Force reset displayed values to zero immediately
        document.getElementById('displacementValue').textContent = '0.00';
        document.getElementById('timeValue').textContent = '0.00';
        document.getElementById('velocityValue').textContent = '0.00';
        document.getElementById('accelerationValue').textContent = '0.00';

        addMessage('\u6240\u6709\u6570\u636e\u5df2\u6e05\u7a7a\uff0c\u7cfb\u7edf\u5df2\u91cd\u7f6e\u3002', false);

        // Clear the chat messages except the first welcome message
        while (chatMessages.children.length > 1) {
            chatMessages.removeChild(chatMessages.lastChild);
        }
    }

    window.addMessage = addMessage;
    window.updateConnectionStatus = updateConnectionStatus;
    window.removeTypingIndicator = removeTypingIndicator;
    window.getSessionId = function() { return sessionId; };
    Object.defineProperty(window, 'lastAiResponse', { get: function() { return lastAiResponse; }, set: function(v) { lastAiResponse = v; } });

    // ========== v2.0 New Features ==========

    // 3.1 Dark Mode Toggle
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeToggle) {
        themeToggle.textContent = savedTheme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
        themeToggle.addEventListener('click', function() {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            themeToggle.textContent = next === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
        });
    }

    // 3.2 Changelog Modal
    const changelogBtn = document.getElementById('changelogBtn');
    const changelogModal = document.getElementById('changelogModal');
    const changelogClose = document.getElementById('changelogClose');
    if (changelogBtn && changelogModal && changelogClose) {
        changelogBtn.addEventListener('click', () => changelogModal.classList.add('open'));
        changelogClose.addEventListener('click', () => changelogModal.classList.remove('open'));
        changelogModal.addEventListener('click', (e) => {
            if (e.target === changelogModal) changelogModal.classList.remove('open');
        });
    }

    // 3.3 Quick Action Buttons
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const msg = this.dataset.msg;

            // Report button: check data availability first
            if (msg === '结题报告') {
                const displacement = parseFloat(document.getElementById('displacementValue').textContent);
                if (displacement <= 0 || isNaN(displacement)) {
                    addMessage('\u26a0\ufe0f 暂无实验数据。请先点击下方「开始实验」进行真实测量，或使用「使用标准数据模拟」功能生成数据后，再生成结题报告。', false);
                    return;
                }

                // Simulation mode: show fixed template report
                if (experimentSource === 'simulation') {
                    const simReport = window.generateSimulationReport ? window.generateSimulationReport() : '';
                    addMessage(simReport, false);
                    lastAiResponse = simReport;
                    return;
                }

                // Hardware mode: send to AI as normal
                userInput.value = msg;
                sendMessage();
                return;
            }

            // Other quick actions: send directly
            userInput.value = msg;
            sendMessage();
        });
    });

    // 3.4 Angle Selector
    const angleSelect = document.getElementById('angleSelect');
    if (angleSelect) {
        angleSelect.addEventListener('change', function() {
            const angle = this.value;
            if (window.setExperimentAngle) window.setExperimentAngle(angle);
            addMessage('\u659c\u9762\u89d2\u5ea6\u5df2\u8bbe\u7f6e\u4e3a ' + angle + '\u00b0', false);
        });
    }

    // 3.5 Chart Tab Switching
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const tabName = this.dataset.tab;
            document.querySelectorAll('.chart-tab-content').forEach(c => c.classList.remove('active'));
            const targetContent = document.getElementById('tab-' + tabName);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // 3.6 Export Button
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', function() {
            window.open('/api/export/excel', '_blank');
        });
    }

    // ========== Metal Properties Panel Toggle ==========
    const viewMetalBtn = document.getElementById('viewMetalBtn');
    const metalsBackBtn = document.getElementById('metalsBackBtn');
    const metalsInfoPanel = document.getElementById('metalsInfoPanel');
    const mainVizContent = document.getElementById('mainVizContent');
    const simHintBanner = document.getElementById('simHintBanner');
    const realTimeData = document.querySelector('.real-time-data');
    const controlPanel = document.querySelector('.control-panel');

    function showMetalsPanel() {
        if (metalsInfoPanel) metalsInfoPanel.classList.add('active');
        if (mainVizContent) mainVizContent.style.display = 'none';
        if (simHintBanner) simHintBanner.style.display = 'none';
        if (realTimeData) realTimeData.style.display = 'none';
        if (controlPanel) controlPanel.style.display = 'none';
    }

    function showMainPanel() {
        if (metalsInfoPanel) metalsInfoPanel.classList.remove('active');
        if (mainVizContent) mainVizContent.style.display = '';
        if (simHintBanner) simHintBanner.style.display = '';
        if (realTimeData) realTimeData.style.display = '';
        if (controlPanel) controlPanel.style.display = '';
    }

    if (viewMetalBtn) {
        viewMetalBtn.addEventListener('click', showMetalsPanel);
    }
    if (metalsBackBtn) {
        metalsBackBtn.addEventListener('click', showMainPanel);
    }

    // ========== Metal Click → Detail Modal ==========
    const METAL_DATA = {
        copper: {
            name: '铜', symbol: 'Cu',
            resistivity: '1.68×10⁻⁸', conductivity: '5.96×10⁷', density: '8.96',
            meltingPoint: '1085', boilingPoint: '2562', thermalConductivity: '401',
            youngsModulus: '110–128', crystalStructure: '面心立方 (FCC)',
            tensileStrength: '210–370', magnetic: '抗磁性',
            uses: '电线电缆、电机绕组、印刷电路板(PCB)、换热器、管道系统。因其极高的导电性和导热性，是电气工业最核心的导体材料。'
        },
        aluminum: {
            name: '铝', symbol: 'Al',
            resistivity: '2.65×10⁻⁸', conductivity: '3.50×10⁷', density: '2.70',
            meltingPoint: '660', boilingPoint: '2519', thermalConductivity: '237',
            youngsModulus: '68–70', crystalStructure: '面心立方 (FCC)',
            tensileStrength: '70–700 (合金)', magnetic: '抗磁性',
            uses: '输电线路（轻质高导电）、航空航天结构件、汽车轻量化、食品包装、建筑材料。密度仅为铜的1/3，适合对重量敏感的场景。'
        },
        silver: {
            name: '银', symbol: 'Ag',
            resistivity: '1.59×10⁻⁸', conductivity: '6.30×10⁷', density: '10.49',
            meltingPoint: '961', boilingPoint: '2162', thermalConductivity: '429',
            youngsModulus: '83', crystalStructure: '面心立方 (FCC)',
            tensileStrength: '170', magnetic: '抗磁性',
            uses: '高频连接器、继电器触点、光伏电池电极、医疗抗菌材料。导电率最高的金属，但因成本高主要用于精密电子元器件。'
        },
        gold: {
            name: '金', symbol: 'Au',
            resistivity: '2.44×10⁻⁸', conductivity: '4.10×10⁷', density: '19.32',
            meltingPoint: '1064', boilingPoint: '2856', thermalConductivity: '318',
            youngsModulus: '79', crystalStructure: '面心立方 (FCC)',
            tensileStrength: '120–220', magnetic: '抗磁性',
            uses: '半导体键合线、高级连接器镀层、航天器热控涂层、精密仪器触点。极强抗腐蚀性，在恶劣环境中保持可靠电气连接。'
        },
        iron: {
            name: '铁', symbol: 'Fe',
            resistivity: '9.71×10⁻⁸', conductivity: '1.03×10⁷', density: '7.87',
            meltingPoint: '1538', boilingPoint: '2862', thermalConductivity: '80',
            youngsModulus: '200–211', crystalStructure: '体心立方 (BCC)',
            tensileStrength: '350–690', magnetic: '铁磁性 (居里点770°C)',
            uses: '建筑钢筋、机械铸件、电磁铁芯、汽车车身。最广泛使用的结构金属，纯铁软，加入碳等元素成为钢后强度大幅提升。'
        },
        steel: {
            name: '不锈钢 304', symbol: 'SS304',
            resistivity: '6.90×10⁻⁷', conductivity: '1.45×10⁶', density: '7.93',
            meltingPoint: '1400–1450', boilingPoint: '~2800', thermalConductivity: '16',
            youngsModulus: '193–200', crystalStructure: '面心立方 (FCC)',
            tensileStrength: '515–720', magnetic: '弱磁性（冷加工后增强）',
            uses: '食品加工设备、医疗器械、化学容器、建筑装饰。因其优异的耐腐蚀性和较低电导率，可用于需要一定电阻的结构件。'
        },
        nickel: {
            name: '镍', symbol: 'Ni',
            resistivity: '6.99×10⁻⁸', conductivity: '1.43×10⁷', density: '8.91',
            meltingPoint: '1455', boilingPoint: '2913', thermalConductivity: '91',
            youngsModulus: '200–220', crystalStructure: '面心立方 (FCC)',
            tensileStrength: '450–1000', magnetic: '铁磁性 (居里点358°C)',
            uses: '不锈钢合金元素、电池正极材料、电镀保护层、高温合金。是制造不锈钢和镍氢电池的关键元素。'
        },
        zinc: {
            name: '锌', symbol: 'Zn',
            resistivity: '5.90×10⁻⁸', conductivity: '1.69×10⁷', density: '7.14',
            meltingPoint: '419', boilingPoint: '907', thermalConductivity: '116',
            youngsModulus: '96–108', crystalStructure: '密排六方 (HCP)',
            tensileStrength: '110–200', magnetic: '抗磁性',
            uses: '钢材镀锌防腐（热浸镀锌）、锌合金压铸件、电池负极（锌锰/锌空气电池）。低成本牺牲阳极防腐材料。'
        },
        tin: {
            name: '锡', symbol: 'Sn',
            resistivity: '1.15×10⁻⁷', conductivity: '8.69×10⁶', density: '7.31',
            meltingPoint: '231', boilingPoint: '2602', thermalConductivity: '67',
            youngsModulus: '50', crystalStructure: '四方晶系 (β-Sn)',
            tensileStrength: '15–200', magnetic: '抗磁性',
            uses: '电子焊接材料（SAC305无铅焊料）、马口铁镀层、青铜合金、浮法玻璃制造。低温焊接的关键元素。'
        },
        lead: {
            name: '铅', symbol: 'Pb',
            resistivity: '2.20×10⁻⁷', conductivity: '4.55×10⁶', density: '11.34',
            meltingPoint: '327', boilingPoint: '1749', thermalConductivity: '35',
            youngsModulus: '16', crystalStructure: '面心立方 (FCC)',
            tensileStrength: '12–18', magnetic: '抗磁性',
            uses: '铅酸蓄电池极板、辐射屏蔽材料、电缆护套、声学隔音材料。密度高且柔软，是极佳的防护和储能材料（需注意环保回收）。'
        }
    };

    const metalDetailModal = document.getElementById('metalDetailModal');
    const metalDetailClose = document.getElementById('metalDetailClose');
    const metalDetailTitle = document.getElementById('metalDetailTitle');
    const metalDetailBody = document.getElementById('metalDetailBody');
    const exportWordBtn = document.getElementById('exportWordBtn');
    let currentMetalData = null;

    function openMetalDetail(metalKey) {
        const metal = METAL_DATA[metalKey];
        if (!metal) return;
        currentMetalData = metal;

        metalDetailTitle.textContent = '🔍 ' + metal.name + '（' + metal.symbol + '）详细性质';
        metalDetailBody.innerHTML =
            '<div class="metal-detail-section">' +
                '<h3>⚡ 电学性质</h3>' +
                '<div class="metal-detail-grid">' +
                    '<div class="detail-prop"><span class="prop-label">电阻率</span><span class="prop-value">' + metal.resistivity + ' Ω·m</span></div>' +
                    '<div class="detail-prop"><span class="prop-label">电导率</span><span class="prop-value">' + metal.conductivity + ' S/m</span></div>' +
                '</div>' +
            '</div>' +
            '<div class="metal-detail-section">' +
                '<h3>🪨 物理性质</h3>' +
                '<div class="metal-detail-grid">' +
                    '<div class="detail-prop"><span class="prop-label">密度</span><span class="prop-value">' + metal.density + ' g/cm³</span></div>' +
                    '<div class="detail-prop"><span class="prop-label">熔点</span><span class="prop-value">' + metal.meltingPoint + ' °C</span></div>' +
                    '<div class="detail-prop"><span class="prop-label">沸点</span><span class="prop-value">' + metal.boilingPoint + ' °C</span></div>' +
                    '<div class="detail-prop"><span class="prop-label">导热系数</span><span class="prop-value">' + metal.thermalConductivity + ' W/(m·K)</span></div>' +
                '</div>' +
            '</div>' +
            '<div class="metal-detail-section">' +
                '<h3>🛠 力学性质</h3>' +
                '<div class="metal-detail-grid">' +
                    '<div class="detail-prop"><span class="prop-label">杨氏模量</span><span class="prop-value">' + metal.youngsModulus + ' GPa</span></div>' +
                    '<div class="detail-prop"><span class="prop-label">抗拉强度</span><span class="prop-value">' + metal.tensileStrength + ' MPa</span></div>' +
                    '<div class="detail-prop"><span class="prop-label">晶体结构</span><span class="prop-value">' + metal.crystalStructure + '</span></div>' +
                    '<div class="detail-prop"><span class="prop-label">磁性</span><span class="prop-value">' + metal.magnetic + '</span></div>' +
                '</div>' +
            '</div>' +
            '<div class="metal-detail-section">' +
                '<h3>💡 常见用途</h3>' +
                '<div class="metal-detail-full">' + metal.uses + '</div>' +
            '</div>';

        metalDetailModal.classList.add('open');
    }

    function closeMetalDetail() {
        metalDetailModal.classList.remove('open');
        currentMetalData = null;
    }

    if (metalDetailClose) {
        metalDetailClose.addEventListener('click', closeMetalDetail);
    }
    if (metalDetailModal) {
        metalDetailModal.addEventListener('click', function(e) {
            if (e.target === metalDetailModal) closeMetalDetail();
        });
    }

    // Bind click to each metal card
    document.querySelectorAll('.metal-card').forEach(function(card, index) {
        const metalKeys = ['copper', 'aluminum', 'silver', 'gold', 'iron', 'steel', 'nickel', 'zinc', 'tin', 'lead'];
        card.addEventListener('click', function() {
            if (index < metalKeys.length) {
                openMetalDetail(metalKeys[index]);
            }
        });
    });

    // Word Export Function
    function exportMetalToWord() {
        if (!currentMetalData) return;
        const m = currentMetalData;
        const now = new Date().toLocaleString('zh-CN');

        const html =
'<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
'<head><meta charset="UTF-8"><title>金属性质报告</title>' +
'<style>' +
    'body { font-family: "Microsoft YaHei", "SimSun", sans-serif; color: #1e293b; line-height: 1.8; padding: 40px; }' +
    'h1 { text-align: center; font-size: 22px; color: #1d4ed8; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }' +
    'h2 { font-size: 16px; color: #2563eb; margin-top: 24px; margin-bottom: 10px; padding-bottom: 4px; border-bottom: 1px solid #bfdbfe; }' +
    'table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }' +
    'table td { padding: 8px 12px; border: 1px solid #e2e8f0; }' +
    'table td:first-child { background: #f1f5f9; font-weight: 600; width: 35%; color: #475569; }' +
    'table td:last-child { background: #ffffff; font-family: "Courier New", monospace; }' +
    '.uses { background: #f8fafc; padding: 14px 18px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 10px; }' +
    '.footer { text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px; }' +
'</style></head><body>' +
'<h1>' + m.name + '（' + m.symbol + '）性质报告</h1>' +
'<p style="text-align:center;color:#94a3b8;font-size:13px;">生成时间：' + now + ' | 物理实验助手 v2.0</p>' +
'<h2>电学性质</h2>' +
'<table>' +
    '<tr><td>电阻率</td><td>' + m.resistivity + ' Ω·m</td></tr>' +
    '<tr><td>电导率</td><td>' + m.conductivity + ' S/m</td></tr>' +
'</table>' +
'<h2>物理性质</h2>' +
'<table>' +
    '<tr><td>密度</td><td>' + m.density + ' g/cm³</td></tr>' +
    '<tr><td>熔点</td><td>' + m.meltingPoint + ' °C</td></tr>' +
    '<tr><td>沸点</td><td>' + m.boilingPoint + ' °C</td></tr>' +
    '<tr><td>导热系数</td><td>' + m.thermalConductivity + ' W/(m·K)</td></tr>' +
'</table>' +
'<h2>力学性质</h2>' +
'<table>' +
    '<tr><td>杨氏模量</td><td>' + m.youngsModulus + ' GPa</td></tr>' +
    '<tr><td>抗拉强度</td><td>' + m.tensileStrength + ' MPa</td></tr>' +
    '<tr><td>晶体结构</td><td>' + m.crystalStructure + '</td></tr>' +
    '<tr><td>磁性</td><td>' + m.magnetic + '</td></tr>' +
'</table>' +
'<h2>常见用途</h2>' +
'<div class="uses">' + m.uses + '</div>' +
'<div class="footer">物理实验助手 v2.0 — 金属材料性质参考数据库</div>' +
'</body></html>';

        const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = m.name + '_' + m.symbol + '_性质报告.doc';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    if (exportWordBtn) {
        exportWordBtn.addEventListener('click', exportMetalToWord);
    }

    // ========== Admin Button ==========
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', function() {
            window.open('/admin.html', '_blank');
        });
    }

    // ========== Feedback Modal ==========
    const feedbackBtn = document.getElementById('feedbackBtn');
    const feedbackModal = document.getElementById('feedbackModal');
    const feedbackClose = document.getElementById('feedbackClose');
    const feedbackSubmitBtn = document.getElementById('feedbackSubmitBtn');
    const feedbackContent = document.getElementById('feedbackContent');
    const feedbackContact = document.getElementById('feedbackContact');
    const feedbackResult = document.getElementById('feedbackResult');

    if (feedbackBtn && feedbackModal) {
        feedbackBtn.addEventListener('click', function() {
            feedbackContent.value = '';
            feedbackContact.value = '';
            feedbackResult.textContent = '';
            feedbackResult.className = 'feedback-result';
            feedbackSubmitBtn.disabled = false;
            feedbackModal.classList.add('open');
        });
    }
    if (feedbackClose) {
        feedbackClose.addEventListener('click', function() {
            feedbackModal.classList.remove('open');
        });
    }
    if (feedbackModal) {
        feedbackModal.addEventListener('click', function(e) {
            if (e.target === feedbackModal) feedbackModal.classList.remove('open');
        });
    }
    if (feedbackSubmitBtn) {
        feedbackSubmitBtn.addEventListener('click', async function() {
            const content = feedbackContent.value.trim();
            if (!content) {
                feedbackResult.textContent = '请输入反馈内容';
                feedbackResult.className = 'feedback-result error';
                return;
            }
            feedbackSubmitBtn.disabled = true;
            feedbackSubmitBtn.textContent = '提交中...';
            try {
                const res = await fetch('/api/feedback/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: content,
                        contact: feedbackContact.value.trim()
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    feedbackResult.textContent = data.message || '感谢您的反馈！';
                    feedbackResult.className = 'feedback-result success';
                    feedbackContent.value = '';
                    feedbackContact.value = '';
                    setTimeout(function() { feedbackModal.classList.remove('open'); }, 2000);
                } else {
                    feedbackResult.textContent = data.error || '提交失败，请重试';
                    feedbackResult.className = 'feedback-result error';
                    feedbackSubmitBtn.disabled = false;
                }
            } catch (e) {
                feedbackResult.textContent = '网络错误，请重试';
                feedbackResult.className = 'feedback-result error';
                feedbackSubmitBtn.disabled = false;
            }
            feedbackSubmitBtn.textContent = '📨 提交反馈';
        });
    }

    // ========== Visit Tracking ==========
    function parseUserAgent() {
        const ua = navigator.userAgent;
        let deviceType = 'Desktop';
        let browser = 'Unknown';
        let os = 'Unknown';

        // Device type
        if (/Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
            deviceType = (/iPad|Tablet/i.test(ua)) ? 'Tablet' : 'Mobile';
        }

        // Browser
        if (/Edg\//i.test(ua)) browser = 'Edge';
        else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
        else if (/Firefox/i.test(ua)) browser = 'Firefox';
        else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
        else if (/OPR|Opera/i.test(ua)) browser = 'Opera';
        else if (/MSIE|Trident/i.test(ua)) browser = 'IE';

        // OS
        if (/Windows/i.test(ua)) os = 'Windows';
        else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
        else if (/Android/i.test(ua)) os = 'Android';
        else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
        else if (/Linux/i.test(ua)) os = 'Linux';

        return { deviceType, browser, os };
    }

    function trackVisit() {
        const info = parseUserAgent();
        const screen = window.screen.width + 'x' + window.screen.height;
        fetch('/api/visits/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceType: info.deviceType,
                browser: info.browser,
                os: info.os,
                screen: screen,
                language: navigator.language || 'unknown',
                referrer: document.referrer || ''
            })
        }).catch(function(e) {
            console.warn('Visit tracking failed:', e);
        });
    }
    trackVisit();

    // ========== Auto-clear on page load ==========
    // Reset backend data and session on every page refresh
    (async function autoResetOnLoad() {
        try {
            await fetch('/api/experiment/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            await fetch('/api/sensor/clear', { method: 'POST' });
            await fetch('/agent/session/' + sessionId, { method: 'DELETE' });
        } catch (e) {
            console.warn('Auto-reset on load failed:', e);
        }
    })();

    // ========== Chart Fullscreen Zoom ==========
    const chartFullscreenModal = document.getElementById('chartFullscreenModal');
    const chartFullscreenClose = document.getElementById('chartFullscreenClose');
    const chartFullscreenTitle = document.getElementById('chartFullscreenTitle');
    const chartFullscreenCanvas = document.getElementById('chartFullscreenCanvas');
    let fullscreenChart = null;

    function openChartFullscreen(chartItemEl) {
        const sourceCanvas = chartItemEl.querySelector('canvas');
        const label = chartItemEl.querySelector('.chart-label');
        if (!sourceCanvas) return;

        const chartTitle = label ? label.textContent : '图表放大';

        // Try to find the original Chart instance from the global charts map
        let sourceChart = null;
        if (window._chartsMap) {
            const canvasId = sourceCanvas.id;
            sourceChart = window._chartsMap[canvasId];
        }

        chartFullscreenTitle.textContent = '📊 ' + chartTitle;
        chartFullscreenModal.classList.add('open');

        // Small delay to let modal render before sizing canvas
        setTimeout(function() {
            if (sourceChart) {
                // Clone the chart: create new Chart with same config
                const origConfig = sourceChart.config;
                // Deep clone config to avoid shared references
                const clonedData = JSON.parse(JSON.stringify(origConfig.data));
                const clonedOptions = JSON.parse(JSON.stringify(origConfig.options));

                // Adjust options for fullscreen view
                clonedOptions.responsive = true;
                clonedOptions.maintainAspectRatio = false;
                clonedOptions.animation = false;
                if (clonedOptions.plugins && clonedOptions.plugins.legend) {
                    clonedOptions.plugins.legend.display = true;
                    clonedOptions.plugins.legend.position = 'top';
                }

                if (fullscreenChart) {
                    fullscreenChart.destroy();
                    fullscreenChart = null;
                }

                const ctx = chartFullscreenCanvas.getContext('2d');
                fullscreenChart = new Chart(ctx, {
                    type: origConfig.type,
                    data: clonedData,
                    options: clonedOptions
                });
            }
        }, 100);
    }

    function closeChartFullscreen() {
        chartFullscreenModal.classList.remove('open');
        if (fullscreenChart) {
            fullscreenChart.destroy();
            fullscreenChart = null;
        }
    }

    // Bind click on all chart items
    document.querySelectorAll('.chart-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            // Don't trigger if clicking on canvas resize handles etc.
            openChartFullscreen(item);
        });
    });

    if (chartFullscreenClose) {
        chartFullscreenClose.addEventListener('click', closeChartFullscreen);
    }
    if (chartFullscreenModal) {
        chartFullscreenModal.addEventListener('click', function(e) {
            if (e.target === chartFullscreenModal) closeChartFullscreen();
        });
    }

    // Expose charts map for fullscreen access
    window.registerChartsMap = function(map) {
        window._chartsMap = map;
    };
});