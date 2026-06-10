package com.example.deepseekagent.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class FeedbackService {

    private static final Logger logger = LoggerFactory.getLogger(FeedbackService.class);

    private final JdbcTemplate jdbcTemplate;

    public FeedbackService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void saveFeedback(String ip, String content, String contact) {
        String sql = "INSERT INTO user_feedback (ip_address, content, contact) VALUES (?, ?, ?)";
        jdbcTemplate.update(sql, ip, content, contact);
        logger.info("Feedback saved from IP={}, contact={}", ip, contact);
    }

    public List<Map<String, Object>> getAllFeedback() {
        return jdbcTemplate.queryForList("SELECT * FROM user_feedback ORDER BY feedback_time DESC");
    }

    public void deleteFeedback(long id) {
        jdbcTemplate.update("DELETE FROM user_feedback WHERE id = ?", id);
        logger.info("Feedback deleted: id={}", id);
    }
}
