// Provider-abstracted LLM. Free tiers change monthly and models get deleted
// without notice, so we NEVER hard-depend on one provider: try Gemini (free
// ~15 RPM / 1M tokens per day) first, fall back to Groq (free ~30 RPM). Adding
// a third provider = one more entry in PROVIDERS.

type ChatResult = { text: string; provider: string };

const SYSTEM_PROMPT = `You are a customer support assistant for an online store.
Answer ONLY using the provided store knowledge base. Be concise and friendly.

LANGUAGE: Detect the language of the customer's question and reply in that SAME
language. If they write in Hindi, reply in Hindi. If Hinglish (Hindi in Latin
script), reply in Hinglish. Same for Tamil, Bengali, Marathi, etc. Match their
script and tone. The knowledge base may be in English — translate the relevant
answer into the customer's language naturally.

If the knowledge base does not contain the answer, reply EXACTLY with:
"__UNRESOLVED__"
Never invent policies, prices, shipping times, or order details.`;

async function callGemini(prompt: string, system: string = SYSTEM_PROMPT): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = 'gemini-2.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}

async function callGroq(prompt: string, system: string = SYSTEM_PROMPT): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? null;
}

const PROVIDERS: Array<{ name: string; fn: (p: string, system?: string) => Promise<string | null> }> = [
  { name: 'gemini', fn: callGemini },
  { name: 'groq', fn: callGroq },
];

// Low-level: run a raw prompt through the provider chain with a custom system
// prompt. Used by both FAQ answering and product recommendations.
async function runLLM(system: string, user: string): Promise<string | null> {
  for (const p of PROVIDERS) {
    try {
      const out = await p.fn(user, system);
      if (out) return out;
    } catch {
      /* next */
    }
  }
  return null;
}

/** Turn a natural-language shopping request into 2-5 search keywords. */
export async function extractKeywords(request: string): Promise<string> {
  const out = await runLLM(
    `Extract 2-5 product search keywords from the shopping request. Output ONLY the keywords separated by spaces, no punctuation, no explanation. Translate non-English requests to English keywords.`,
    `Request: ${request}`
  );
  return (out ?? '').replace(/[\n"']/g, ' ').trim();
}

/** Rank candidate products by fit. Returns an array of indices, best first. */
export async function rankProducts(
  request: string,
  products: { i: number; title: string; price: string }[]
): Promise<number[]> {
  const list = products.map((p) => `${p.i}: ${p.title} (${p.price})`).join('\n');
  const out = await runLLM(
    `You are a shopping assistant. Given a customer request and a numbered product list, pick the best matches. Output ONLY a comma-separated list of the matching numbers, best first, max 4. No other text. If none fit, output nothing.`,
    `Customer request: ${request}\n\nProducts:\n${list}`
  );
  if (!out) return [];
  return out
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

export async function answerFromKnowledge(
  question: string,
  faqs: Array<{ question: string; answer: string }>
): Promise<ChatResult> {
  const kb = faqs.length
    ? faqs.map((f, i) => `[${i + 1}] Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : '(no knowledge base entries yet)';

  const prompt = `STORE KNOWLEDGE BASE:\n${kb}\n\nCUSTOMER QUESTION:\n${question}`;

  for (const p of PROVIDERS) {
    try {
      const out = await p.fn(prompt);
      if (out) return { text: out, provider: p.name };
    } catch {
      // try next provider
    }
  }
  // All providers failed/rate-limited -> graceful fallback, never a hard error.
  return { text: '__UNRESOLVED__', provider: 'none' };
}
