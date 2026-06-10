package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.MailService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/mail")
public class MailController {

    private static final Logger logger = LoggerFactory.getLogger(MailController.class);

    private final MailService mailService;

    public MailController(MailService mailService) {
        this.mailService = mailService;
    }

    @PostMapping("/send")
    public ResponseEntity<String> sendReport(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String content = request.get("content");

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body("错误：邮箱地址不能为空");
        }
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().body("错误：报告内容不能为空");
        }

        try {
            mailService.sendReport(email, "物理实验结题报告", content);
            return ResponseEntity.ok("结题报告已成功发送至您的邮箱，请注意查收！");
        } catch (Exception e) {
            logger.error("Mail send request failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("邮件发送失败，请检查邮箱地址或稍后重试。错误信息：" + e.getMessage());
        }
    }
}
