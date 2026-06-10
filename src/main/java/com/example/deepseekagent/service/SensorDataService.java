package com.example.deepseekagent.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class SensorDataService {

    private static final Logger logger = LoggerFactory.getLogger(SensorDataService.class);

    private static final double MAX_JUMP_MM = 500.0;
    private static final double MAX_VALID_DISTANCE_MM = 65534.0;

    private final CopyOnWriteArrayList<Map<String, Object>> dataBuffer = new CopyOnWriteArrayList<>();
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private double currentAngleDegrees = 30;

    public boolean isRunning() {
        return isRunning.get();
    }

    public void start() {
        dataBuffer.clear();
        isRunning.set(true);
        logger.info("闸门开启 · 数据缓存已清空 · 等待采集");
    }

    public void stop() {
        isRunning.set(false);
        logger.info("闸门关闭 · 停止接收传感器数据（缓存保留供 AI 读取）");
    }

    public synchronized void addDataPoint(double time, double displacementMm) {
        double velocity = 0, acceleration = 9.81;

        if (!dataBuffer.isEmpty()) {
            Map<String, Object> prev = dataBuffer.get(dataBuffer.size() - 1);
            double prevTime = ((Number) prev.get("time")).doubleValue();
            double prevDisplacement = ((Number) prev.get("displacement")).doubleValue();
            double dt = time - prevTime;
            if (dt > 0) {
                velocity = (displacementMm - prevDisplacement) / dt;
                acceleration = (velocity - ((Number) prev.get("velocity")).doubleValue()) / dt;
            }
        }

        appendPoint(time, displacementMm, velocity, acceleration);
    }

    public synchronized void addDataPoint(double time, double displacementMm, double velocityMm_s, double acceleration) {
        appendPoint(time, displacementMm, velocityMm_s, acceleration);
    }

    private void appendPoint(double time, double displacementMm, double velocity, double acceleration) {
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("time", time);
        point.put("displacement", displacementMm);
        point.put("velocity", velocity);
        point.put("acceleration", acceleration);
        dataBuffer.add(point);
        logger.info("数据已存入: t={}s  s={}mm  v={}mm/s  a={}mm/s²  (缓存共{}条)", time, displacementMm, velocity, acceleration, dataBuffer.size());
    }

    public boolean isClean(double displacementMm) {
        if (displacementMm >= MAX_VALID_DISTANCE_MM) {
            logger.warn("【数据被过滤】距离 {}mm >= {}mm (65535 异常信号)", displacementMm, MAX_VALID_DISTANCE_MM);
            return false;
        }

        if (displacementMm < 0) {
            logger.warn("【数据被过滤】距离为负值: {}mm", displacementMm);
            return false;
        }

        if (!dataBuffer.isEmpty()) {
            double last = ((Number) dataBuffer.get(dataBuffer.size() - 1).get("displacement")).doubleValue();
            double jump = Math.abs(displacementMm - last);
            if (jump > MAX_JUMP_MM) {
                logger.warn("【数据被过滤】当前距离: {}mm, 上次距离: {}mm, 跳变量: {}mm (阈值: {}mm)",
                        String.format("%.1f", displacementMm), String.format("%.1f", last),
                        String.format("%.1f", jump), MAX_JUMP_MM);
                return false;
            }
        }

        return true;
    }

    public Map<String, Object> getLatestDataPoint() {
        if (dataBuffer.isEmpty()) return null;
        return new LinkedHashMap<>(dataBuffer.get(dataBuffer.size() - 1));
    }

    public List<Map<String, Object>> getCleanedData() {
        return new ArrayList<>(dataBuffer);
    }

    public void clearAll() {
        dataBuffer.clear();
    }

    public int size() {
        return dataBuffer.size();
    }

    public void setAngle(double angle) {
        this.currentAngleDegrees = angle;
    }

    public double getAngle() {
        return currentAngleDegrees;
    }
}
