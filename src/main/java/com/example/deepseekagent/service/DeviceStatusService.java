package com.example.deepseekagent.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

@Service
public class DeviceStatusService {

    private static final Logger logger = LoggerFactory.getLogger(DeviceStatusService.class);
    private static final long TIMEOUT_MS = 10_000;

    private final ConcurrentHashMap<String, Long> deviceHeartbeats = new ConcurrentHashMap<>();

    public void heartbeat(String deviceId) {
        deviceHeartbeats.put(deviceId, System.currentTimeMillis());
        logger.debug("Heartbeat received from device: {}", deviceId);
    }

    public boolean isOnline(String deviceId) {
        Long last = deviceHeartbeats.get(deviceId);
        if (last == null) return false;
        return System.currentTimeMillis() - last < TIMEOUT_MS;
    }

    public void disconnect(String deviceId) {
        deviceHeartbeats.remove(deviceId);
        logger.info("Device {} forcibly disconnected", deviceId);
    }
}
