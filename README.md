# AI NoteBOOK

An open source, privacy-focused alternative to Google's Notebook LM.

## Features

- **Privacy-First**: Your data stays under your control.
- **Multi-Model Support**: Supports OpenAI, Anthropic, Ollama, and more.
- **Podcast Generation**: Create multi-speaker podcasts from your content.
- **Intelligent Search**: Full-text and vector search.
- **Context-Aware Chat**: Chat with your research materials.

## Quick Start

### Docker Setup

```bash
docker run -d \
  --name ai-notebook \
  -p 8502:8502 -p 5055:5055 \
  -v ./notebook_data:/app/data \
  -v ./surreal_data:/mydata \
  -e OPENAI_API_KEY=your_key_here \
  manoj23798/ai-notebook:latest
```

Access at: http://localhost:8502
