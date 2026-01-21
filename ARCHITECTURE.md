# System Architecture

This document outlines the high-level architecture of the **AI Notebook** SaaS application.

```mermaid
graph TD
    %% Styling
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef backend fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef database fill:#fff3e0,stroke:#ef6c00,stroke-width:2px;
    classDef external fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;
    classDef user fill:#fff,stroke:#333,stroke-width:2px;

    User([👤 User / Browser]) ::: user

    subgraph "AI Notebook Cloud / Local Host"
        direction TB
        
        subgraph "Frontend Layer"
            NextJS[🖥️ Next.js App\n(React + Tailwind)] ::: frontend
            AuthStore[🔐 LocalStorage\n(API Keys)] ::: frontend
        end

        subgraph "Backend Layer"
            FastAPI[⚙️ FastAPI Server] ::: backend
            
            subgraph "Orchestration Engine"
                LangGraph[🧠 LangGraph\n(Stateful Agents)] ::: backend
                ContextBuilder[📝 Context Builder] ::: backend
            end
            
            ModelMgr[🔌 Model Manager\n(Esperanto)] ::: backend
        end

        subgraph "Data Layer"
            SurrealDB[(🗄️ SurrealDB)] ::: database
            Vectors[Everything Embeddings] ::: database
            RelData[Structured Data] ::: database
        end
    end

    subgraph "AI Providers (BYOK)"
        OpenAI[☁️ OpenAI] ::: external
        Anthropic[☁️ Anthropic] ::: external
        Ollama[🏠 Ollama (Local)] ::: external
    end

    %% Data Flow
    User <-->|HTTPS Interaction| NextJS
    User -.->|Input API Key| AuthStore
    
    NextJS <-->|REST / SSE Streams\n(Authentication Header)| FastAPI
    
    FastAPI -->|Invoke| LangGraph
    LangGraph -->|Retrieve| ContextBuilder
    
    ContextBuilder <-->|Vector Search| SurrealDB
    FastAPI <-->|CRUD Operations| SurrealDB
    
    SurrealDB --- Vectors
    SurrealDB --- RelData
    
    LangGraph -->|Generate| ModelMgr
    ModelMgr <-->|API Calls| OpenAI
    ModelMgr <-->|API Calls| Anthropic
    ModelMgr <-->|Local Inference| Ollama
```

## Component Overview

### 1. Frontend (Next.js)
- **Framework**: Next.js 14 (App Router)
- **Function**: Handles the user interface, routing, and client-side state.
- **Security**: Manages the "Bring Your Own Key" (BYOK) flow by storing API keys securely in the user's browser (LocalStorage) and injecting them into API request headers (`X-OpenAI-Key`).
- **Communication**: Communicates with the backend via REST endpoints and Server-Sent Events (SSE) for real-time chat streaming.

### 2. Backend (FastAPI)
- **Framework**: FastAPI (Python)
- **Function**: The core logic engine.
- **Modules**:
    - **Routers**: Endpoints for chat, notebooks, sources, and podcasts.
    - **LangGraph**: Orchestrates complex AI workflows (e.g., recursive research, chat history management).
    - **Model Manager**: An abstraction layer (Esperanto) to switch seamlessly between different AI providers (OpenAI, Anthropic, etc.).

### 3. Database (SurrealDB)
- **Type**: Multi-model database (Relational + Graph + Document).
- **Function**:
    - Stores structured data (Notebooks, Notes, Sources).
    - Stores **Vector Embeddings** for semantic search (RAG).
    - Handles graph relationships between different knowledge entities.

### 4. External Providers
- **Role**: Provide Large Language Model (LLM) capabilities.
- **Integration**: The backend connects to these providers using the keys supplied by the frontend, ensuring the server doesn't need to store sensitive user credentials.
