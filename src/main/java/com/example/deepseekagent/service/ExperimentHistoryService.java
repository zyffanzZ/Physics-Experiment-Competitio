package com.example.deepseekagent.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ExperimentHistoryService {

    private static final Logger logger = LoggerFactory.getLogger(ExperimentHistoryService.class);

    private final JdbcTemplate jdbcTemplate;

    public ExperimentHistoryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public long saveExperiment(String sessionId, double angleDegrees, Double displacement,
                                Double time, Double velocity, Double acceleration,
                                String conductivity, String metal, Integer dataPointsCount,
                                String dataJson, String reportText) {
        String sql = "INSERT INTO experiment_history (session_id, angle_degrees, total_displacement, " +
                "total_time, final_velocity, acceleration, conductivity, metal_material, " +
                "data_points_count, data_json, report_text) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        jdbcTemplate.update(sql, sessionId, angleDegrees, displacement,
                time, velocity, acceleration, conductivity, metal,
                dataPointsCount, dataJson, reportText);
        Long id = jdbcTemplate.queryForObject("CALL IDENTITY()", Long.class);
        logger.info("Experiment saved with id={} for session={}", id, sessionId);
        return id != null ? id : -1;
    }

    public List<Map<String, Object>> getAllExperiments() {
        return jdbcTemplate.queryForList("SELECT * FROM experiment_history ORDER BY experiment_time DESC");
    }

    public Map<String, Object> getExperimentById(long id) {
        List<Map<String, Object>> results = jdbcTemplate.queryForList(
                "SELECT * FROM experiment_history WHERE id = ?", id);
        return results.isEmpty() ? null : results.get(0);
    }

    public List<Map<String, Object>> getExperimentsBySession(String sessionId) {
        return jdbcTemplate.queryForList(
                "SELECT * FROM experiment_history WHERE session_id = ? ORDER BY experiment_time DESC", sessionId);
    }

    public void deleteExperiment(long id) {
        jdbcTemplate.update("DELETE FROM experiment_history WHERE id = ?", id);
        logger.info("Experiment deleted with id={}", id);
    }
}
