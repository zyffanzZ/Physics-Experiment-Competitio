package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.SimulationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/simulation")
public class SimulationController {

    private final SimulationService simulationService;

    public SimulationController(SimulationService simulationService) {
        this.simulationService = simulationService;
    }

    @PostMapping("/start")
    public ResponseEntity<String> start() {
        simulationService.start();
        return ResponseEntity.ok("simulation started");
    }

    @PostMapping("/stop")
    public ResponseEntity<String> stop() {
        simulationService.stop();
        return ResponseEntity.ok("simulation stopped");
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(Map.of("running", simulationService.isRunning()));
    }
}
