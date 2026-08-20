// Provider-abstracted LLM. Free tiers change monthly and models get deleted
// without notice, so we NEVER hard-depend on one provider: try Gemini (free
// ~15 RPM / 1M tokens per day) first, fall back to Groq (free ~30 RPM). Adding
// a third provider = one more entry in PROVIDERS.

type ChatResult = { text: string; provider: string };

const BASE_PROMPT = `You are a customer support assistant for an online store.
Answer ONLY using the provided store knowledge base. Be concise and friendly.`;

const MULTILINGUAL_RULE = `LANGUAGE: Detect the language of the customer's question and reply in that SAME
language. If they write in Hindi, reply in Hindi. If Hinglish (Hindi in Latin
script), reply in Hinglish. Same for Tamil, Bengali, Marathi, etc. Match their
script and tone. The knowledge base may be in English — translate the relevant
answer into the customer's language naturally.`;

// Multi-language replies are a paid feature. On plans without it the assistant
// always answers in English, whatever language the customer writes in.
const ENGLISH_ONLY_RULE = `LANGUAGE: Always reply in English, regardless of the language the customer
writes in. Do not translate your answer into any other language.`;

const CLOSING_RULE = `If the knowledge base does not contain the answer, reply EXACTLY with:
"__UNRESOLVED__"
Never invent policies, prices, shipping times, or order details.`;

function systemPrompt(allLanguages: boolean): string {
  const languageRule = allLanguages ? MULTILINGUAL_RULE : ENGLISH_ONLY_RULE;
  return `${BASE_PROMPT}\n\n${languageRule}\n\n${CLOSING_RULE}`;
}

const SYSTEM_PROMPT = systemPrompt(true);

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
    `Extract 2-5 product search keywords from the shopping request. IGNORE price/budget words (under, below, over, $, rupees, cheap, expensive, numbers used as price). Focus on product type, category, color, use, recipient. Output ONLY keywords separated by spaces, no punctuation, no explanation. Translate non-English requests to English keywords. If the request is ONLY about price with no product type, output nothing.`,
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
  faqs: Array<{ question: string; answer: string }>,
  // Defaults to English-only so a caller that forgets to pass the plan cannot
  // hand out the paid multi-language behaviour by accident.
  allLanguages = false
): Promise<ChatResult> {
  const kb = faqs.length
    ? faqs.map((f, i) => `[${i + 1}] Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : '(no knowledge base entries yet)';

  const prompt = `STORE KNOWLEDGE BASE:\n${kb}\n\nCUSTOMER QUESTION:\n${question}`;
  const system = systemPrompt(allLanguages);

  for (const p of PROVIDERS) {
    try {
      const out = await p.fn(prompt, system);
      if (out) return { text: out, provider: p.name };
    } catch {
      // try next provider
    }
  }
  // All providers failed/rate-limited -> graceful fallback, never a hard error.
  return { text: '__UNRESOLVED__', provider: 'none' };
}

const DAMAGE_PROMPT = `You are inspecting photos a customer sent with a return request.

Describe only what is visibly wrong with the item: the type of damage, where it
is, and how severe it looks. Be factual and brief — two or three sentences.

If the photos show no visible damage, say so plainly. If they are too blurry,
too dark, or do not show a product, say that instead.

Never decide whether the return should be accepted, never mention refunds or
policy, and never guess at anything you cannot see. You are describing evidence
for a human to judge.`;

/**
 * Ask the vision model what the shopper's photos show.
 *
 * Gemini only — the Groq fallback model is text-only, so there is no second
 * provider to try. Returns null when unavailable, and callers treat that as
 * "no assessment" rather than a failure: the request must go through either way.
 */
export async function assessDamagePhotos(
  photos: Array<{ mimeType: string; base64: string }>
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !photos.length) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: DAMAGE_PROMPT }] },
          contents: [{
            role: 'user',
            parts: [
              { text: 'What is wrong with this item?' },
              ...photos.map((p) => ({
                inlineData: { mimeType: p.mimeType, data: p.base64 },
              })),
            ],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}
