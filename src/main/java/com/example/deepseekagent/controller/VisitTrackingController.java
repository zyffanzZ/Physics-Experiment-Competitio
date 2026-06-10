package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.VisitTrackingService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/visits")
public class VisitTrackingController {

    private final VisitTrackingService visitTrackingService;

    public VisitTrackingController(VisitTrackingService visitTrackingService) {
        this.visitTrackingService = visitTrackingService;
    }

    @PostMapping("/track")
    public ResponseEntity<Map<String, Object>> trackVisit(HttpServletRequest request,
                                                           @RequestBody Map<String, Object> body) {
        String ip = getClientIp(request);
        String deviceType = (String) body.getOrDefault("deviceType", "Unknown");
        String browser = (String) body.getOrDefault("browser", "Unknown");
        String os = (String) body.getOrDefault("os", "Unknown");
        String screen = (String) body.getOrDefault("screen", "Unknown");
        String lang = (String) body.getOrDefault("language", "Unknown");
        String referrer = (String) body.getOrDefault("referrer", "");
        String userAgent = request.getHeader("User-Agent");

        visitTrackingService.recordVisit(ip, deviceType, browser, os, screen, lang, referrer, userAgent);

        long totalVisits = visitTrackingService.getVisitCount();
        Map<String, Object> result = new HashMap<>();
        result.put("totalVisits", totalVisits);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/count")
    public ResponseEntity<Map<String, Object>> getVisitCount() {
        Map<String, Object> result = new HashMap<>();
        result.put("totalVisits", visitTrackingService.getVisitCount());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/admin/list")
    public ResponseEntity<?> getAdminVisits(HttpServletRequest request, @RequestBody Map<String, String> body) {
        String ip = getClientIp(request);
        String password = body.get("password");
        Map<String, Object> verifyResult = visitTrackingService.verifyPasswordWithLimit(ip, password);
        if (!Boolean.TRUE.equals(verifyResult.get("success"))) {
            return ResponseEntity.status(403).body(verifyResult);
        }
        List<Map<String, Object>> visits = visitTrackingService.getAllVisits();
        Map<String, Object> result = new HashMap<>();
        result.put("visits", visits);
        result.put("totalVisits", visits.size());
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/admin/delete/{id}")
    public ResponseEntity<?> deleteVisit(HttpServletRequest request, @PathVariable long id,
                                          @RequestBody Map<String, String> body) {
        String ip = getClientIp(request);
        String password = body.get("password");
        Map<String, Object> verifyResult = visitTrackingService.verifyPasswordWithLimit(ip, password);
        if (!Boolean.TRUE.equals(verifyResult.get("success"))) {
            return ResponseEntity.status(403).body(verifyResult);
        }
        visitTrackingService.deleteVisit(id);
        Map<String, Object> result = new HashMap<>();
        result.put("message", "已删除记录 #" + id);
        result.put("totalVisits", visitTrackingService.getVisitCount());
        return ResponseEntity.ok(result);
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // If multiple IPs via proxy, take the first one
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "0.0.0.0";
    }
}
