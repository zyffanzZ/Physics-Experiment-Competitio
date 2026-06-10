package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.AgentService;
import com.example.deepseekagent.service.ExperimentHistoryService;
import com.example.deepseekagent.service.SensorDataService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/agent")
public class AgentController {

    private final AgentService agentService;
    private final ExperimentHistoryService experimentHistoryService;
    private final SensorDataService sensorDataService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AgentController(AgentService agentService, ExperimentHistoryService experimentHistoryService,
                           SensorDataService sensorDataService) {
        this.agentService = agentService;
        this.experimentHistoryService = experimentHistoryService;
        this.sensorDataService = sensorDataService;
    }

    /**
     * Endpoint to chat with the agent.
     * @param sessionId Unique identifier for the conversation session (can be passed as request param or header)
     * @param message The user's message
     * @return The AI's response
     */
    @GetMapping("/chat")
    public String chat(@RequestParam("sessionId") String sessionId, @RequestParam("message") String message) {
        String response = agentService.processMessage(sessionId, message);

        // Auto-save experiment when message contains "结题报告"
        if (message != null && message.contains("结题报告")) {
            try {
                List<Map<String, Object>> data = sensorDataService.getCleanedData();
                if (data != null && !data.isEmpty()) {
                    Map<String, Object> lastPoint = data.get(data.size() - 1);
                    String dataJson = objectMapper.writeValueAsString(data);

                    experimentHistoryService.saveExperiment(
                            sessionId,
                            sensorDataService.getAngle(),
                            lastPoint.get("displacement") != null ? ((Number) lastPoint.get("displacement")).doubleValue() : null,
                            lastPoint.get("time") != null ? ((Number) lastPoint.get("time")).doubleValue() : null,
                            lastPoint.get("velocity") != null ? ((Number) lastPoint.get("velocity")).doubleValue() : null,
                            lastPoint.get("acceleration") != null ? ((Number) lastPoint.get("acceleration")).doubleValue() : null,
                            null,
                            null,
                            data.size(),
                            dataJson,
                            response
                    );
                }
            } catch (Exception e) {
                // Silently ignore save errors to not affect chat response
            }
        }

        return response;
    }

    /**
     * Endpoint to clear the memory for a session.
     * @param sessionId The session ID to clear
     * @return Confirmation message
     */
    @DeleteMapping("/session/{sessionId}")
    public String clearSession(@PathVariable String sessionId) {
        agentService.clearMemory(sessionId);
        return "Memory cleared for session: " + sessionId;
    }

    /**
     * Endpoint to get the chat history for a session (for debugging).
     * @param sessionId The session ID
     * @return List of messages in the conversation
     */
    @GetMapping("/session/{sessionId}/history")
    public java.util.List<String> getHistory(@PathVariable String sessionId) {
        return agentService.getHistory(sessionId);
    }
}