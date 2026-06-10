package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.AgentService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/experiment")
public class ExperimentDataController {

    private final AgentService agentService;

    public ExperimentDataController(AgentService agentService) {
        this.agentService = agentService;
    }

    @PostMapping("/data")
    public String storeData(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.get("sessionId");
        if (sessionId == null || sessionId.isBlank()) {
            return "错误：sessionId 不能为空";
        }
        Object rawData = request.get("data");
        if (!(rawData instanceof List)) {
            return "错误：data 必须为数组";
        }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) rawData;
        agentService.storeExperimentData(sessionId, data);
        return "实验数据已存储，共 " + data.size() + " 个采样点";
    }
}
