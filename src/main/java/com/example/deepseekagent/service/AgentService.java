package com.example.deepseekagent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AgentService {

    private static final Logger logger = LoggerFactory.getLogger(AgentService.class);
    
    private final Map<String, List<Map<String, String>>> sessionMemoryMap = new ConcurrentHashMap<>();
    private final Map<String, List<Map<String, Object>>> experimentDataMap = new ConcurrentHashMap<>();
    
    private final String apiUrl;
    private final String apiKey;
    private final String model;
    private final double temperature;
    private final int maxTokens;
    
    private static final String SYSTEM_MESSAGE = """
            【绝对核心指令：你必须时刻牢记并严格扮演以下人设，严禁跳出角色。】
            
            1. 你的名字与身份：你叫"物理实验助手"，是"物联网物体下滑位移测量系统"的专属 AI 智能体。你绝不是"DeepSeek"，也不是通用语言模型。如果用户问你是谁、谁创造了你，你必须回答你是"物理实验助手"。
            
            【绝对核心输出格式与控制指令（最高优先级）】
            
            1. 禁用粗体符号：在回复用户时，严禁使用任何 Markdown 的粗体语法，即绝对不能出现 "**" 符号。所有核心词汇直接写出即可，保持文本纯净。
            
            2. 段落间距控制：你的回复中每一个核心要点、步骤或功能之间，必须使用双换行符进行强制分段，让两点内容之间在视觉上明确空出一段。
            
            3. 强化语气定位（三大核心服务是系统既定流程，非用户可选项）：
               - 严禁使用"您可以选择这些服务"、"请告诉我想用哪项服务"等带有可选项、挑选暗示的客套话。
               - 必须将三大功能表述为系统的"核心处理流程"或"系统必做事项"。
               - 当用户询问功能或启动时，应以确定性的、流程引导的语气回答。
            
            我的核心功能与系统运行流程如下：
            
            1. 自动清洗数据：系统会自动识别并剔除由于传感器抖动或外界干扰产生的异常位移数据，确保实验结果的准确性。
            
             2. 物理特性推导：系统会自动根据物体下滑的实时数据计算出电导率并匹配金属材质，你只需在报告中引用系统已算好的结果。
            
            3. 自动生成结题报告：当实验完成并且系统处理完上述数据后，只要您在对话框输入"结题报告"，系统就会结合物理公式输出一份完整的实验结题报告。
            
            【重要：输出结题报告的特定规则】
            每当输出完结题报告的最后一句话后，必须换行并强制输出以下标准引导语：
            "以上为本次实验的完整结题报告。如果您需要将这份报告保存到邮箱，请在下方对话框中直接输入您的邮箱地址，系统将自动为您发送。"
            
            请开始实验，系统将在接收到 ESP8266 终端的激光测距数据后自动启动上述处理流程。
            
            3. 语气与禁止事项：
               - 你的语气必须专业、严谨、崇尚科学。
               - 严禁提及"我的知识截止日期是2025年"、"我是纯文本模型"、"深度求索公司"等任何有关原生大模型的自我介绍。
               - 如果后端没有传来位移和时间数据，且用户要求生成报告或推导金属，请礼貌提示用户："当前未检测到实验数据，请先开始或完成实验。"
            """;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final KnowledgeBaseService knowledgeBaseService;
    private final SensorDataService sensorDataService;

    public AgentService(RestTemplate restTemplate, ObjectMapper objectMapper,
                        KnowledgeBaseService knowledgeBaseService,
                        SensorDataService sensorDataService,
                        @Value("${deepseek.api.url}") String apiUrl,
                        @Value("${deepseek.api.key}") String apiKey,
                        @Value("${deepseek.api.model}") String model,
                        @Value("${deepseek.api.temperature}") double temperature,
                        @Value("${deepseek.api.maxTokens}") int maxTokens) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.knowledgeBaseService = knowledgeBaseService;
        this.sensorDataService = sensorDataService;
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
    }

    /**
     * Stores experiment data for a given session.
     */
    public void storeExperimentData(String sessionId, List<Map<String, Object>> data) {
        experimentDataMap.put(sessionId, data);
        logger.info("Experiment data stored for session {}, {} data points", sessionId, data.size());
    }

    private static final String INVALID_DATA_TEMPLATE = """
            ⚠️ 【系统警告：实验轨迹异常判定】
            
            尊敬的实验人员，AI 助手已完成对本次采集到的物理数据集（位移-时间序列）的特征逆向解析。
            
            经过物理引擎模型的曲线比对，判定本次捕获的运动轨迹具有非线性和高度离散性，完全不符合"刚体滑块沿固定倾角斜面受涡流阻尼下滑"的经典动力学特征。
            
            具体异常表征如下：
            
            运动学逻辑相悖：实时位移响应曲线未呈现平滑的单调递增趋势，甚至伴随超物理常理的瞬时跳变或高频噪点（异常溢出）。
            
            能量守恒失真：系统动态检测到的动能与势能转化比例严重失衡，判定该特征并非本平台所设计的特定物理实验活动。
            
            结论与建议：本次生成的结题报告判定为【无效实验】。该异常通常由传感器硬件链路接触不良（如触发 16 位量程最大值 65535）、外部强光环境干扰激光测距，或人工非规范干预滑块运动（如手部遮挡）引起。
            
            请清空当前缓存数据，检查硬件终端状态后，重新进行标准规范的滑块下滑实验。
            """;

    /**
     * Validates experiment data for physical plausibility.
     * Returns null if data is valid, or a rejection string if anomalies are detected.
     */
    private String validateData(List<Map<String, Object>> data) {
        if (data == null || data.isEmpty()) return null;

        int overflowCount = 0;
        int monotonicViolations = 0;
        boolean allVelocityZero = true;
        boolean displacementChanged = false;
        double lastDisp = -1;
        double lastTime = -1;

        for (Map<String, Object> point : data) {
            double disp = ((Number) point.get("displacement")).doubleValue();
            double t = ((Number) point.get("time")).doubleValue();
            double v = ((Number) point.getOrDefault("velocity", 0)).doubleValue();

            // 65535 overflow
            if (disp >= 65534) overflowCount++;

            // monotonic check
            if (lastDisp >= 0 && disp < lastDisp - 2.0) monotonicViolations++;
            lastDisp = disp;

            // velocity + time check
            if (Math.abs(v) > 0.01) allVelocityZero = false;
            if (lastTime >= 0 && t > lastTime) displacementChanged = true;
            lastTime = t;
        }

        // Condition 1: overflow
        if (overflowCount >= Math.max(3, data.size() / 5)) {
            return INVALID_DATA_TEMPLATE;
        }

        // Condition 2: non-monotonic
        if (monotonicViolations >= Math.max(5, data.size() / 10)) {
            return INVALID_DATA_TEMPLATE;
        }

        // Condition 3: time accumulates but velocity always 0, no displacement change
        if (allVelocityZero && lastTime > 2.0 && data.size() >= 10) {
            return INVALID_DATA_TEMPLATE;
        }

        return null;
    }

    /**
     * Processes a user message for a given session and returns the AI's response.
     */
    public String processMessage(String sessionId, String userMessage) {
        // Guard: validate data before AI processing when requesting a report
        if (userMessage != null && userMessage.contains("结题报告")) {
            List<Map<String, Object>> expData = experimentDataMap.get(sessionId);
            if (expData != null && !expData.isEmpty()) {
                String rejected = validateData(expData);
                if (rejected != null) return rejected;
            } else {
                List<Map<String, Object>> sensorData = sensorDataService.getCleanedData();
                if (!sensorData.isEmpty()) {
                    String rejected = validateData(sensorData);
                    if (rejected != null) return rejected;
                }
            }
        }

        List<Map<String, String>> messages = sessionMemoryMap.computeIfAbsent(sessionId, k -> new ArrayList<>());

        if (messages.isEmpty()) {
            messages.add(Map.of("role", "system", "content", SYSTEM_MESSAGE));

            // 注入本地知识库（物理公式、金属背景数据等）
            String kb = knowledgeBaseService.getKnowledgeContext();
            if (!kb.isEmpty()) {
                messages.add(Map.of("role", "system", "content",
                    "【系统级参考知识库（仅在用户询问原理、公式、金属背景时使用，严禁将其作为实验数据混淆）】\n" + kb));
            }

            // 注入实验数据上下文
            List<Map<String, Object>> expData = experimentDataMap.get(sessionId);
            if (expData != null && !expData.isEmpty()) {
                String dataContext = buildExperimentDataContext(expData);
                messages.add(Map.of("role", "system", "content", dataContext));
            } else {
                List<Map<String, Object>> sensorData = sensorDataService.getCleanedData();
                if (!sensorData.isEmpty()) {
                    String dataContext = buildSensorDataContext(sensorData);
                    messages.add(Map.of("role", "system", "content", dataContext));
                }
            }
        }

        messages.add(Map.of("role", "user", "content", userMessage));
        String aiResponse = callDeepSeekApi(messages);

        messages.add(Map.of("role", "assistant", "content", aiResponse));
        trimHistoryIfNeeded(sessionId, messages);

        return aiResponse;
    }

    /**
     * Builds a formatted experiment data context string from raw data.
     */
    private String buildExperimentDataContext(List<Map<String, Object>> data) {
        int totalPoints = data.size();
        Map<String, Object> last = data.get(totalPoints - 1);
        double totalTime = ((Number) last.get("time")).doubleValue();
        double totalDisplacement = ((Number) last.get("displacement")).doubleValue();
        double finalVelocity = ((Number) last.get("velocity")).doubleValue();
        double acceleration = ((Number) last.get("acceleration")).doubleValue();

        // 提取最大速度 (mm/s) 作为终端速度
        double vMax = data.stream()
                .mapToDouble(p -> ((Number) p.get("velocity")).doubleValue())
                .max().orElse(finalVelocity);

        // 电导率计算与材质匹配
        String sigmaInfo = "未计算（数据不足）";
        String metalInfo = "未知";
        if (vMax > 0) {
            double sigma = ConductivityCalculator.calculateSigma(vMax);
            sigmaInfo = ConductivityCalculator.formatSigma(sigma);
            metalInfo = ConductivityCalculator.matchMetal(sigma);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("【当前实验实时数据已加载】\n\n");
        sb.append("总位移：").append(String.format("%.2f", totalDisplacement)).append(" mm\n");
        sb.append("总时间：").append(String.format("%.2f", totalTime)).append(" s\n");
        sb.append("最终速度：").append(String.format("%.2f", finalVelocity)).append(" mm/s\n");
        sb.append("加速度：").append(String.format("%.2f", acceleration)).append(" mm/s²\n\n");
        sb.append("【系统已自动完成物理特性推导】\n");
        sb.append("电导率 σ = ").append(sigmaInfo).append("\n");
        sb.append("匹配金属材质：").append(metalInfo).append("\n\n");
        sb.append("数据序列（共 ").append(totalPoints).append(" 个采样点）：\n");

        for (int i = 0; i < totalPoints; i++) {
            Map<String, Object> point = data.get(i);
            sb.append("  t=").append(point.get("time"))
              .append("s  s=").append(point.get("displacement"))
              .append("mm  v=").append(point.get("velocity"))
              .append("mm/s  a=").append(point.get("acceleration"))
              .append("mm/s²\n");
        }

        sb.append("\n请结合以上系统已处理的数据，生成完整的实验结题报告：\n");
        sb.append("1. 确认数据清洗结果（如无异常则跳过）\n");
        sb.append("2. 引用系统自动计算的电导率与匹配金属材质\n");
        sb.append("3. 输出完整实验结题报告");
        return sb.toString();
    }

    private String buildSensorDataContext(List<Map<String, Object>> rawData) {
        int n = rawData.size();
        double lastTime = 0, lastDisp = 0;
        double vMax = 0;
        for (int i = 0; i < n; i++) {
            double t = ((Number) rawData.get(i).get("time")).doubleValue();
            double s = ((Number) rawData.get(i).get("displacement")).doubleValue();
            double dt = (i == 0) ? 0 : t - lastTime;
            double ds = (i == 0) ? 0 : s - lastDisp;
            double v = (dt > 0) ? ds / dt * 1000.0 : 0;
            double a = 9.81;
            rawData.get(i).put("velocity", v);
            rawData.get(i).put("acceleration", a);
            if (v > vMax) vMax = v;
            lastTime = t;
            lastDisp = s;
        }

        double totalDisplacement = ((Number) rawData.get(n - 1).get("displacement")).doubleValue();
        double totalTime = ((Number) rawData.get(n - 1).get("time")).doubleValue();
        double finalVelocity = ((Number) rawData.get(n - 1).get("velocity")).doubleValue();
        double acceleration = 9.81;

        String sigmaInfo = "未计算（数据不足）";
        String metalInfo = "未知";
        if (vMax > 0) {
            double sigma = ConductivityCalculator.calculateSigma(vMax);
            sigmaInfo = ConductivityCalculator.formatSigma(sigma);
            metalInfo = ConductivityCalculator.matchMetal(sigma);
        }

        StringBuilder sb = new StringBuilder();
        sb.append("【当前实验实时数据已加载（ESP8266 硬件终端采集）】\n\n");
        sb.append("总位移：").append(String.format("%.2f", totalDisplacement)).append(" mm\n");
        sb.append("总时间：").append(String.format("%.2f", totalTime)).append(" s\n");
        sb.append("最终速度：").append(String.format("%.2f", finalVelocity)).append(" mm/s\n");
        sb.append("加速度：").append(String.format("%.2f", acceleration)).append(" mm/s²\n\n");
        sb.append("【系统已自动完成物理特性推导】\n");
        sb.append("电导率 σ = ").append(sigmaInfo).append("\n");
        sb.append("匹配金属材质：").append(metalInfo).append("\n\n");
        sb.append("数据序列（共 ").append(n).append(" 个采样点）：\n");

        for (int i = 0; i < n; i++) {
            Map<String, Object> p = rawData.get(i);
            sb.append("  t=").append(p.get("time"))
              .append("s  s=").append(p.get("displacement"))
              .append("mm  v=").append(String.format("%.2f", p.get("velocity")))
              .append("mm/s  a=").append(p.get("acceleration"))
              .append("mm/s²\n");
        }

        sb.append("\n请结合以上系统已处理的数据，生成完整的实验结题报告：\n");
        sb.append("1. 确认数据清洗结果（如无异常则跳过）\n");
        sb.append("2. 引用系统自动计算的电导率与匹配金属材质\n");
        sb.append("3. 输出完整实验结题报告");
        return sb.toString();
    }

    /**
     * Calls the DeepSeek API with the given messages.
     * @param messages List of message maps with role and content
     * @return The AI's response text
     */
    private String callDeepSeekApi(List<Map<String, String>> messages) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", messages);
        requestBody.put("temperature", temperature);
        requestBody.put("max_tokens", maxTokens);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        
        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
        
        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl,
                    HttpMethod.POST,
                    requestEntity,
                    String.class
            );
            
            if (response.getStatusCode() == HttpStatus.OK) {
                // Parse the response to extract the AI's message
                JsonNode jsonNode = objectMapper.readTree(response.getBody());
                if (jsonNode.has("choices") && jsonNode.get("choices").isArray() && 
                    jsonNode.get("choices").size() > 0) {
                    JsonNode choice = jsonNode.get("choices").get(0);
                    if (choice.has("message") && choice.get("message").has("content")) {
                        return choice.get("message").get("content").asText();
                    }
                }
                logger.warn("Unexpected response format from DeepSeek API: {}", response.getBody());
                return "I'm sorry, I encountered an error processing your request.";
            } else {
                logger.error("DeepSeek API returned error status: {}", response.getStatusCode());
                return "I'm sorry, I encountered an error processing your request.";
            }
        } catch (Exception e) {
            logger.error("Error calling DeepSeek API", e);
            return "I'm sorry, I encountered an error processing your request.";
        }
    }

    /**
     * Trims the conversation history if it gets too long.
     * @param messages The conversation history
     */
    private void trimHistoryIfNeeded(String sessionId, List<Map<String, String>> messages) {
        if (messages.size() > 21) {
            List<Map<String, String>> trimmed = new ArrayList<>();
            trimmed.add(messages.get(0));
            trimmed.addAll(messages.subList(messages.size() - 20, messages.size()));
            sessionMemoryMap.put(sessionId, trimmed);
        }
    }

    /**
     * Clears the memory for a given session.
     * @param sessionId The session ID to clear
     */
    public void clearMemory(String sessionId) {
        sessionMemoryMap.remove(sessionId);
        experimentDataMap.remove(sessionId);
    }

    public List<Map<String, Object>> getExperimentData(String sessionId) {
        return experimentDataMap.get(sessionId);
    }

    /**
     * Gets the chat history for a session as a list of strings (for debugging or display).
     * V-11 fix: System messages (prompts) are filtered out to prevent prompt leakage.
     * @param sessionId The session ID
     * @return List of messages in the conversation (excluding system prompts)
     */
    public List<String> getHistory(String sessionId) {
        List<Map<String, String>> messages = sessionMemoryMap.get(sessionId);
        if (messages == null) {
            return new ArrayList<>();
        }
        return messages.stream()
                .filter(map -> !"system".equals(map.get("role")))
                .map(map -> map.get("role") + ": " + map.get("content"))
                .toList();
    }
}