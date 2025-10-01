# Data Tracking, Ingestion, and AI Integration Guidelines

Refer to [README.md](./README.md) and [Structure.md](./Structure.md) for project context and architecture. This document provides guidelines for implementing efficient data tracking, backend ingestion, cleaning pipelines, and AI model integration in Strades.

Always follow the data flow from the json files in the data/ directory to the frontend components in both way to insure that everything extracted is shown. In the other way, everything interacted with should be tracked and stored in the json files.

## Base Concepts in Data Handling

### Event-Driven Architecture
Strades employs an event-driven approach for capturing user interactions, ensuring non-blocking data collection. Events are standardized JSON objects with fields like `userId`, `timestamp`, `eventType`, `target`, and `dataPayload`.

### Asynchronous Data Processing
All tracking operations must be asynchronous to maintain UI responsiveness. Use WebSockets for real-time streaming and client-side queuing for reliability.

### Data Lifecycle
Data flows from raw events → aggregated insights → AI training features. Implement scheduled jobs for cleaning and compression to manage storage efficiently.

## Frontend Tracking Implementation

### Efficient Event Capture
Prioritize performance to avoid impacting user experience:

- **Macro Activities (Session/Page Level)**: Capture session start/end via Nuxt middleware/plugins, using `navigator.sendBeacon()` for reliable unload logging. Track page views with Nuxt Router hooks, logging path, component, and timestamp.
- **Micro Activities (Interactions)**: Implement custom composables (e.g., `useTracker()`) or Vue directives (e.g., `v-track:click`) for easy event binding.
- **High-Frequency Events**: For chart interactions, throttle updates (e.g., 100ms intervals) and batch data client-side before transmission.
- **Data Payload Logging**: Include dataset IDs, types, and actions in events for comprehensive tracking.

### Data Transmission Strategy
Ensure high-volume, low-latency handling:

- **WebSockets**: Use Socket.io for real-time event streaming to the backend.
- **Client-Side Queuing**: Implement IndexedDB-based queues for offline resilience, batching events during connection issues.

## Backend Data Ingestion

### Scalable Ingestion Architecture
Design for high-throughput writes:

- **Server-Side Handling**: Utilize Nuxt server API routes or separate Node.js/Express microservices for WebSocket management.
- **Event Schema Standardization**: Maintain lightweight JSON structure for all events (see example below) to ensure consistency and parsing efficiency.

```json
{
  "userId": "uuid",
  "timestamp": 1678886400000,
  "eventType": "click",
  "target": "chart_button_buy",
  "dataPayload": {
    "instrumentId": "BTC-USD",
    "value": 1.0,
    "coords": []
  }
}
```

### High-Volume Storage Solutions
Select databases optimized for time-series and document data:

- **Time-Series Databases (TSDB)**: Use InfluxDB or TimescaleDB for fast ingestion of timestamped events and efficient querying.
- **Document Databases**: Employ MongoDB for flexible schemas accommodating varied `dataPayload` structures.

## Data Cleaning and Compression Pipeline

### Asynchronous Processing Workflow
Implement scheduled, non-blocking jobs for data management:

- **Scheduling**: Use Cron or BullMQ for periodic execution (e.g., daily at 3:00 AM local time).
- **Aggregation Logic**: Transform raw events into summarized insights. Example: Convert 1000 hourly clicks into aggregated metrics like interaction counts, time ranges, and max values per instrument.

### Data Bucketing and Storage Strategy
Organize data hierarchically:

- **Bucketing**: Aggregate into time-based buckets (e.g., hourly, daily, weekly) for efficient querying.
- **Tiered Storage**:
  - **Short-Term Analytical DB**: Store compressed aggregates in PostgreSQL/TimescaleDB for real-time user reporting.
  - **Long-Term Archival**: Compress raw logs with Gzip/Snappy and archive to S3, GCS, or data lakes for future re-analysis.

## Behavioral Reporting and AI Training

### User Dashboard Integration
Leverage aggregated data for personalized insights:

- **Visualization Techniques**: Implement heatmaps for trading time distributions and bar charts for data preference metrics.
- **Real-Time Updates**: Query analytical DB for dynamic dashboard population.

### AI Model Development
Create predictive avatars based on behavioral data:

- **Feature Engineering**: Extract features from aggregated data, including market context (price, volume) and behavioral patterns (trade frequency, profitability).
- **Model Architecture**: Use RNNs (e.g., LSTM) or Transformers for sequence modeling of time-series behaviors.
- **Training Pipeline**:
  - **Base Model**: Train on anonymized global datasets for general market knowledge.
  - **Personalization**: Fine-tune with user-specific aggregates for individualized predictions.
- **Deployment**: Host as a microservice (Flask/FastAPI) for real-time querying by the application.