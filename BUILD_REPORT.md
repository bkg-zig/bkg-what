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
