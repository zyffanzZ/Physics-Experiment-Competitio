package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.ExperimentHistoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/history")
public class ExperimentHistoryController {

    private final ExperimentHistoryService experimentHistoryService;

    public ExperimentHistoryController(ExperimentHistoryService experimentHistoryService) {
        this.experimentHistoryService = experimentHistoryService;
    }

    @GetMapping
    public List<Map<String, Object>> getAllExperiments() {
        return experimentHistoryService.getAllExperiments();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getExperimentById(@PathVariable long id) {
        Map<String, Object> experiment = experimentHistoryService.getExperimentById(id);
        if (experiment == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(experiment);
    }

    @GetMapping("/session/{sessionId}")
    public List<Map<String, Object>> getExperimentsBySession(@PathVariable String sessionId) {
        return experimentHistoryService.getExperimentsBySession(sessionId);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteExperiment(@PathVariable long id) {
        experimentHistoryService.deleteExperiment(id);
        return ResponseEntity.ok("Experiment deleted: " + id);
    }

    @PostMapping("/save")
    public ResponseEntity<Map<String, Object>> saveExperiment(@RequestBody Map<String, Object> body) {
        long id = experimentHistoryService.saveExperiment(
                (String) body.get("sessionId"),
                body.get("angleDegrees") != null ? ((Number) body.get("angleDegrees")).doubleValue() : 30,
                body.get("displacement") != null ? ((Number) body.get("displacement")).doubleValue() : null,
                body.get("time") != null ? ((Number) body.get("time")).doubleValue() : null,
                body.get("velocity") != null ? ((Number) body.get("velocity")).doubleValue() : null,
                body.get("acceleration") != null ? ((Number) body.get("acceleration")).doubleValue() : null,
                (String) body.get("conductivity"),
                (String) body.get("metal"),
                body.get("dataPointsCount") != null ? ((Number) body.get("dataPointsCount")).intValue() : null,
                (String) body.get("dataJson"),
                (String) body.get("reportText")
        );
        Map<String, Object> saved = experimentHistoryService.getExperimentById(id);
        return ResponseEntity.ok(saved);
    }
}
