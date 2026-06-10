package com.example.deepseekagent.service;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class SimulationService {

    private static final Logger logger = LoggerFactory.getLogger(SimulationService.class);

    private static final double G = 9.81;
    private static final double BASE_MU = 0.55;
    private static final double MU_JITTER = 0.01;
    private static final double TRACK_LENGTH_MM = 2000.0;
    private static final long TICK_MS = 50;

    private final SensorDataService sensorDataService;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "simulation-tick");
        t.setDaemon(true);
        return t;
    });
    private ScheduledFuture<?> task;
    private final AtomicBoolean running = new AtomicBoolean(false);

    private double thetaDegrees = 30;
    private double elapsedTime;
    private double currentVelocity;
    private double totalDisplacement;
    private int zeroVelocityCount;
    private final Random random = new Random();

    public SimulationService(SensorDataService sensorDataService) {
        this.sensorDataService = sensorDataService;
    }

    public void setThetaDegrees(double theta) {
        this.thetaDegrees = theta;
    }

    public double getThetaDegrees() {
        return thetaDegrees;
    }

    public synchronized void start() {
        start(30);
    }

    public synchronized void start(double thetaDegrees) {
        if (running.get()) return;
        this.thetaDegrees = thetaDegrees;
        elapsedTime = 0;
        currentVelocity = 0;
        totalDisplacement = 0;
        zeroVelocityCount = 0;
        running.set(true);
        sensorDataService.clearAll();
        task = executor.scheduleAtFixedRate(this::tick, 0, TICK_MS, TimeUnit.MILLISECONDS);
        logger.info("Physical simulation started (track={}mm, mu={}±{}, tick={}ms, angle={}°)", (int) TRACK_LENGTH_MM, BASE_MU, MU_JITTER, TICK_MS, thetaDegrees);
    }

    public synchronized void stop() {
        stop("动能归零/到达终点");
    }

    public synchronized void stop(String reason) {
        running.set(false);
        if (task != null) {
            task.cancel(false);
            task = null;
        }
        sensorDataService.stop();
        logger.info("物理模拟已停止 · 原因: {} (t={:.3f}s, s={:.2f}mm, 共{}个数据点)", reason, elapsedTime, totalDisplacement * 1000.0, sensorDataService.size());
    }

    public boolean isRunning() {
        return running.get();
    }

    private void tick() {
        double dt = TICK_MS / 1000.0;
        double mu = BASE_MU + random.nextDouble() * MU_JITTER;
        double thetaRad = Math.toRadians(thetaDegrees);
        double a = G * (Math.sin(thetaRad) - mu * Math.cos(thetaRad));
        double vOld = currentVelocity;
        double vNew = vOld + a * dt;
        double ds = vOld * dt + 0.5 * a * dt * dt;

        double nextDisplacement = totalDisplacement + ds;

        if (nextDisplacement * 1000.0 >= TRACK_LENGTH_MM) {
            double remaining = TRACK_LENGTH_MM / 1000.0 - totalDisplacement;
            double tRemaining = dt * (remaining / ds);

            elapsedTime += tRemaining;
            currentVelocity = 0;
            totalDisplacement = TRACK_LENGTH_MM / 1000.0;

            sensorDataService.addDataPoint(
                    Double.parseDouble(String.format("%.3f", elapsedTime)),
                    TRACK_LENGTH_MM,
                    0.0,
                    0
            );

            logger.info("到达终点 · 速度归零 (t={:.3f}s, s={:.2f}mm)", elapsedTime, TRACK_LENGTH_MM);
            stop("到达轨道终点");
            return;
        }

        elapsedTime += dt;
        currentVelocity = vNew;
        totalDisplacement = nextDisplacement;

        // 动能/速度归零熔断
        if (vNew <= 0 && elapsedTime > 0.1) {
            zeroVelocityCount++;
        } else if (vNew > 0) {
            zeroVelocityCount = 0;
        }

        if (zeroVelocityCount >= 2) {
            sensorDataService.addDataPoint(
                    Double.parseDouble(String.format("%.3f", elapsedTime)),
                    Double.parseDouble(String.format("%.2f", nextDisplacement * 1000.0)),
                    0.0,
                    0
            );
            logger.info("动能归零 · 滑块静止 (t={:.3f}s, s={:.2f}mm)", elapsedTime, nextDisplacement * 1000.0);
            stop("动能归零");
            return;
        }

        sensorDataService.addDataPoint(
                Double.parseDouble(String.format("%.3f", elapsedTime)),
                Double.parseDouble(String.format("%.2f", nextDisplacement * 1000.0)),
                Double.parseDouble(String.format("%.2f", vNew * 1000.0)),
                a
        );
    }

    @PreDestroy
    public void shutdown() {
        stop("应用关闭");
        executor.shutdown();
    }
}
