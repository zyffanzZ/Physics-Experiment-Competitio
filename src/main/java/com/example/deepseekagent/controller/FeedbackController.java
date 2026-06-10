package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.FeedbackService;
import com.example.deepseekagent.service.VisitTrackingService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final VisitTrackingService visitTrackingService;

    public FeedbackController(FeedbackService feedbackService, VisitTrackingService visitTrackingService) {
        this.feedbackService = feedbackService;
        this.visitTrackingService = visitTrackingService;
    }

    @PostMapping("/submit")
    public ResponseEntity<Map<String, String>> submitFeedback(HttpServletRequest request,
                                                               @RequestBody Map<String, String> body) {
        String ip = getClientIp(request);
        String rawContent = body.getOrDefault("content", "");
        String rawContact = body.getOrDefault("contact", "");

        // Server-side XSS sanitization (V-05): strip HTML/script tags
        String content = sanitizeInput(rawContent);
        String contact = sanitizeInput(rawContact);

        if (content.isBlank()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "反馈内容不能为空");
            return ResponseEntity.badRequest().body(err);
        }

        // Limit input length to prevent abuse
        if (content.length() > 5000) {
            content = content.substring(0, 5000);
        }
        if (contact.length() > 500) {
            contact = contact.substring(0, 500);
        }

        feedbackService.saveFeedback(ip, content, contact);

        Map<String, String> result = new HashMap<>();
        result.put("message", "感谢您的反馈！我们会认真查看每一条建议。");
        return ResponseEntity.ok(result);
    }

    @PostMapping("/admin/list")
    public ResponseEntity<?> getAdminFeedback(HttpServletRequest request,
                                               @RequestBody Map<String, String> body) {
        String ip = getClientIp(request);
        String password = body.get("password");
        Map<String, Object> verifyResult = visitTrackingService.verifyPasswordWithLimit(ip, password);
        if (!Boolean.TRUE.equals(verifyResult.get("success"))) {
            return ResponseEntity.status(403).body(verifyResult);
        }
        List<Map<String, Object>> feedbacks = feedbackService.getAllFeedback();
        Map<String, Object> result = new HashMap<>();
        result.put("feedbacks", feedbacks);
        result.put("total", feedbacks.size());
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/admin/delete/{id}")
    public ResponseEntity<?> deleteFeedback(HttpServletRequest request, @PathVariable long id,
                                             @RequestBody Map<String, String> body) {
        String ip = getClientIp(request);
        String password = body.get("password");
        Map<String, Object> verifyResult = visitTrackingService.verifyPasswordWithLimit(ip, password);
        if (!Boolean.TRUE.equals(verifyResult.get("success"))) {
            return ResponseEntity.status(403).body(verifyResult);
        }
        feedbackService.deleteFeedback(id);
        Map<String, Object> result = new HashMap<>();
        result.put("message", "已删除反馈 #" + id);
        return ResponseEntity.ok(result);
    }

    /**
     * Sanitize user input to prevent stored XSS attacks (V-05).
     * Strips HTML tags, script blocks, and event handlers.
     */
    static String sanitizeInput(String input) {
        if (input == null || input.isEmpty()) return "";
        return input
                .replaceAll("(?i)<\\s*script[^>]*>.*?<\\s*/\\s*script\\s*>", "")
                .replaceAll("(?i)<\\s*/?\\s*script[^>]*>", "")
                .replaceAll("(?i)<[^>]*\\s+on\\w+\\s*=\\s*[\"'][^\"']*[\"'][^>]*>", "")
                .replaceAll("(?i)<[^>]*\\s+on\\w+\\s*=[^>]*>", "")
                .replaceAll("(?i)javascript\\s*:", "")
                .replaceAll("(?i)<\\s*iframe[^>]*>.*?<\\s*/\\s*iframe\\s*>", "")
                .replaceAll("(?i)<\\s*embed[^>]*>", "")
                .replaceAll("(?i)<\\s*object[^>]*>.*?<\\s*/\\s*object\\s*>", "")
                .trim();
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "0.0.0.0";
    }
}
