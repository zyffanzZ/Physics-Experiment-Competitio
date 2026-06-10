package com.example.deepseekagent.service;

public class ConductivityCalculator {

    // 实验装置物理常量（标准国际单位）
    private static final double M = 0.1;          // 滑块质量 kg
    private static final double G = 9.81;         // 重力加速度 m/s²
    private static final double THETA_RAD = Math.toRadians(30); // 斜面倾角 → 弧度
    private static final double B = 0.5;          // 磁感应强度 T
    private static final double D = 0.01;         // 垫板厚度 m
    private static final double A = 0.001;        // 有效接触面积 m²

    // 金属材质标准数据库（电导率 σ，单位 S/m）
    private static final MetalEntry[] METALS = {
        new MetalEntry("银 (Silver)",   6.30e7),
        new MetalEntry("铜 (Copper)",   5.96e7),
        new MetalEntry("铝 (Aluminum)", 3.77e7),
        new MetalEntry("铁 (Iron)",     1.00e7),
        new MetalEntry("不锈钢 (Stainless Steel)", 1.45e6),
    };

    private record MetalEntry(String name, double sigma) {}

    /**
     * Calculate conductivity sigma (S/m) from max stable velocity (mm/s) at given angle.
     */
    public static double calculateSigma(double vMaxMmPerSec, double angleDegrees) {
        double thetaRad = Math.toRadians(angleDegrees);
        double vMax = vMaxMmPerSec / 1000.0;
        double k = (M * G * Math.sin(thetaRad)) / vMax;
        return k / (B * B * D * A);
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
     * 返回科学计数法字符串，如 "5.96×10^7 S/m"
     */
    public static String formatSigma(double sigma) {
        int exp = (int) Math.floor(Math.log10(sigma));
        double mantissa = sigma / Math.pow(10, exp);
        return String.format("%.2f×10^%d S/m", mantissa, exp);
    }
}
