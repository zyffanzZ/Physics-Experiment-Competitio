package com.example.deepseekagent.service;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;

@Service
public class ExportService {

    public byte[] exportToExcel(List<Map<String, Object>> data, double angle) throws IOException {
        try (Workbook workbook = new XSSFWorkbook()) {
            // Sheet 1: Raw data
            Sheet dataSheet = workbook.createSheet("Raw Data");
            createHeaderStyle(workbook, dataSheet);

            int rowIdx = 0;

            // Parameter row
            Row paramRow = dataSheet.createRow(rowIdx++);
            Cell paramCell = paramRow.createCell(0);
            paramCell.setCellValue("Experiment Angle: " + angle + "°");
            paramCell.setCellStyle(createBoldStyle(workbook));

            rowIdx++; // empty row

            // Header row
            Row headerRow = dataSheet.createRow(rowIdx++);
            CellStyle headerStyle = createHeaderStyle(workbook, dataSheet);
            String[] headers = {"Time (s)", "Displacement (mm)", "Velocity (mm/s)", "Acceleration (mm/s²)"};
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            double sumVelocity = 0;
            double maxVelocity = Double.MIN_VALUE;
            double sumAccel = 0;
            int count = 0;

            for (Map<String, Object> point : data) {
                Row row = dataSheet.createRow(rowIdx++);
                double time = ((Number) point.get("time")).doubleValue();
                double displacement = ((Number) point.get("displacement")).doubleValue();
                double velocity = ((Number) point.get("velocity")).doubleValue();
                double acceleration = ((Number) point.get("acceleration")).doubleValue();

                row.createCell(0).setCellValue(time);
                row.createCell(1).setCellValue(displacement);
                row.createCell(2).setCellValue(velocity);
                row.createCell(3).setCellValue(acceleration);

                sumVelocity += velocity;
                if (velocity > maxVelocity) maxVelocity = velocity;
                sumAccel += acceleration;
                count++;
            }

            // Auto-size columns
            for (int i = 0; i < headers.length; i++) {
                dataSheet.autoSizeColumn(i);
            }

            // Sheet 2: Summary statistics
            Sheet summarySheet = workbook.createSheet("Summary");

            int sRow = 0;
            Row sTitle = summarySheet.createRow(sRow++);
            Cell sTitleCell = sTitle.createCell(0);
            sTitleCell.setCellValue("Experiment Summary (Angle: " + angle + "°)");
            sTitleCell.setCellStyle(createBoldStyle(workbook));
            sRow++;

            String[][] summaryData = {
                    {"Parameter", "Value"},
                    {"Total Data Points", String.valueOf(count)},
                    {"Total Displacement (mm)", count > 0 ? String.format("%.2f",
                            ((Number) data.get(data.size() - 1).get("displacement")).doubleValue()) : "N/A"},
                    {"Total Time (s)", count > 0 ? String.format("%.3f",
                            ((Number) data.get(data.size() - 1).get("time")).doubleValue()) : "N/A"},
                    {"Max Velocity (mm/s)", count > 0 ? String.format("%.2f", maxVelocity) : "N/A"},
                    {"Avg Velocity (mm/s)", count > 0 ? String.format("%.2f", sumVelocity / count) : "N/A"},
                    {"Avg Acceleration (mm/s²)", count > 0 ? String.format("%.2f", sumAccel / count) : "N/A"},
            };

            for (String[] rowData : summaryData) {
                Row row = summarySheet.createRow(sRow++);
                for (int i = 0; i < rowData.length; i++) {
                    Cell cell = row.createCell(i);
                    cell.setCellValue(rowData[i]);
                    if (sRow == 3) { // header row
                        cell.setCellStyle(createHeaderStyle(workbook, summarySheet));
                    }
                }
            }

            summarySheet.autoSizeColumn(0);
            summarySheet.autoSizeColumn(1);

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            workbook.write(baos);
            return baos.toByteArray();
        }
    }

    private CellStyle createHeaderStyle(Workbook workbook, Sheet sheet) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        style.setFont(font);
        style.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        return style;
    }

    private CellStyle createBoldStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        Font font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 14);
        style.setFont(font);
        return style;
    }
}
