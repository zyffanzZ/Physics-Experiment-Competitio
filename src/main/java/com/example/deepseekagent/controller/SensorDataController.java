package com.example.deepseekagent.controller;

import com.example.deepseekagent.dto.SensorDataDTO;
import com.example.deepseekagent.service.AgentService;
import com.example.deepseekagent.service.DeviceStatusService;
import com.example.deepseekagent.service.SensorDataService;
import com.example.deepseekagent.service.SimulationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class SensorDataController {

    private static final Logger logger = LoggerFactory.getLogger(SensorDataController.class);

    private final SensorDataService sensorDataService;
    private final DeviceStatusService deviceStatusService;
    private final AgentService agentService;
    private final SimulationService simulationService;

    public SensorDataController(SensorDataService sensorDataService,
                                DeviceStatusService deviceStatusService,
                                AgentService agentService,
                                SimulationService simulationService) {
        this.sensorDataService = sensorDataService;
        this.deviceStatusService = deviceStatusService;
        this.agentService = agentService;
        this.simulationService = simulationService;
    }

    @PostMapping("/data-map")
    public ResponseEntity<String> receiveData(@RequestBody SensorDataDTO dto) {
        deviceStatusService.heartbeat("esp8266");

        if (!sensorDataService.isRunning()) {
            return ResponseEntity.noContent().build();
        }

        double time = dto.getTime();
        double distanceCm = dto.getDistance();
        double displacementMm = distanceCm * 10.0;

        if (sensorDataService.isClean(displacementMm)) {
            sensorDataService.addDataPoint(time, displacementMm);
        }

        return ResponseEntity.ok("ok");
    }

    @PostMapping("/experiment/start")
    public ResponseEntity<String> startExperiment() {
        sensorDataService.start();
        logger.info("实验开始");
        return ResponseEntity.ok("started");
    }

    @PostMapping("/experiment/stop")
    public ResponseEntity<String> stopExperiment() {
        sensorDataService.stop();
        logger.info("实验停止");
        return ResponseEntity.ok("stopped");
    }

    @PostMapping("/experiment/clear")
    public ResponseEntity<String> clearData(@RequestBody(required = false) Map<String, String> body) {
        sensorDataService.clearAll();
        sensorDataService.stop();
        String sessionId = (body != null) ? body.get("sessionId") : null;
        if (sessionId != null) {
            agentService.clearMemory(sessionId);
        }
        logger.info("实验数据全量清空完成");
        return ResponseEntity.ok("cleared");
    }

    @GetMapping("/sensor/latest")
    public ResponseEntity<Map<String, Object>> getLatest() {
        Map<String, Object> point = sensorDataService.getLatestDataPoint();
        if (point == null) {
            return ResponseEntity.noContent().build();
        }
        Map<String, Object> result = new LinkedHashMap<>(point);
        if (!simulationService.isRunning() && !sensorDataService.isRunning()) {
            double disp = ((Number) point.get("displacement")).doubleValue();
            double t = ((Number) point.get("time")).doubleValue();
            if (disp >= 1950 && t > 0.5) {
                result.put("status", "FINISHED");
            }
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/sensor/list")
    public ResponseEntity<List<Map<String, Object>>> getList() {
        return ResponseEntity.ok(sensorDataService.getCleanedData());
    }

    @PostMapping("/sensor/clear")
    public ResponseEntity<String> clearSensorBuffer() {
        sensorDataService.clearAll();
        logger.info("Sensor data buffer cleared");
        return ResponseEntity.ok("cleared");
    }
}
