package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.DeviceStatusService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/device")
public class DeviceStatusController {

    private final DeviceStatusService deviceStatusService;

    public DeviceStatusController(DeviceStatusService deviceStatusService) {
        this.deviceStatusService = deviceStatusService;
    }

    @PostMapping("/heartbeat")
    public String heartbeat(@RequestBody Map<String, String> body) {
        String deviceId = body.getOrDefault("deviceId", "esp8266");
        deviceStatusService.heartbeat(deviceId);
        return "ok";
    }

    @GetMapping("/status")
    public Map<String, Object> status(@RequestParam(defaultValue = "esp8266") String deviceId) {
        boolean online = deviceStatusService.isOnline(deviceId);
        return Map.of("online", online, "deviceId", deviceId);
    }

    @PostMapping("/disconnect")
    public String disconnect(@RequestBody(required = false) Map<String, String> body) {
        String deviceId = (body != null) ? body.getOrDefault("deviceId", "esp8266") : "esp8266";
        deviceStatusService.disconnect(deviceId);
        return "ok";
    }
}
