package com.example.deepseekagent.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Service
public class KnowledgeBaseService {

    private static final Logger logger = LoggerFactory.getLogger(KnowledgeBaseService.class);

    private String knowledgeContent = "";

    @PostConstruct
    public void init() {
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("physics_knowledge_base.md")) {
            if (is != null) {
                knowledgeContent = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                logger.info("Knowledge base loaded ({} bytes)", knowledgeContent.length());
            } else {
                logger.warn("physics_knowledge_base.md not found in classpath");
            }
        } catch (IOException e) {
            logger.error("Failed to load knowledge base", e);
        }
    }

    public String getKnowledgeContext() {
        return knowledgeContent;
    }
}
