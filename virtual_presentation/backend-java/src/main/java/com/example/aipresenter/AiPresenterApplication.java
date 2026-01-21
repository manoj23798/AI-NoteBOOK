package com.example.aipresenter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.io.File;

@SpringBootApplication
public class AiPresenterApplication {

	public static void main(String[] args) {
		// Ensure slides directory exists
		new File("slides").mkdirs();
		SpringApplication.run(AiPresenterApplication.class, args);
	}

}
