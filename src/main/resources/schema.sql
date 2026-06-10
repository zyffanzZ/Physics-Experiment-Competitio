CREATE TABLE IF NOT EXISTS experiment_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    experiment_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    angle_degrees DOUBLE NOT NULL DEFAULT 30,
    total_displacement DOUBLE,
    total_time DOUBLE,
    final_velocity DOUBLE,
    acceleration DOUBLE,
    conductivity VARCHAR(100),
    metal_material VARCHAR(100),
    data_points_count INT,
    data_json CLOB,
    report_text CLOB
);

CREATE TABLE IF NOT EXISTS visit_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(50) NOT NULL,
    visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    device_type VARCHAR(100),
    browser_name VARCHAR(100),
    os_name VARCHAR(100),
    screen_resolution VARCHAR(50),
    language VARCHAR(50),
    referrer VARCHAR(500),
    user_agent CLOB
);

CREATE TABLE IF NOT EXISTS user_feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(50),
    feedback_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contact VARCHAR(255),
    content CLOB NOT NULL
);
