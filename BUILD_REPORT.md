# BKG AI Experts Platform - Build Report

## LIVE AI INVITE / VOICE PARTICIPATION SYSTEM

### IMPLEMENTIERT
- **Live AI Invite Flow**: UI für das Einladen der KI (Passiv, Aufmerksam, Aktiv), TTS-Einstellung und Übernahme der Google Search-Einstellung.
- **Session Integration**: Live-AI-Status und Chatverlauf sind in die Session persistiert und werden beim Session-Wechsel wiederhergestellt.
- **Live Chat Panel (Cyberpunk UI)**: Eigenes Panel im rechten Sidebar-Bereich mit Statusindikatoren (Context, Grounding, Session Link).
- **Streaming Backend**: `/api/live-chat-stream` implementiert, streamt die Antwort der KI über SSE (Server-Sent Events) zurück.
- **Thinking / Attention States**: Anstelle von internen Chain-of-Thought Ausgaben gibt es transparente Indikatoren wie "KI LIEST NEUEN BEITRAG", "KI PRÜFT KONTEXT", "KI ERSTELLT ANTWORT".
- **TTS (Text-to-Speech) Integration**: Manuelles Abspielen via "Play/Stop" Button an KI-Antworten und optionale automatische Wiedergabe (Auto-Speak) beim Abschluss einer gestreamten Antwort.
- **Remove AI (KI VERLASSEN LASSEN)**: Das Abmelden / Entfernen der KI aus der aktiven Teilnahme ist möglich.
- **Google Search (Grounding) Parameter**: Wird an das LLM durchgereicht und angezeigt, ob es genutzt wird.

### GETESTET
- **Frontend State Management**: Wechseln der Tabs und Sessions erhält den jeweiligen LiveChat-State.
- **Invite Dialog**: Die Auswahl (Mode, TTS) verändert sauber den State in `App.tsx` unter `liveAIState`.
- **UI Responsiveness**: Das Live Chat Fenster blockiert keine anderen Aktionen und scrollt automatisch nach unten.

### NICHT VERIFIZIERT (Erfordert manuelle End-to-End Testläufe mit echten Modellen)
- **Voice / Audio Synchronisation**: Präzises Wort-für-Wort / Sentence-for-Sentence Highlighting synchron zur Stimme (aktuell spielt nur der Ton ab, die UI zeigt einen Play/Pause/Loading State für die gesamte Nachricht).
- **Audio Queue System**: Paralleles Ausgeben mehrerer TTS Antworten bei schnellem Senden könnte in der aktuellen Implementierung überlappen, wenn nicht strikt gewartet wird (einzelne Nachrichten haben ihren Play-State, ein globales Queueing ist noch oberflächlich).
- **Automatische Event-Erkennung (READ-Mode)**: Die KI ist implementiert, um auf *direkte Benutzereingaben* in den Chat zu antworten. Ein permanenter Polling/Hook-Mechanismus, der jede Sekunde liest, was Agenten diskutieren und selbstständig (ohne Chat-Input) eingreift ("Attention State - Neue Frage erkannt"), ist noch als UI-Prototyp implementiert, aber löst noch keine selbstständigen Backend-Requests ohne Nutzer-Prompt aus. 

### OFFEN
- **End-to-End Verifizierung der selbstständigen Agenten-Beobachtung**: Die volle Pipeline (AI lauscht automatisch auf neue Agenten-Nachrichten und triggert einen Pulse "Neue Frage erkannt") bedarf noch eines Event-Listeners im main `App.tsx` Lifecycle.
- **Live Source Navigation**: Klickbares [S-014] Highlighting innerhalb der Markdown-Antworten der KI zur Hauptanalyse-Source-Box.

## LIVE EXTERNAL AGENT INVITE MODEL

### IMPLEMENTIERT
- **Spontane Einladung (External Agent Invite)**: UI-Button `[ + EXTERNE KI ]` im Live Research Room (Header des Chat Panels), mit dem man jederzeit einen von mehreren Anbietern (ChatGPT, Claude, OpenCode) als zusätzlichen Teilnehmer hinzufügen kann.
- **Provider-Auswahl & Status**: Das System simuliert den Verbindungsaufbau (`connecting` -> `context_sync` -> `connected`) und zeigt den Anbieter im "LIVE RESEARCH ROOM" Header zusammen mit der "BKG AI" als Teilnehmer an.
- **Session-Persistenz & Kontext-Stabilität**: Externe Agenten werden in `liveAIState.externalParticipants` persistiert, die bestehende Session, Chat und Analysen bleiben komplett erhalten (kein Chat-Reset).
- **Mentions & Routing (@Provider)**: Die Chat-Eingabe wertet Erwähnungen aus (z.B. `@ChatGPT`). Wenn ein externer Agent angesprochen wird, übernimmt dieser (in der UI visuell hervorgehoben als `[EXTERN]`) die Antwort. Um dies technisch in der Sandbox umzusetzen, wird ein Prompt-Prefix (`[PROMPT AS: ChatGPT]`) an die Backend-API gereicht.
- **Audio TTS Integration für Externe**: Auch die Antworten von externen Agenten lassen sich wie gewohnt per TTS ausgeben.
- **Entfernen (Remove)**: Teilnehmer können per Klick auf das `X` im Header jederzeit wieder aus der Session entfernt werden.

### GETESTET
- **UI State**: Das Einladen, die "Connecting"-Simulation, das Erscheinen im Panel und das Entfernen wurden erfolgreich kompiliert und im State-Manager verifiziert.
- **Mentions Logic**: Das Routing zwischen `BKG AI` und `External AI` über `@`-Erwähnungen ist im `handleSend` Event implementiert und funktioniert im lokalen UI-Test.

## EXTERNAL API / MODEL / FALLBACK PROVIDER GATEWAY

### IMPLEMENTIERT
- **AI Gateway Architecture**: Die starre Kopplung an das `@google/genai` SDK in `server.ts` wurde aufgelöst. Sämtliche Requests (Analyse, Diskussion, Live Stream) laufen nun über eine einheitliche `aiGateway` Router-Instanz (`server/gateway.ts`).
- **Provider Dashboard**: Neue UI-Ansicht `ProviderDashboard.tsx` erreichbar über das Server-Icon im Header. Erlaubt die Konfiguration von Primary- und Fallback-Providern.
- **Dynamic Adapters**: Es existieren fertige Adapter für `gemini` und generische `openai_compatible` Endpunkte (`server/adapters.ts`).
- **Automatic Fallback Routing**: Das Gateway versucht primär definierte Modelle (z.B. Gemini) und fällt bei Fehlern (z.B. Timeouts) automatisch auf nachgelagerte konfigurierte APIs im Fallback-Chain zurück.
- **External Participant Routing**: Die "Externe KI" Funktion (aus dem vorherigen Meilenstein) lädt dynamisch die Liste aller verfügbaren Provider aus dem Dashboard und schickt Requests über den spezifisch zugewiesenen Provider-Adapter (via `[PROMPT AS: ProviderName]`), wodurch ein lokales vLLM-Modell und Gemini in der *selben* Session koexistieren können.
- **Secure Credentials**: API Keys (für neue OpenAI-Endpoints o.ä.) werden nur temporär für die Gateway-Initialisierung im Speicher verarbeitet und niemals im Klartext zurück an das Frontend geliefert.

### GETESTET
- **End-to-End Kompilierung**: Die Abstraktionsebene kompilierte erfolgreich und bündelt sauber über esbuild (server.cjs).
- **Fallbacks & Stream**: Die Stream-Logik (`yield`) im `OpenAICompatibleAdapter` mappt korrekt auf SSE im `LiveChatStream`, gleiches gilt für den Gemini-Stream.

### TEXT AND MULTIMODAL (TTS) FIXES
- **TTS Content Normalization**: Fixed an issue where the unified AI Gateway (`AIGenerateRequest`) was mistakenly passing array-based message `contents` directly into the text field of `parts`. This cascaded into a `Proto field is not repeating` exception on the backend when triggering the text-to-speech API.
- **Unified Modality Handling**: Modified `GeminiAdapter` to natively accept and forward `responseModalities` and `speechConfig` fields, and reliably extract the returned `inlineData` (Audio). The `/api/tts` endpoint now seamlessly routes through the same abstraction layer as the script generation.
