package com.example.deepseekagent.service;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class SimulationService {

    private static final Logger logger = LoggerFactory.getLogger(SimulationService.class);

    // ========== 物理常量 ==========
    private static final double G = 9.81;                // 重力加速度 m/s²
    private static final double TRACK_LENGTH_MM = 2000.0; // 轨道总长度 mm

    // ========== 30°斜面三阶段参数 ==========
    private static final double A0 = G * 1000.0 * Math.sin(Math.toRadians(30)); // 初加速度 ≈ 4905 mm/s²
    private static final double T_ACCEL = 0.40;          // 阶段1 持续时间 s
    private static final double V_TERMINAL = 981.0;      // 终端速度 mm/s
    private static final double T_BRAKE = 0.25;          // 阶段3 刹车特征时间 s

    // ========== 时间步长 ==========
    private static final long TICK_MS = 50;              // 50ms tick
    private static final double DT = TICK_MS / 1000.0;   // 0.05 s

    // ========== 阶段标记值（未开始 = -1） ==========
    private static final double NOT_STARTED = -1.0;

    private final SensorDataService sensorDataService;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "simulation-tick");
        t.setDaemon(true);
        return t;
    });
    private ScheduledFuture<?> task;
    private final AtomicBoolean running = new AtomicBoolean(false);

    // ========== 运行时状态 ==========
    private double thetaDegrees = 30;
    private double elapsedTime;          // s
    private double currentVelocity;      // mm/s
    private double totalDisplacement;    // mm
    private double phase2EndTarget;      // mm — 阶段2结束时的目标位移
    private double phase3StartTime;      // s  — 阶段3开始的绝对时间
    private double aPeak;                // mm/s² — 阶段3峰值加速度

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

    // ========== 数值格式化 ==========
    private static double round2(double v) {
        return Double.parseDouble(String.format("%.2f", v));
    }

    private static double round3(double v) {
        return Double.parseDouble(String.format("%.3f", v));
    }

    public synchronized void start(double thetaDegrees) {
        if (running.get()) return;
        this.thetaDegrees = thetaDegrees;
        elapsedTime = 0;
        currentVelocity = 0;
        totalDisplacement = 0;
        phase2EndTarget = NOT_STARTED;
        phase3StartTime = NOT_STARTED;
        aPeak = 0;
        running.set(true);
        sensorDataService.clearAll();
        task = executor.scheduleAtFixedRate(this::tick, 0, TICK_MS, TimeUnit.MILLISECONDS);
        logger.info("物理模拟启动 (三阶段模型, track={}mm, tick={}ms, angle={}°)",
                (int) TRACK_LENGTH_MM, TICK_MS, thetaDegrees);
    }

    public boolean isRunning() {
        return running.get();
    }

    // ========== 三阶段物理模型 ==========

    public synchronized void stop() {
        stop("到达轨道终点");
    }

    public synchronized void stop(String reason) {
        running.set(false);
        if (task != null) {
            task.cancel(false);
            task = null;
        }
        sensorDataService.stop();
        logger.info("物理模拟已停止 · 原因: {} (t={:.3f}s, s={:.2f}mm, 共{}个数据点)",
                reason, elapsedTime, totalDisplacement, sensorDataService.size());
    }

    private void tick() {
        double t = elapsedTime;
        double a;          // 加速度 mm/s²
        double vNew;       // 新速度 mm/s
        double ds;         // 本步位移 mm
        double vOld = currentVelocity;

        // ---------- 阶段1：加速减弱段 (0 ~ T_ACCEL) ----------
        // 使用中点加速度的Euler积分，每一步 DT=0.05s
        if (t + DT <= T_ACCEL + 1e-9) {
            double tMid = t + DT / 2.0;
            a = A0 * (1.0 - tMid / T_ACCEL);
            vNew = vOld + a * DT;
            ds = vOld * DT + 0.5 * a * DT * DT;
            double sNew = totalDisplacement + ds;

            elapsedTime = t + DT;
            currentVelocity = vNew;
            totalDisplacement = sNew;

            sensorDataService.addDataPoint(
                    round3(elapsedTime),
                    round2(totalDisplacement),
                    round2(currentVelocity),
                    round2(a)
            );
            logger.debug("阶段1 t={:.3f}s v={:.1f} s={:.1f} a={:.1f}", elapsedTime, currentVelocity, totalDisplacement, a);

            // 阶段1结束：计算阶段2目标位移和阶段3峰值加速度
            if (Math.abs(elapsedTime - T_ACCEL) < 1e-4) {
                double sBrake = V_TERMINAL * T_BRAKE / 2.0;          // 刹车段理论位移 122.625mm
                phase2EndTarget = TRACK_LENGTH_MM - sBrake;          // 1877.375mm
                aPeak = V_TERMINAL * Math.PI / (2.0 * T_BRAKE);     // 峰值减速度 6163.8mm/s²
                logger.info("阶段1完成 → v={:.1f}mm/s s={:.2f}mm | 阶段2目标s={:.2f}mm A_peak={:.1f}mm/s²",
                        currentVelocity, totalDisplacement, phase2EndTarget, aPeak);
            }
            return;
        }

        // ---------- 阶段2：匀速段 ----------
        if (totalDisplacement < phase2EndTarget - 1e-6) {
            double remaining = phase2EndTarget - totalDisplacement;

            // 剩余位移不足一个完整步长 → 取部分步长精确抵达阶段2终点
            if (remaining < V_TERMINAL * DT) {
                double partialDt = remaining / V_TERMINAL;           // ~0.048s
                a = 0;
                vNew = V_TERMINAL;
                elapsedTime = t + partialDt;                         // ~2.048s (非完整步长)
                currentVelocity = vNew;
                totalDisplacement = phase2EndTarget;                 // 精确锁定 1877.375mm

                sensorDataService.addDataPoint(
                        round3(elapsedTime),
                        round2(totalDisplacement),
                        round2(currentVelocity),
                        round2(a)
                );
                logger.debug("阶段2 部分步长 t={:.3f}s s={:.2f}mm (dt={:.4f}s)", elapsedTime, totalDisplacement, partialDt);
                // 不return — 下一tick进入阶段3
                return;
            }

            // 完整步长
            a = 0;
            vNew = V_TERMINAL;
            ds = V_TERMINAL * DT;

            elapsedTime = t + DT;
            currentVelocity = vNew;
            totalDisplacement = totalDisplacement + ds;

            sensorDataService.addDataPoint(
                    round3(elapsedTime),
                    round2(totalDisplacement),
                    round2(currentVelocity),
                    round2(a)
            );
            logger.debug("阶段2 t={:.3f}s v={:.1f} s={:.1f}", elapsedTime, currentVelocity, totalDisplacement);
            return;
        }

        // ---------- 阶段3：正弦刹车段 ----------
        if (phase3StartTime < 0) {
            phase3StartTime = elapsedTime;
            logger.info("进入阶段3: t={:.3f}s v={:.1f} s={:.2f}mm", elapsedTime, currentVelocity, totalDisplacement);
        }

        double phase3T = t - phase3StartTime;

        // 刹车已结束 → 发射最终静止点，然后停止
        if (phase3T > T_BRAKE - 1e-9) {
            elapsedTime = t + DT;
            currentVelocity = 0;
            totalDisplacement = TRACK_LENGTH_MM;
            sensorDataService.addDataPoint(
                    round3(elapsedTime),
                    round2(totalDisplacement),
                    0.0,
                    0.0
            );
            logger.info("阶段3静止点 → t={:.3f}s v=0.0 s={:.2f}mm a=0.0", elapsedTime, totalDisplacement);
            stop("到达轨道终点 (三阶段模型)");
            return;
        }

        // 正常刹车tick：中点加速度Euler积分
        double tMid = phase3T + DT / 2.0;
        a = -aPeak * Math.sin(Math.PI * tMid / T_BRAKE);
        vNew = currentVelocity + a * DT;

        // Euler积分末端可能溢出为负 → 速度归零，反向推算本步有效加速度
        if (vNew < 0) {
            a = -currentVelocity / DT;                              // Δv/Δt = -1578.2 mm/s²
            vNew = 0;
            totalDisplacement = TRACK_LENGTH_MM;                    // 精确抵达终点
        } else {
            ds = currentVelocity * DT + 0.5 * a * DT * DT;
            totalDisplacement = totalDisplacement + ds;
            if (totalDisplacement > TRACK_LENGTH_MM) {
                totalDisplacement = TRACK_LENGTH_MM;
                vNew = 0;
            }
        }

        elapsedTime = t + DT;
        currentVelocity = vNew;

        sensorDataService.addDataPoint(
                round3(elapsedTime),
                round2(totalDisplacement),
                round2(currentVelocity),
                round2(a)
        );
        logger.debug("阶段3 t={:.3f}s v={:.1f} s={:.1f} a={:.1f}", elapsedTime, currentVelocity, totalDisplacement, a);

        // 不在此处stop() — 下一tick检测到 phase3T > T_brake 后自动发射静止点
    }

    @PreDestroy
    public void shutdown() {
        stop("应用关闭");
        executor.shutdown();
    }
}
