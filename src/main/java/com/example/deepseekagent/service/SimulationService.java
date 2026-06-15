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

    // ========== 30°参考数据（来源：模拟数据_30度斜面.txt）==========
    // 三段物理模型：加速减弱 → 匀速 → 正弦刹车 → 静止
    // 无随机噪声，每次回放完全一致
    private static final double[] REF_TIME = {
            0.050, 0.100, 0.150, 0.200, 0.250, 0.300, 0.350, 0.400,  // 加速段
            0.450, 0.500, 0.550, 0.600, 0.650, 0.700, 0.750, 0.800,
            0.850, 0.900, 0.950, 1.000, 1.050, 1.100, 1.150, 1.200,
            1.250, 1.300, 1.350, 1.400, 1.450, 1.500, 1.550, 1.600,
            1.650, 1.700, 1.750, 1.800, 1.850, 1.900, 1.950, 2.000,
            2.048,                                                       // 匀速段末
            2.098, 2.148, 2.198, 2.248, 2.298,                          // 刹车段
            2.348                                                         // 静止
    };

    private static final double[] REF_DISP = {
            5.8, 22.2, 47.9, 81.2, 120.7, 164.8, 211.9, 260.6,
            309.6, 358.7, 407.7, 456.8, 505.8, 554.9, 603.9, 653.0,
            702.0, 751.1, 800.1, 849.2, 898.2, 947.3, 996.3, 1045.4,
            1094.4, 1143.5, 1192.5, 1241.6, 1290.6, 1339.7, 1388.7, 1437.8,
            1486.8, 1535.9, 1584.9, 1634.0, 1683.0, 1732.1, 1781.1, 1830.2,
            1877.4,
            1924.0, 1962.1, 1986.2, 1996.4, 2000.0,
            2000.0
    };

    private static final double[] REF_VEL = {
            229.9, 429.2, 597.8, 735.8, 843.0, 919.7, 965.7, 981.0,
            981.0, 981.0, 981.0, 981.0, 981.0, 981.0, 981.0, 981.0,
            981.0, 981.0, 981.0, 981.0, 981.0, 981.0, 981.0, 981.0,
            981.0, 981.0, 981.0, 981.0, 981.0, 981.0, 981.0, 981.0,
            981.0, 981.0, 981.0, 981.0, 981.0, 981.0, 981.0, 981.0,
            981.0,
            885.8, 636.4, 328.2, 78.9, 0.0,
            0.0
    };

    private static final double[] REF_ACC = {
            4598.4, 3985.3, 3372.2, 2759.1, 2145.9, 1532.8, 919.7, 306.6,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0.0,
            -1904.7, -4986.6, -6163.8, -4986.6, -1578.2,
            0.0
    };

    private static final int DATA_COUNT = REF_TIME.length; // 47

    // ========== 物理常量 ==========
    private static final double G = 9.81;
    private static final double TRACK_LENGTH_MM = 2000.0;
    private static final long TICK_MS = 50;    // 50ms回放间隔

    private final SensorDataService sensorDataService;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "simulation-tick");
        t.setDaemon(true);
        return t;
    });

    private ScheduledFuture<?> task;
    private final AtomicBoolean running = new AtomicBoolean(false);

    private double thetaDegrees = 30;
    private int dataIndex = 0;
    private double elapsedTime;
    private double currentVelocity;
    private double totalDisplacement;

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

    // ========== 回放角度缩放 ==========
    // 30°直接回放参考数据；其他角度按运动学缩放：
    //   v(θ) = v(30°) × sin(θ)/sin(30°)
    //   a(θ) = a(30°) × sin(θ)/sin(30°)
    //   位移不变（2000mm轨道固定）

    private static double sinOverSin30(double thetaDeg) {
        if (Math.abs(thetaDeg - 30) < 0.1) return 1.0;
        return Math.sin(Math.toRadians(thetaDeg)) / Math.sin(Math.toRadians(30));
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    public boolean isRunning() {
        return running.get();
    }

    private static double round3(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }

    public synchronized void start(double thetaDegrees) {
        if (running.get()) return;
        this.thetaDegrees = thetaDegrees;
        elapsedTime = 0;
        currentVelocity = 0;
        totalDisplacement = 0;
        dataIndex = 0;
        running.set(true);
        sensorDataService.clearAll();

        double scale = sinOverSin30(thetaDegrees);
        task = executor.scheduleAtFixedRate(() -> tick(scale), 0, TICK_MS, TimeUnit.MILLISECONDS);
        logger.info("物理模拟启动 (参考数据回放, {}点, angle={}°, scale={:.3f})",
                DATA_COUNT, thetaDegrees, scale);
    }

    public synchronized void stop() {
        stop("数据回放结束");
    }

    public synchronized void stop(String reason) {
        running.set(false);
        if (task != null) {
            task.cancel(false);
            task = null;
        }
        sensorDataService.stop();
        logger.info("物理模拟已停止 · {} ({}个数据点已回放)", reason, dataIndex);
    }

    private void tick(double scale) {
        if (dataIndex >= DATA_COUNT) {
            stop("全部 " + DATA_COUNT + " 个数据点已回放完毕");
            return;
        }

        double t = REF_TIME[dataIndex];
        double s = REF_DISP[dataIndex];
        double v = REF_VEL[dataIndex] * scale;
        double a = REF_ACC[dataIndex] * scale;

        sensorDataService.addDataPoint(
                round3(t),
                round1(s),
                round1(v),
                round1(a)
        );

        elapsedTime = t;
        currentVelocity = v;
        totalDisplacement = s;
        dataIndex++;

        logger.debug("回放 {}/{}: t={:.3f}s s={:.1f}mm v={:.1f}mm/s a={:.1f}mm/s²",
                dataIndex, DATA_COUNT, t, s, v, a);
    }

    @PreDestroy
    public void shutdown() {
        stop("应用关闭");
        executor.shutdown();
    }
}
