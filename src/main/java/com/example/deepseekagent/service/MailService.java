package com.example.deepseekagent.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class MailService {

    private static final Logger logger = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;

    public MailService(JavaMailSender mailSender,
                       @Value("${spring.mail.username}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
    }

    public void sendReport(String to, String subject, String content) {
        try {
            String escapedContent = content
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\n", "<br/>");

            String htmlContent =
                "<html>" +
                "<head>" +
                "  <style>" +
                "    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f9; color: #333333; line-height: 1.8; padding: 20px; }" +
                "    .container { max-width: 700px; margin: 0 auto; background: #ffffff; padding: 35px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }" +
                "    .header { border-bottom: 2px solid #eaedf2; padding-bottom: 15px; margin-bottom: 25px; }" +
                "    .header h2 { color: #2c3e50; margin: 0; font-size: 22px; }" +
                "    .content { font-size: 15px; white-space: pre-wrap; word-wrap: break-word; color: #4a5568; }" +
                "    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #eaedf2; font-size: 12px; color: #a0aec0; }" +
                "  </style>" +
                "</head>" +
                "<body>" +
                "  <div class='container'>" +
                "    <div class='header'><h2>📊 物联网下滑位移测量实验 - 结题报告</h2></div>" +
                "    <div class='content'>" + escapedContent + "</div>" +
                "    <div class='footer'>本报告由 AI 实验助手自动清洗、分析数据并生成</div>" +
                "  </div>" +
                "</body>" +
                "</html>";

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            mailSender.send(message);
            logger.info("Report sent successfully from {} to {}", fromAddress, to);
        } catch (Exception e) {
            logger.error("=== MAIL SEND FAILED ===");
            logger.error("From: {}", fromAddress);
            logger.error("To:   {}", to);
            logger.error("Subject: {}", subject);
            logger.error("Exception type: {}", e.getClass().getName());
            logger.error("Exception message: {}", e.getMessage());
            e.printStackTrace();
            throw new RuntimeException(e.getMessage());
        }
    }
}
