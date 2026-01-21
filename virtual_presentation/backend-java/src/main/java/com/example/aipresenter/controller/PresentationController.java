package com.example.aipresenter.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.apache.poi.sl.usermodel.Slide;
import org.apache.poi.sl.usermodel.SlideShow;
import org.apache.poi.sl.usermodel.SlideShowFactory;

import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.Color;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;

@RestController
@CrossOrigin(origins = "*") // Simple CORS for MVP
@RequestMapping("/api")
public class PresentationController {

    private static final String SLIDES_DIR = "slides";

    @PostMapping("/upload")
    public ResponseEntity<?> uploadSlides(@RequestParam("files") List<MultipartFile> files) {
        try {
            System.out.println("DEBUG: Entering uploadSlides with " + (files != null ? files.size() : "null") + " files.");
            
            if (files == null || files.isEmpty()) {
                return ResponseEntity.badRequest().body("No files provided");
            }

            // Clear directory
            File dir = new File(SLIDES_DIR);
            
            if (!dir.exists()) {
                boolean created = dir.mkdirs();
                System.out.println("DEBUG: Directory created: " + created);
            } else {
                File[] existingFiles = dir.listFiles();
                if (existingFiles != null) {
                    System.out.println("DEBUG: Deleting " + existingFiles.length + " existing files.");
                    for (File f : existingFiles) f.delete();
                }
            }

            List<String> savedFiles = new ArrayList<>();
            for (MultipartFile file : files) {
                if (file.isEmpty()) continue;
                String originalFilename = file.getOriginalFilename();
                if (originalFilename == null) originalFilename = "unknown";
                
                String lowerName = originalFilename.toLowerCase();
                if (lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx")) {
                    System.out.println("DEBUG: Processing Presentation: " + originalFilename);
                    List<String> slideImages = processPresentation(file, savedFiles.size());
                    savedFiles.addAll(slideImages);
                } else {
                    System.out.println("DEBUG: Saving image file: " + originalFilename);
                    Path path = Path.of(SLIDES_DIR, originalFilename);
                    Files.copy(file.getInputStream(), path, StandardCopyOption.REPLACE_EXISTING);
                    savedFiles.add(originalFilename);
                }
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Uploaded/Converted " + savedFiles.size() + " slides");
            response.put("slides", savedFiles);
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            e.printStackTrace(); 
            return ResponseEntity.internalServerError().body("Backend Error: " + e.toString());
        }
    }

    private List<String> processPresentation(MultipartFile file, int startIndex) throws IOException {
        List<String> generatedFiles = new ArrayList<>();
        try (SlideShow<?, ?> slideShow = SlideShowFactory.create(file.getInputStream())) {
            Dimension pgsize = slideShow.getPageSize();
            List<? extends Slide<?, ?>> slides = slideShow.getSlides();
            
            System.out.println("DEBUG: Found " + slides.size() + " slides in " + file.getOriginalFilename());

            for (int i = 0; i < slides.size(); i++) {
                Slide<?, ?> slide = slides.get(i);
                BufferedImage img = new BufferedImage(pgsize.width, pgsize.height, BufferedImage.TYPE_INT_ARGB);
                Graphics2D graphics = img.createGraphics();
                
                // Clear background
                graphics.setPaint(Color.WHITE);
                graphics.fill(new java.awt.Rectangle(0, 0, pgsize.width, pgsize.height));

                // Render
                slide.draw(graphics);
                
                // Save
                String slideName = String.format("slide_%03d.png", startIndex + i);
                File outFile = new File(SLIDES_DIR, slideName);
                ImageIO.write(img, "png", outFile);
                
                generatedFiles.add(slideName);
                graphics.dispose();
            }
        }
        return generatedFiles;
    }

    @GetMapping("/current-state")
    public ResponseEntity<?> getState() {
        File dir = new File(SLIDES_DIR);
        String[] files = dir.list((d, name) -> name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg"));
        List<String> slideList = files != null ? Arrays.asList(files) : new ArrayList<>();
        Collections.sort(slideList);

        Map<String, Object> state = new HashMap<>();
        state.put("slide_index", 0);
        state.put("total_slides", slideList.size());
        state.put("slides", slideList);
        state.put("current_slide", slideList.isEmpty() ? null : slideList.get(0));
        
        return ResponseEntity.ok(state);
    }
}
