package com.example.deepseekagent.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class VisitTrackingService {

    private static final Logger logger = LoggerFactory.getLogger(VisitTrackingService.class);
    private static final int MAX_ATTEMPTS = 3;
    private static final long BASE_LOCK_DURATION_MS = 900_000; // 15 minutes base lockout
    private static final int LOCK_MULTIPLIER_STEP_MIN = 5;      // each time locked again, add 5 min
    private static final int MAX_LOCK_MULTIPLIER = 4;           // max 4x escalation

    private final JdbcTemplate jdbcTemplate;
    private final ConcurrentHashMap<String, FailedAttempt> failedAttempts = new ConcurrentHashMap<>();

    @Value("${admin.password}")
    private String adminPassword;

    public VisitTrackingService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void recordVisit(String ip, String deviceType, String browser,
                             String os, String screen, String lang, String referrer, String userAgent) {
        String sql = "INSERT INTO visit_records (ip_address, device_type, browser_name, os_name, " +
                "screen_resolution, language, referrer, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql, ip, deviceType, browser, os, screen, lang, referrer, userAgent);
        logger.info("Visit recorded: IP={}, Device={}, Browser={}, OS={}", ip, deviceType, browser, os);
    }

    public long getVisitCount() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM visit_records", Long.class);
        return count != null ? count : 0;
    }

    public List<Map<String, Object>> getAllVisits() {
        return jdbcTemplate.queryForList("SELECT * FROM visit_records ORDER BY visit_time DESC");
    }

    public void deleteVisit(long id) {
        jdbcTemplate.update("DELETE FROM visit_records WHERE id = ?", id);
        logger.info("Visit record deleted: id={}", id);
    }

    /**
     * Verify password with rate limiting (V-07 fix: escalating lockout penalty).
     * 3 failed attempts = lockout. Lockout duration escalates:
     *   1st lockout: 15 min
     *   2nd lockout: 20 min
     *   3rd lockout: 25 min
     *   4th+ lockout: 60 min
     * Correct password resets everything.
     *
     * @return result map with "success" (boolean) and optionally "error", "remainingSeconds"
     */
    public Map<String, Object> verifyPasswordWithLimit(String ip, String password) {
        Map<String, Object> result = new ConcurrentHashMap<>();
        result.put("success", false);

        sweepStaleEntries();

        FailedAttempt attempt = failedAttempts.get(ip);
        if (attempt != null && attempt.count >= MAX_ATTEMPTS) {
            long elapsed = System.currentTimeMillis() - attempt.lastAttemptTime;
            long lockDuration = getLockDuration(attempt.lockoutCount);
            if (elapsed < lockDuration) {
                long remainingSec = (lockDuration - elapsed) / 1000;
                long remainingMin = remainingSec / 60;
                String timeStr = remainingMin > 0 ? remainingMin + " 分钟" : remainingSec + " 秒";
                result.put("error", "密码错误次数过多，请 " + timeStr + " 后重试");
                result.put("remainingSeconds", remainingSec);
                logger.warn("IP {} locked (level {}), {}s remaining", ip, attempt.lockoutCount, remainingSec);
                return result;
            }
            // Lock expired — keep lockoutCount for escalation, reset failure count
            attempt.count = 0;
        }

        if (adminPassword.equals(password)) {
            failedAttempts.remove(ip);
            result.put("success", true);
            logger.info("IP {} authenticated successfully", ip);
            return result;
        }

        if (attempt == null) {
            attempt = new FailedAttempt();
            failedAttempts.put(ip, attempt);
        }
        attempt.count++;
        attempt.lastAttemptTime = System.currentTimeMillis();
        int remaining = MAX_ATTEMPTS - attempt.count;
        logger.warn("IP {} failed attempt {}/{}, {} remaining", ip, attempt.count, MAX_ATTEMPTS, Math.max(0, remaining));

        if (attempt.count >= MAX_ATTEMPTS) {
            attempt.lockoutCount = Math.min(attempt.lockoutCount + 1, MAX_LOCK_MULTIPLIER);
            long lockMin = getLockDuration(attempt.lockoutCount) / 60_000;
            result.put("error", "密码错误次数过多，请 " + lockMin + " 分钟后重试");
            result.put("remainingSeconds", getLockDuration(attempt.lockoutCount) / 1000);
        } else {
            result.put("error", "密码错误，还剩 " + remaining + " 次尝试机会");
            result.put("remainingAttempts", remaining);
        }
        return result;
    }

    private long getLockDuration(int lockoutCount) {
        if (lockoutCount <= 0) return BASE_LOCK_DURATION_MS;
        int multiplier = Math.min(lockoutCount, MAX_LOCK_MULTIPLIER);
        return BASE_LOCK_DURATION_MS + (multiplier - 1) * LOCK_MULTIPLIER_STEP_MIN * 60_000L;
    }

    private void sweepStaleEntries() {
        long now = System.currentTimeMillis();
        long staleThreshold = 2 * 60 * 60 * 1000; // 2 hours
        failedAttempts.entrySet().removeIf(e -> {
            FailedAttempt fa = e.getValue();
            return fa.lastAttemptTime > 0 && (now - fa.lastAttemptTime) > staleThreshold;
        });
    }

    public boolean verifyPassword(String password) {
        return adminPassword.equals(password);
    }

    private static class FailedAttempt {
        int count = 0;
        int lockoutCount = 0;
        long lastAttemptTime = 0;
    }
}
