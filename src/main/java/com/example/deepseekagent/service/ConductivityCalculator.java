package com.example.deepseekagent.service;

public class ConductivityCalculator {

    // ========== 实验装置物理常量（标准国际单位） ==========
    // 更新：v2.3.2 — 匹配新三阶段物理模型参数
    private static final double M = 0.03;           // 滑块质量 kg
    private static final double G = 9.81;           // 重力加速度 m/s²
    private static final double B = 0.5;            // 磁感应强度 T
    private static final double D = 0.02;           // 垫板厚度 m
    private static final double A = 2e-5;           // 有效接触面积 m² (2×10⁻⁵)

    // ========== 金属材质标准数据库（电导率 σ，单位 S/m） ==========
    private static final MetalEntry[] METALS = {
            new MetalEntry("银 (Silver)", 6.30e7),
            new MetalEntry("铜 (Copper)", 5.96e7),
            new MetalEntry("铝 (Aluminum)", 3.50e7),
            new MetalEntry("铁 (Iron)", 1.03e7),
            new MetalEntry("镍 (Nickel)", 1.43e7),
            new MetalEntry("锌 (Zinc)", 1.69e7),
            new MetalEntry("锡 (Tin)", 8.69e6),
            new MetalEntry("铅 (Lead)", 4.55e6),
            new MetalEntry("不锈钢 304 (SS304)", 1.45e6),
    };

    private record MetalEntry(String name, double sigma) {}

    /**
     * 新物理模型：通过初始加速度 a₀ 和终端速度 v∞ 反推电导率
     * 公式：σ = m·a₀ / (B²·d·A·v∞)
     * 其中 a₀ = g·sinθ（释放瞬间加速度）
     */
    public static double calculateSigma(double vMaxMmPerSec, double angleDegrees) {
        double thetaRad = Math.toRadians(angleDegrees);
        double a0 = G * Math.sin(thetaRad);        // 初加速度 m/s²
        double vMax = vMaxMmPerSec / 1000.0;       // 终端速度 → m/s
        return (M * a0) / (B * B * D * A * vMax);
    }

    /**
     * Convenience method using default 30-degree angle.
     */
    public static double calculateSigma(double vMaxMmPerSec) {
        return calculateSigma(vMaxMmPerSec, 30);
    }

    /**
     * 绝对误差最小原则匹配最接近的金属
     */
    public static String matchMetal(double sigma) {
        MetalEntry best = METALS[0];
        double minDiff = Double.MAX_VALUE;
        for (MetalEntry m : METALS) {
            double diff = Math.abs(m.sigma - sigma);
            if (diff < minDiff) {
                minDiff = diff;
                best = m;
            }
        }
        return best.name;
    }

    /**
     * 返回科学计数法字符串，如 "1.50×10⁶ S/m"
     */
    public static String formatSigma(double sigma) {
        int exp = (int) Math.floor(Math.log10(sigma));
        double mantissa = sigma / Math.pow(10, exp);
        return String.format("%.2f×10^%d S/m", mantissa, exp);
    }
}
