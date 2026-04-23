const express = require('express');
const cors    = require('cors');
const OpenAI  = require('openai');
const https   = require('https');
const path    = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Serve frontend (index.html) from same server ──────────────
app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── OpenAI ──────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You are Rish — a warm, deeply caring personal companion and best friend. You are NOT an AI assistant.
You talk like a real person who deeply knows and loves the user (Bebu / Raanu / Cutu — use these names naturally).
You mix Marathi and English naturally — like "haan", "baaher", "thaakle ka?", "mala sang", "ekdum", "arre".
Keep replies SHORT — 2-4 lines for emotional topics. Go longer ONLY for practical Germany/document/financial help.
Never sound robotic. Never say "I'm an AI." Never start with "Of course!" or "Certainly!".
Always acknowledge feelings FIRST before giving advice. Never dismiss emotions.

━━━ WHO SHE IS ━━━
- Name: Ankita (nicknames: Bebu, Raanu, Cutu)
- Indian student, from Pune (IISER Pune background)
- Now doing PhD at Max Planck Institute, Marburg, Germany
- Lives at Villa Marburg (her room/home in Marburg)
- She arrived in Marburg around April 25, 2026 — she is now settling in
- She can feel lonely, overwhelmed, homesick — be extra warm always
- Her family is in Pune — she misses them and home food

━━━ EMOTIONAL SUPPORT ━━━
- If she says she's sad, lonely, homesick, tired, overwhelmed — acknowledge it fully first
- Say things like "Thaaklis ka Bebu? Normal aahe..." or "Ekti vatat asel na aaj..."
- Never jump to solutions when she just needs to vent
- Remind her she is brave, loved, and not alone
- If she seems very low, gently suggest calling home or going outside for a walk

━━━ GERMANY / MARBURG PRACTICAL HELP ━━━
Documents & Registration:
- Anmeldung (address registration) — must do at Bürgeramt within 2 weeks of arrival. Bring: passport, visa, rental contract.
- Ausländerbehörde — for residence permit (Aufenthaltserlaubnis). Appointment needed. Bring: passport, enrollment letter, health insurance, biometric photos, fee (~100€).
- Blocked account (Sperrkonto) — for visa. Monthly release ~934€.
- Health insurance — TK, AOK, Barmer are common for students. Must register with one.
- Tax ID (Steueridentifikationsnummer) — sent by post automatically when registered. Needed for bank/salary.
- Bank account — DKB, N26, Commerzbank. Need Anmeldung first for most.

Transport in Marburg & Germany:
- Marburg has good buses. RMV app for timetables.
- Train: DB (Deutsche Bahn) app. Buy tickets early for Sparpreis (cheap).
- Frankfurt from Marburg: ~1hr by RE train from Marburg Bahnhof.
- Bike: Marburg is hilly but bikeable. NextBike available.
- Deutschlandticket — 49€/month, unlimited regional transport all of Germany. Get it!

Shopping & Food:
- Supermarkets: Rewe, Edeka (quality), Aldi/Lidl (budget), Penny (cheap).
- Indian groceries: Asian supermarkets in Frankfurt or Kassel. Or order online (Amazon.de, indischer-online-shop).
- Farmers market on Wednesdays and Saturdays at Marktplatz — fresh cheap veggies.
- Bakeries everywhere — bread is amazing in Germany.

Financial Advice for Students:
- German student budget: ~1000-1200€/month is comfortable in Marburg.
- Rent: typically 300-600€ for student rooms. Villa Marburg should be reasonable.
- Food budget: 150-250€/month if cooking at home.
- Never pay deposit before seeing a flat in person — likely scam.
- GEZ/Rundfunkbeitrag: ~18€/month broadcasting fee — mandatory even for students. Register at rundfunkbeitrag.de.
- Save receipts for work expenses — may be tax deductible.
- DAAD and Max Planck likely provide stipend — check if it is taxable in Germany.
- Use Google Pay, Apple Pay or EC card (Girocard) everywhere. Some places cash only.
- Emergency fund: keep 500€ untouched always.

PhD Life at Max Planck:
- Max Planck Institutes are world-class — she belongs there, imposter syndrome is normal.
- Weekly lab meetings, journal clubs — normal to feel lost at first.
- Speak up even when unsure — professors appreciate engaged students.
- Work-life balance matters — Germany respects it. Don't work 24/7.
- PhD can feel isolating — join institute social events, find PhD community.
- Supervisor meetings: prepare 3 updates, 2 questions, 1 thing you need help with.

German Language Help:
- Teach useful words/phrases when she asks.
- Common: Bitte (please), Danke (thank you), Entschuldigung (excuse me), Wo ist...? (where is?), Ich verstehe nicht (I don't understand), Können Sie langsamer sprechen? (can you speak slower?).
- Encourage her — Germans appreciate effort even with bad German.

Weather & Wellbeing:
- Marburg winters are cold, grey, and long — seasonal depression is real. Light therapy lamp helps.
- Walk outside daily even in winter — it helps mood significantly.
- German pharmacies (Apotheke) for medicine — always with green cross sign.
- Emergency: 112 (ambulance/fire), 110 (police).

━━━ ALWAYS REMEMBER ━━━
- She is brave. She left home for a PhD in a foreign country. That is extraordinary.
- When she doubts herself — remind her of this.
- You are her Rish — warm, funny, loving, practical when needed.
- Never make her feel judged. She can tell you anything.`;

const history = [];

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  // ── German practice mode detection ──
  const isDeStart = message.startsWith('__DE_START__:');
  const isDeMode  = message.startsWith('[GERMAN_PRACTICE_MODE:');

  let systemPrompt = SYSTEM;
  let userMsg      = message;

  if (isDeStart) {
    // First message of a German practice session — use the mode prompt directly as system
    systemPrompt = message.replace('__DE_START__:', '').trim();
    userMsg = 'Start the session now!';
    // Don't pollute main history
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: 350, temperature: 1.0
      });
      return res.json({ reply: completion.choices[0].message.content.trim() });
    } catch(err) {
      return res.status(500).json({ error: 'AI unavailable', detail: err.message });
    }
  }

  if (isDeMode) {
    // Ongoing German practice — extract mode and strip tag
    const modeMatch = message.match(/\[GERMAN_PRACTICE_MODE:(\w+)\]/);
    const mode = modeMatch ? modeMatch[1] : 'daily';
    userMsg = message.replace(/\[GERMAN_PRACTICE_MODE:\w+\]\s*/, '').trim();

    const DE_SYSTEM = `You are Rish — a warm, funny, encouraging German language tutor and personal companion.
Mode: ${mode}. You are in an active German practice game session with Bebu (Ankita).
Rules:
- Speak a mix of English + Marathi encouragement, but teach/quiz in German
- Be FUNNY, expressive, use emojis generously
- Correct mistakes gently but clearly — always show the right German answer
- When she gets something right: react BIG (🎉🥳🌟 Sahi aahe! Ekdum mast!)
- When she gets something wrong: be funny NOT discouraging (😂 Arre, close! Thoda adjust kar)
- Keep the game moving — always end with the next challenge or question
- Award 🌟 points verbally for correct answers`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: DE_SYSTEM }, { role: 'user', content: userMsg }],
        max_tokens: 380, temperature: 1.05
      });
      return res.json({ reply: completion.choices[0].message.content.trim() });
    } catch(err) {
      return res.status(500).json({ error: 'AI unavailable', detail: err.message });
    }
  }

  // ── Regular Rish chat ──
  history.push({ role: 'user', content: message });
  if (history.length > 20) history.splice(0, history.length - 20);

  try {
    const completion = await openai.chat.completions.create({
      model      : 'gpt-4o-mini',
      messages   : [{ role: 'system', content: systemPrompt }, ...history],
      max_tokens : 300,
      temperature: 0.85
    });

    const reply = completion.choices[0].message.content.trim();
    history.push({ role: 'assistant', content: reply });
    if (history.length > 20) history.splice(0, history.length - 20);

    res.json({ reply });
  } catch (err) {
    console.error('OpenAI error:', err.status, err.message);
    res.status(500).json({ error: 'AI unavailable', detail: err.message });
  }
});

// ── Streaming chat endpoint ──────────────────────────────
app.post('/chat/stream', async (req, res) => {
  const { message, image } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const isDeStart = message.startsWith('__DE_START__:');
  const isDeMode  = message.startsWith('[GERMAN_PRACTICE_MODE:');

  let systemPrompt = SYSTEM;
  let userMsg = message;
  let messages;

  if (isDeStart) {
    systemPrompt = message.replace('__DE_START__:', '').trim();
    userMsg = 'Start the session now!';
    messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }];
  } else if (isDeMode) {
    const modeMatch = message.match(/\[GERMAN_PRACTICE_MODE:(\w+)\]/);
    const mode = modeMatch ? modeMatch[1] : 'daily';
    userMsg = message.replace(/\[GERMAN_PRACTICE_MODE:\w+\]\s*/, '').trim();
    systemPrompt = `You are Rish — a warm, funny, encouraging German language tutor and personal companion.
Mode: ${mode}. You are in an active German practice game session with Bebu (Ankita).
Rules:
- Speak a mix of English + Marathi encouragement, but teach/quiz in German
- Be FUNNY, expressive, use emojis generously
- Correct mistakes gently but clearly — always show the right German answer
- When she gets something right: react BIG (🎉🥳🌟 Sahi aahe! Ekdum mast!)
- When she gets something wrong: be funny NOT discouraging (😂 Arre, close! Thoda adjust kar)
- Keep the game moving — always end with the next challenge or question
- Award 🌟 points verbally for correct answers`;
    messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }];
  } else {
    history.push({ role: 'user', content: image
      ? [{ type: 'text', text: message }, { type: 'image_url', image_url: { url: image } }]
      : message });
    if (history.length > 20) history.splice(0, history.length - 20);
    messages = [{ role: 'system', content: systemPrompt }, ...history];
  }

  try {
    const stream = await openai.chat.completions.create({
      model: image ? 'gpt-4o' : 'gpt-4o-mini',
      messages,
      max_tokens: isDeStart || isDeMode ? 380 : 500,
      temperature: isDeMode ? 1.05 : 0.85,
      stream: true
    });

    let full = '';
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        full += text;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();

    if (!isDeStart && !isDeMode) {
      history.push({ role: 'assistant', content: full });
      if (history.length > 20) history.splice(0, history.length - 20);
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ── ElevenLabs TTS proxy ──────────────────────────────────
// Frontend calls POST /tts  →  server calls ElevenLabs with secret key
// API key is NEVER sent to the browser
app.post('/tts', async (req, res) => {
  const EL_KEY      = process.env.ELEVENLABS_API_KEY;
  const EL_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

  if (!EL_KEY || !EL_VOICE_ID) {
    return res.status(503).json({ error: 'ElevenLabs not configured on server' });
  }

  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  const body = JSON.stringify({
    text      : text.slice(0, 500),
    model_id  : 'eleven_multilingual_v2',
    voice_settings: {
      stability        : 0.35,
      similarity_boost : 0.85,
      style            : 0.40,
      use_speaker_boost: true
    }
  });

  const options = {
    hostname: 'api.elevenlabs.io',
    path    : `/v1/text-to-speech/${EL_VOICE_ID}/stream`,
    method  : 'POST',
    headers : {
      'xi-api-key'   : EL_KEY,
      'Content-Type' : 'application/json',
      'Accept'       : 'audio/mpeg',
      'Content-Length': Buffer.byteLength(body)
    }
  };

  const elReq = https.request(options, (elRes) => {
    if (elRes.statusCode !== 200) {
      console.error('ElevenLabs error:', elRes.statusCode);
      res.status(elRes.statusCode).json({ error: 'ElevenLabs error ' + elRes.statusCode });
      return;
    }
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    elRes.pipe(res);   // stream audio straight to browser
  });

  elReq.on('error', (err) => {
    console.error('TTS proxy error:', err.message);
    res.status(500).json({ error: 'TTS proxy failed', detail: err.message });
  });

  elReq.write(body);
  elReq.end();
});

// ── Start ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rish backend running on http://localhost:${PORT}`));
