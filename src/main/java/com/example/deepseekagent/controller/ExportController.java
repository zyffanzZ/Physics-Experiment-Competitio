package com.example.deepseekagent.controller;

import com.example.deepseekagent.service.ExportService;
import com.example.deepseekagent.service.SensorDataService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final ExportService exportService;
    private final SensorDataService sensorDataService;

    public ExportController(ExportService exportService, SensorDataService sensorDataService) {
        this.exportService = exportService;
        this.sensorDataService = sensorDataService;
    }

    @GetMapping("/excel")
    public ResponseEntity<byte[]> exportExcel() throws IOException {
        List<Map<String, Object>> data = sensorDataService.getCleanedData();
        double angle = sensorDataService.getAngle();

        byte[] excelBytes = exportService.exportToExcel(data, angle);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDispositionFormData("attachment", "experiment_data.xlsx");
        headers.setContentLength(excelBytes.length);

        return ResponseEntity.ok().headers(headers).body(excelBytes);
    }
}
