import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { aiGateway } from './server/gateway';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

app.get('/api/providers', (req, res) => {
  res.json(aiGateway.getProviders());
});

app.post('/api/providers', (req, res) => {
  const { apiKey, ...config } = req.body;
  const newConfig = {
    ...config,
    id: config.id || `provider-${Date.now()}`,
    createdAt: config.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  aiGateway.addProviderConfig(newConfig, apiKey);
  res.json(newConfig);
});

async function generateContentWithRetry(params: any, retries = 5) {
  // Convert Gemini params to unified request format
  const systemPrompt = params.config?.systemInstruction;
  
  // Safely extract string content whether it is a string or an array of parts
  let contentString = '';
  if (typeof params.contents === 'string') {
    contentString = params.contents;
  } else if (Array.isArray(params.contents)) {
    contentString = params.contents.map((c: any) => c.parts?.map((p: any) => p.text).join('\n') || '').join('\n');
  } else if (params.contents?.parts) {
    contentString = params.contents.parts.map((p: any) => p.text).join('\n');
  }

  const messages = [{ role: 'user' as const, content: contentString }];
  
  const useGoogleSearch = !!params.tools?.find((t: any) => t.googleSearch);
  const responseSchema = params.config?.responseSchema;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await aiGateway.generate({
        systemPrompt,
        messages,
        useGoogleSearch,
        responseSchema,
        responseModalities: params.config?.responseModalities,
        speechConfig: params.config?.speechConfig,
        metadata: { overrideModel: params.model },
        temperature: params.config?.temperature,
      });
      return { 
        text: response.content, 
        audioBase64: response.audioBase64,
        trace: { provider: response.providerId, model: response.model, fallback: response.fallbackUsed } 
      };
    } catch (error: any) {
      const errorStr = String(error);
      const isOverloaded = error?.status === 503 || errorStr.includes('503') || errorStr.includes('UNAVAILABLE') || errorStr.includes('RATE_LIMIT');
      if (isOverloaded && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, attempt * 3000));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed after max retries");
}

function parseJSON(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  
  // Extract JSON block if surrounded by conversational text
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const startObj = cleaned.indexOf('{');
    const startArr = cleaned.indexOf('[');
    if (startObj !== -1 || startArr !== -1) {
       const start = startObj !== -1 && startArr !== -1 ? Math.min(startObj, startArr) : Math.max(startObj, startArr);
       const endObj = cleaned.lastIndexOf('}');
       const endArr = cleaned.lastIndexOf(']');
       const end = Math.max(endObj, endArr);
       if (end !== -1 && end > start) {
          cleaned = cleaned.substring(start, end + 1);
       }
    }
  }
  
  return JSON.parse(cleaned);
}

app.post('/api/analyze', async (req, res) => {
  try {
    const { text, knowledgeBaseStr, expertPair = 'General', language = 'Deutsch', useGoogleSearch } = req.body;
    
    let pairInstruction = "Die Experten (Alex und Sarah) sind allgemeine KI-Enthusiasten und geben zugängliche, ausgewogene Einblicke.";
    if (expertPair === 'Tech Focused') {
      pairInstruction = "Die Experten (Alex und Sarah) sind hochtechnische Ingenieure. Sie konzentrieren sich auf Implementierungsdetails, Architektur, Algorithmen und praktische technische Herausforderungen. Ihr Ton ist analytisch, präzise und praktisch.";
    } else if (expertPair === 'Ethical Reviewers') {
      pairInstruction = "Die Experten (Alex und Sarah) sind Forscher für KI-Ethik. Sie konzentrieren sich auf Voreingenommenheit, Fairness, gesellschaftliche Auswirkungen, Sicherheit und verantwortungsvolle KI-Richtlinien. Ihr Ton ist vorsichtig, kritisch und menschenzentriert.";
    } else if (expertPair === 'Academic Researchers') {
      pairInstruction = "Die Experten (Alex und Sarah) sind akademische Forscher. Sie konzentrieren sich auf theoretische Grundlagen, methodische Strenge, Peer-Review-Ergebnisse und historischen Kontext. Ihr Ton ist wissenschaftlich, objektiv und tiefgreifend theoretisch.";
    } else if (expertPair !== 'General') {
      // Custom agent instruction passed via expertPair string format!
      pairInstruction = `Die Experten (Alex und Sarah) nehmen folgende Rollen und Anweisungen an: ${expertPair}`;
    }

    const tools = useGoogleSearch ? [{ googleSearch: {} }] : undefined;

    const response = await generateContentWithRetry({
      model: 'gemini-3.6-flash',
      tools,
      contents: `Du bist der Orchestrator für einen KI-Experten-Podcast.
Der Benutzer hat folgenden Text zur Analyse bereitgestellt:
"${text}"

Du hast Zugriff auf folgende Wissensdatenbank (Knowledge Base) mit Schlüsselkonzepten und aktuellen Forschungsergebnissen in KI:
${knowledgeBaseStr}

Anweisungen für die Experten:
${pairInstruction}
Objektivitäts-Regel: Die individuelle Persönlichkeit der Agenten darf nicht die Verpflichtung zur objektiven Analyse außer Kraft setzen. Alle Aussagen müssen sachlich korrekt sein, bei Widersprüchen müssen diese benannt werden.

WICHTIGE SPRACHANWEISUNG: Du MUSST alle Texte, Zusammenfassungen, Analysen und das Gesprächsskript AUSSCHLIESSLICH auf ${language} ausgeben.

Deine Aufgabe ist:
1. Den Text kurz zusammenfassen.
2. Den Text kritisch auf sachliche Unstimmigkeiten, logische Lücken oder interessante Nuancen analysieren. Überprüfe den Text anhand der bereitgestellten Wissensdatenbank und (falls aktiv) per Google Suche.
3. Schreibe ein Gesprächsskript zwischen zwei KI-Experten (Alex und Sarah), die die Zusammenfassung und Analyse diskutieren.
   - Die Experten MÜSSEN ausdrücklich Quellen aus der Wissensdatenbank oder Suchergebnissen zitieren, wenn sie Fakten verwenden.
   - PROAKTIVES VERHALTEN: Am Ende ihres Gesprächs MÜSSEN die Experten proaktiv eine klärende Frage stellen oder einen neuen Analyseansatz vorschlagen.
4. Stelle eine genaue Liste der während der Analyse zitierten Quellen im Array 'sourceReferences' bereit. Ordne diese dem jeweiligen Dialog-Absatz (0-basierter Index) zu, in dem sie erwähnt werden.
5. Schlage 3 Folgefragen oder Themen vor.

Gib genau dieses JSON-Format aus. Das Skript MUSS exakt zeilenweise wie folgt formatiert sein:
Alex: [Dialog]
Sarah: [Dialog]
Alex: [Dialog]
...
`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "Eine kurze Zusammenfassung des Textes" },
            inconsistencies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Liste von gefundenen sachlichen Unstimmigkeiten oder logischen Lücken" },
            citations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Liste von aus der Wissensdatenbank zitierten Quellen" },
            sourceReferences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Eindeutige ID (z.B. 'src-1')" },
                  title: { type: Type.STRING, description: "Titel der Quelle" },
                  url: { type: Type.STRING, description: "URL falls vorhanden (nicht erfinden)" },
                  claim: { type: Type.STRING, description: "Die durch die Quelle belegte Behauptung" },
                  paragraphIndex: { type: Type.INTEGER, description: "0-basierter Index des Dialogabsatzes, in dem die Quelle zitiert wird" }
                },
                required: ["id", "title", "claim", "paragraphIndex"]
              }
            },
            script: { type: Type.STRING, description: "Das Gesprächsskript zwischen Alex und Sarah. Format: 'Alex: ... \\nSarah: ...'" },
            suggestedTopics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 vorgeschlagene Folgefragen oder Themen" }
          },
          required: ["summary", "inconsistencies", "script", "suggestedTopics", "sourceReferences"]
        }
      }
    });

    const data = parseJSON(response.text!);
    res.json({ ...data, trace: response.trace });
  } catch (error: any) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/discuss', async (req, res) => {
  try {
    const { history, userPrompt, knowledgeBaseStr, expertPair = 'General', language = 'Deutsch', useGoogleSearch } = req.body;
    
    let pairInstruction = "Die Experten (Alex und Sarah) sind allgemeine KI-Enthusiasten und geben zugängliche, ausgewogene Einblicke.";
    if (expertPair === 'Tech Focused') {
      pairInstruction = "Die Experten (Alex und Sarah) sind hochtechnische Ingenieure. Sie konzentrieren sich auf Implementierungsdetails, Architektur, Algorithmen und praktische technische Herausforderungen. Ihr Ton ist analytisch, präzise und praktisch.";
    } else if (expertPair === 'Ethical Reviewers') {
      pairInstruction = "Die Experten (Alex und Sarah) sind Forscher für KI-Ethik. Sie konzentrieren sich auf Voreingenommenheit, Fairness, gesellschaftliche Auswirkungen, Sicherheit und verantwortungsvolle KI-Richtlinien. Ihr Ton ist vorsichtig, kritisch und menschenzentriert.";
    } else if (expertPair === 'Academic Researchers') {
      pairInstruction = "Die Experten (Alex und Sarah) sind akademische Forscher. Sie konzentrieren sich auf theoretische Grundlagen, methodische Strenge, Peer-Review-Ergebnisse und historischen Kontext. Ihr Ton ist wissenschaftlich, objektiv und tiefgreifend theoretisch.";
    } else if (expertPair !== 'General') {
      pairInstruction = `Die Experten (Alex und Sarah) nehmen folgende Rollen und Anweisungen an: ${expertPair}`;
    }

    const tools = useGoogleSearch ? [{ googleSearch: {} }] : undefined;

    const response = await generateContentWithRetry({
      model: 'gemini-3.6-flash',
      tools,
      contents: `Du bist der Orchestrator für einen KI-Experten-Podcast.
Vorheriger Kontext:
${history}

Die Eingabe/Frage des Benutzers: "${userPrompt}"

Du hast Zugriff auf folgende Wissensdatenbank (Knowledge Base):
${knowledgeBaseStr}

Anweisungen für die Experten:
${pairInstruction}
Objektivitäts-Regel: Die individuelle Persönlichkeit der Agenten darf nicht die Verpflichtung zur objektiven Analyse außer Kraft setzen. Alle Aussagen müssen sachlich korrekt sein, bei Widersprüchen müssen diese benannt werden.

WICHTIGE SPRACHANWEISUNG: Du MUSST alle Texte, Antworten und das Gesprächsskript AUSSCHLIESSLICH auf ${language} ausgeben.

Deine Aufgabe ist:
1. Schreibe das nächste Gesprächssegment (Skript) zwischen den zwei KI-Experten, in dem sie auf die Frage des Benutzers eingehen und den vorherigen Kontext berücksichtigen.
   - Die Experten MÜSSEN ausdrücklich Quellen aus der Wissensdatenbank (oder bei aktiver Suche Google-Ergebnissen) zitieren, wenn sie Fakten verwenden.
   - PROAKTIVES VERHALTEN: Am Ende des Skripts MÜSSEN die Experten proaktiv eine klärende Frage an den Benutzer stellen.
2. Stelle eine genaue Liste der zitierten Quellen im Array 'sourceReferences' bereit. Ordne diese dem jeweiligen Dialog-Absatz (0-basierter Index) zu.
3. Schlage 3 neue Folgefragen oder Themen vor.

Gib genau dieses JSON-Format aus. Das Skript MUSS exakt zeilenweise wie folgt formatiert sein:
Alex: [Dialog]
Sarah: [Dialog]
...
`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING, description: "Das Gesprächsskript zwischen Alex und Sarah. Format: 'Alex: ... \\nSarah: ...'" },
            citations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Liste von aus der Wissensdatenbank zitierten Quellen" },
            sourceReferences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING, description: "Eindeutige ID (z.B. 'src-1')" },
                  title: { type: Type.STRING, description: "Titel der Quelle" },
                  url: { type: Type.STRING, description: "URL falls vorhanden (nicht erfinden)" },
                  claim: { type: Type.STRING, description: "Die durch die Quelle belegte Behauptung" },
                  paragraphIndex: { type: Type.INTEGER, description: "0-basierter Index des Dialogabsatzes, in dem die Quelle zitiert wird" }
                },
                required: ["id", "title", "claim", "paragraphIndex"]
              }
            },
            suggestedTopics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 vorgeschlagene Folgefragen oder Themen" }
          },
          required: ["script", "suggestedTopics", "sourceReferences"]
        }
      }
    });

    const data = parseJSON(response.text!);
    res.json({ ...data, trace: response.trace });
  } catch (error: any) {
    console.error('Discuss error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/live-chat-stream', async (req, res) => {
  try {
    const { history, userMessage, sessionContext, language = 'Deutsch', useGoogleSearch } = req.body;
    
    let systemPrompt = `Du bist der "BKG AI Assistant", ein interaktiver Live-KI-Teilnehmer, der den Benutzer WÄHREND einer laufenden Experten-Analyse unterstützt.
Dein Charakter: Objektiv, analytisch, hilfsbereit. Du hältst dich an Fakten und nutzt den Kontext der laufenden Session.

KONTEXT DER LAUFENDEN SESSION:
${sessionContext}

WICHTIGE SPRACHANWEISUNG: Du MUSST alle Texte AUSSCHLIESSLICH auf ${language} ausgeben.

DEINE AUFGABEN:
- Beantworte die Fragen des Nutzers basierend auf dem Session-Kontext (Quellen, Claims, Diskussion).
- Verweise auf Quellen in Klammern, z.B. [S-014].
- Wenn du nach deiner Meinung gefragt wirst, stütze dich auf die bereitgestellten Daten. Erfinde keine Fakten.
- Wenn Google Search aktiv ist, kannst du auch externe Recherchen anstellen, falls die internen Quellen nicht ausreichen.

VORHERIGER CHAT-VERLAUF:
${history}
`;

    let targetProviderId;
    let internalMessage = userMessage;

    if (userMessage.startsWith('[PROMPT AS:')) {
      const match = userMessage.match(/\[PROMPT AS: (.*?)\](.*)/s);
      if (match) {
         const requestedName = match[1];
         internalMessage = match[2].trim();
         const providers = aiGateway.getProviders();
         const provider = providers.find(p => p.name.toLowerCase() === requestedName.toLowerCase() || p.type.toLowerCase().includes(requestedName.toLowerCase()));
         if (provider) {
           targetProviderId = provider.id;
         }
      }
    }

    const stream = await aiGateway.stream({
      systemPrompt,
      messages: [{ role: 'user', content: internalMessage }],
      useGoogleSearch,
      targetProviderId
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Live Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { script, persona = 'Professional' } = req.body;

    const personas: Record<string, any> = {
      Professional: { Alex: 'Zephyr', Sarah: 'Kore' },
      Casual: { Alex: 'Puck', Sarah: 'Aoede' },
      Energetic: { Alex: 'Fenrir', Sarah: 'Charon' }
    };
    
    const selectedPersona = personas[persona] || personas.Professional;

    const prompt = `TTS the following conversation between Alex and Sarah:\n${script}`;
    
    const response = await generateContentWithRetry({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: 'Alex',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedPersona.Alex }
                }
              },
              {
                speaker: 'Sarah',
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: selectedPersona.Sarah }
                }
              }
            ]
          }
        }
      }
    });
    
    const base64Audio = response.audioBase64;
    if (base64Audio) {
      res.json({ audio: base64Audio });
    } else {
      res.status(500).json({ error: "Failed to generate audio" });
    }
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
