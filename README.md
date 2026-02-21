## Symbiosis: Environmental Policy & Data Nexus
### Ishani Bakshi Hack for Humanity 2026
### Overview
Symbiosis is a full-stack platform designed to bridge the gap between abstract environmental legislation and tangible ecological impact. By integrating a global database of environmental policies with real-time and historical telemetry, the tool allows users to visualize how legislative actions correlate with shifts in CO2 emissions, renewable energy adoption, and air quality. The system features an organic network mapping interface, a dual-country comparison dashboard, and an AI-driven policy workshop for analyzing draft ordinances.

### Key Features

* Interactive Network Map: Visualizes the interconnectedness of global policies based on shared mechanisms (ex:carbon pricing or plastic bans), regions-implemented, issued addressed, or any other keyword filteration using a physics-based organic layout.

 <img width="496" height="248.5" alt="Screenshot 2026-02-21 at 11 34 04 AM" src="https://github.com/user-attachments/assets/e054ffac-eea7-44ea-8fb8-c3e54423bbc8" />

* Live Dashboard: Provides synchronized time-series visualizations for CO2, Renewables, and PM2.5 levels of each region, allowing you to compare the progress of different regions with different environmental policy implementations.
  <img width="1029" height="274" alt="Screenshot 2026-02-21 at 11 37 50 AM" src="https://github.com/user-attachments/assets/93bcc9f2-9009-477f-94bd-7ef44cd47be6" />


* AI Policy Analyzer: Allows users to upload PDF-based policy drafts or local ordinances to receive instant comparative analysis, similarity matching, and improvement recommendations grounded in the global corpus.
  <img width="927" height="251" alt="Screenshot 2026-02-21 at 11 39 57 AM" src="https://github.com/user-attachments/assets/9a8fa7b9-456f-4d95-b095-727a41268b51" />


* Formal Briefing Generator: Programmatically assembles professional environmental briefs by synthesizing live metric snapshots with historical policy data for a selected region.

* Intelligent Policy Assistant: A persistent chat interface that utilizes Retrieval-Augmented Generation (RAG) to provide expert-level analysis while strictly preventing AI hallucinations.
  <img width="634.5" height="380.5" alt="Screenshot 2026-02-21 at 11 41 37 AM" src="https://github.com/user-attachments/assets/cc8af570-c8a0-4cb0-81c8-06edfb8a90f7" />


### Tech Stack & Implementation Details
* Flask (Python): Utilized as the backend backbone to manage API routing, document parsing, and the orchestration of the AI engine.

* LangChain & FAISS: These tools enable the RAG (Retrieval-Augmented Generation) pipeline. FAISS is used for high-speed vector similarity searches, allowing the AI to query the local policy database for context before generating responses.

* GreenPT API (OpenAI-Compatible): Serves as the Large Language Model (LLM) provider, chosen for its specialized focus on environmental policy data and reliable embedding models.

* Vis.js: Employed to render the policy network graph, specifically using the forceAtlas2Based physics solver to mimic biological root systems and reveal organic clusters in global legislation.

* Chart.js & Annotation Plugin: Handles the rendering of complex, overlapping time-series data and ensures that policy events are visually aligned with numerical data points.

* PyPDF2: Integrated for server-side PDF text extraction, facilitating the analysis of user-uploaded documents without requiring persistent file storage.

### Data Sources
* Policy Database: A curated collection of over 80 major environmental laws and mandates across various categories including Climate, Energy, and Biodiversity.

* World Bank Open Data API: The primary source for historical CO2 per capita, renewable energy share, and historical PM2.5 metrics.

* OpenAQ API: Integrated to provide live, real-time PM2.5 measurements from global sensor networks to supplement historical data.

### Implementation and Setup
### Directory Structure 
<img width="683" height="296" alt="Screenshot 2026-02-21 at 11 24 16 AM" src="https://github.com/user-attachments/assets/985a9823-3e68-49bf-96ce-7d11a8697179" />

### Terminal Set-up
* Create a .env file and add your greenpt_api_key and openaq_api_key
* Install dependencies: pip install flask pandas requests langchain-community langchain-openai faiss-cpu pypdf2 python-dotenv
* Launch: python app.py
* Open Browser to http://127.0.0.1:5000

