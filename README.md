# Intelligent Assistant

A conversational AI assistant designed for Tel Aviv, leveraging Google Gemini for natural language processing and intent determination. The system supports multiple concurrent users, manages conversation context, and integrates with simulated Google Places and Events APIs to provide recommendations and information.

## Features

- **Conversational AI**: Handles multi-turn conversations with context awareness.
- **Intent Recognition**: Uses Google Gemini to determine user intent (e.g., finding places, events, recommendations).
- **Personalization**: Stores user names and conversation history for tailored interactions.
- **Concurrency Support**: Handles multiple users simultaneously with in-memory session management.
- **Tel Aviv Focused**: All queries are scoped to Tel Aviv, with local data for places and events.
- **Hallucination Management**: Validates queries and ensures responses are based on available data.
- **Web Console**: Simple HTML/JS interface for interaction.

## Architecture

The application is built with a modular architecture to ensure scalability, maintainability, and clear separation of concerns.

### High-Level Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Console   │    │   Express API   │    │   Gemini AI     │
│   (HTML/JS)     │◄──►│   (Node.js)     │◄──►│   (Google)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Conversation    │
                       │ Manager         │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Intent Handlers │
                       │ (Places/Events) │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Local Data      │
                       │ (JSON Files)    │
                       └─────────────────┘
```

### Components

#### 1. Web Console (Frontend)
- **Files**: `index.html`, `main.js`, `style.css`
- **Purpose**: Provides a simple chat-like interface for user interaction.
- **Technology**: Vanilla HTML/JS for easy deployment and testing.

#### 2. Express API (Backend Server)
- **File**: `src/server.ts`
- **Purpose**: Handles HTTP requests, routes to command processing.
- **Technology**: Node.js with Express.
- **Concurrency**: Uses asynchronous handlers to support multiple concurrent requests from different users.

#### 3. Conversation Manager
- **File**: `src/services/conversationManager.ts`
- **Purpose**: Manages user sessions and context.
- **Features**:
  - Stores conversation history, user names, and waiting states.
  - Supports multiple users concurrently via a Map-based in-memory store.
  - Automatic cleanup of expired conversations (1-hour TTL) to prevent memory leaks.
- **Concurrency**: Thread-safe in Node.js single-threaded environment; uses Map for O(1) access.

#### 4. Query Validator
- **File**: `src/services/queryValidator.ts`
- **Purpose**: Validates and prepares user queries for processing.
- **Features**:
  - Handles clarification responses (e.g., missing category or time of day).
  - Integrates with Conversation Manager for context.

#### 5. Gemini AI Integration
- **File**: `src/services/gemini.ts`
- **Purpose**: Powers natural language understanding and response generation.
- **Features**:
  - **Intent Determination**: Extracts user intent (e.g., "find_places", "find_events") from raw text using structured prompts.
  - **Response Formatting**: Generates human-friendly responses based on data.
  - **Hallucination Prevention**: Uses strict prompts to ensure accurate, data-driven outputs.
- **Usage**: Called for intent extraction and final response crafting.

#### 6. Intent Handlers
- **File**: `src/commands.ts`
- **Purpose**: Routes intents to specific data retrieval and processing logic.
- **Features**:
  - Maps intents to handlers (e.g., `find_places` → search places).
  - Handles non-actionable intents (greetings, introductions) with friendly responses.
  - Ensures data accuracy by filtering based on category and time of day.
- **Concurrency**: Handlers are stateless and can process multiple requests in parallel.

#### 7. Data Services (Google Places/Events Simulation)
- **Files**: `src/services/googlePlaces.ts`, `src/services/googleEvents.ts`
- **Purpose**: Simulates external API calls using local JSON data.
- **Features**:
  - Filters data by category, time of day, and date.
  - Hardcoded to Tel Aviv for all queries.
- **Data Sources**: `data/places.telaviv.json`, `data/events.telaviv.json`

#### 8. Logger
- **File**: `src/logger.ts`
- **Purpose**: Centralized logging for debugging and monitoring.
- **Features**: Logs by source (e.g., command, gemini) for traceability.

### Data Flow

1. **User Input**: Received via Web Console → Express API.
2. **Intent Extraction**: Query Validator calls Gemini to determine intent and extract fields (category, timeOfDay, date).
3. **Validation**: Checks for missing fields; prompts for clarification if needed.
4. **Context Management**: Updates user context (history, name) in Conversation Manager.
5. **Intent Handling**: Routes to appropriate handler (places/events) based on intent.
6. **Data Retrieval**: Filters local JSON data by parameters.
7. **Response Generation**: Gemini formats the data into a natural response.
8. **Output**: Sent back to user via Web Console.

### Concurrency and Scalability

- **Multiple Users**: Each user has a unique ID; context is stored in a Map, allowing concurrent access without conflicts in Node.js.
- **Session Expiry**: Conversations expire after 1 hour to manage memory.
- **Async Operations**: All I/O (file reads, Gemini calls) is asynchronous, supporting high concurrency.
- **Limitations**: In-memory storage is not persistent; for production, replace with Redis or database.

### Security and Reliability

- **Input Validation**: Prevents injection by using structured prompts and type checking.
- **Error Handling**: Graceful fallbacks for API failures or invalid data.
- **Hallucination Mitigation**: Relies on local data; Gemini outputs are constrained to available information.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/stas7341/IntelligentAssistant.git
   cd IntelligentAssistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment (if needed for Gemini API key):
   - Add your Google Gemini API key to a `.env` file or environment variables.

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

6. Open `index.html` in a browser for the console interface.

## Usage

- Open the web console and start chatting (e.g., "Hi, I'm John. Find me restaurants in the evening.").
- The assistant will handle greetings, extract intent, and provide recommendations based on Tel Aviv data.

## API Endpoints

- `POST /api/chat`: Accepts `{ userId: string, message: string }` and returns a response.

## Contributing

- Follow TypeScript best practices.
- Add tests for new features.
- Update this README for architectural changes.

## License

MIT License.