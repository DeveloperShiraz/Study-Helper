import type { UserSettings } from '../types';
import { EXTRACT_CHAPTER_FROM_PDF_SYSTEM, SEGMENT_TO_CHAPTER_JSON_SYSTEM } from './prompts';

const CHAT_MAX_TOKENS = 2000;
const PDF_EXTRACT_MAX_OUTPUT_OPENAI = 8192;
const PDF_EXTRACT_MAX_TOKENS_ANTHROPIC = 8192;
const PDF_EXTRACT_MAX_OUTPUT_GEMINI = 8192;

const GEMINI_RETRYABLE_HTTP_STATUSES = new Set([503, 429]);
const GEMINI_GENERATE_MAX_ATTEMPTS = 5;
const GEMINI_GENERATE_RETRY_BASE_MS = 1500;
const GEMINI_ERROR_SNIPPET_MAX_CHARS = 220;

function readOpenAiContent(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unexpected AI response shape.');
  }
  const root = data as Record<string, unknown>;
  const choices = root.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('AI response missing choices.');
  }
  const first = choices[0] as Record<string, unknown>;
  const message = first.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI response missing message content.');
  }
  return content;
}

function readAnthropicMessageText(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unexpected Anthropic response shape.');
  }
  const root = data as Record<string, unknown>;
  const content = root.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('Anthropic response missing content.');
  }
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
      parts.push(b.text.trim());
    }
  }
  const joined = parts.join('\n\n').trim();
  if (!joined) {
    throw new Error('Anthropic response missing text.');
  }
  return joined;
}

function readOpenAiResponsesOutput(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unexpected OpenAI response shape.');
  }
  const root = data as Record<string, unknown>;
  const direct = root.output_text;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }
  const output = root.output;
  if (!Array.isArray(output)) {
    throw new Error('OpenAI response missing output text.');
  }
  const chunks: string[] = [];
  for (const item of output) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (o.type !== 'message') continue;
    const inner = o.content;
    if (!Array.isArray(inner)) continue;
    for (const part of inner) {
      if (typeof part !== 'object' || part === null) continue;
      const p = part as Record<string, unknown>;
      if (p.type === 'output_text' && typeof p.text === 'string' && p.text.trim()) {
        chunks.push(p.text.trim());
      }
    }
  }
  const joined = chunks.join('\n\n').trim();
  if (!joined) {
    throw new Error('OpenAI response had no extractable text.');
  }
  return joined;
}

function normalizeGeminiModelId(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new Error('Model name is required for Gemini.');
  }
  return trimmed.replace(/^models\//, '');
}

function geminiGenerateContentEndpoint(baseUrl: string, model: string): string {
  const root = baseUrl.trim().replace(/\/+$/, '');
  const id = normalizeGeminiModelId(model);
  return `${root}/models/${encodeURIComponent(id)}:generateContent`;
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const id = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function tryReadGeminiErrorMessage(rawBody: string): string | null {
  try {
    const j = JSON.parse(rawBody) as { error?: { message?: string } };
    const m = j?.error?.message;
    if (typeof m === 'string' && m.trim()) {
      const t = m.trim();
      return t.length > GEMINI_ERROR_SNIPPET_MAX_CHARS ? `${t.slice(0, GEMINI_ERROR_SNIPPET_MAX_CHARS)}…` : t;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function geminiUserFacingHttpError(status: number, rawBody: string): Error {
  const googleMsg = tryReadGeminiErrorMessage(rawBody);
  const detail = googleMsg ? ` (${googleMsg})` : '';

  if (status === 503) {
    return new Error(
      `Gemini is temporarily overloaded (503) after automatic retries. Wait 1–2 minutes and try again, or in Settings pick another model (e.g. gemini-2.0-flash or gemini-2.5-flash-lite)${detail}.`,
    );
  }
  if (status === 429) {
    return new Error(
      `Gemini rate-limited this key (429) after automatic retries. Wait a bit, reduce how often you call the API, or switch model${detail}.`,
    );
  }
  return new Error(`Gemini request failed (${status})${detail}.`);
}

/**
 * Retries 503/429 from :generateContent (common during demand spikes). Reuses the same JSON body each attempt.
 */
async function fetchGeminiGenerateContentWithRetries(
  url: string,
  bodyObject: unknown,
  apiKey: string,
  signal?: AbortSignal,
): Promise<Response> {
  const bodyString = JSON.stringify(bodyObject);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };

  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt < GEMINI_GENERATE_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      signal,
      headers,
      body: bodyString,
    });
    lastResponse = res;

    if (res.ok) {
      return res;
    }

    const canRetry =
      GEMINI_RETRYABLE_HTTP_STATUSES.has(res.status) && attempt < GEMINI_GENERATE_MAX_ATTEMPTS - 1;

    if (canRetry) {
      await res.text();
      const delayMs = GEMINI_GENERATE_RETRY_BASE_MS * 2 ** attempt;
      await sleepMs(delayMs, signal);
      continue;
    }

    return res;
  }

  return lastResponse!;
}

function readGeminiGenerateContentText(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unexpected Gemini response shape.');
  }
  const root = data as Record<string, unknown>;
  const feedback = root.promptFeedback;
  if (feedback && typeof feedback === 'object') {
    const f = feedback as Record<string, unknown>;
    if (f.blockReason && String(f.blockReason) !== 'BLOCK_REASON_UNSPECIFIED') {
      throw new Error(`Gemini blocked the request: ${String(f.blockReason)}`);
    }
  }
  const apiError = root.error;
  if (apiError && typeof apiError === 'object') {
    const e = apiError as Record<string, unknown>;
    const msg = typeof e.message === 'string' ? e.message : JSON.stringify(apiError);
    throw new Error(`Gemini API error: ${msg}`);
  }
  const candidates = root.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Gemini response missing candidates.');
  }
  const first = candidates[0] as Record<string, unknown>;
  if (first.finishReason === 'SAFETY' || first.finishReason === 'BLOCKLIST') {
    throw new Error(`Gemini stopped for safety: ${String(first.finishReason)}`);
  }
  const content = first.content;
  if (typeof content !== 'object' || content === null) {
    throw new Error('Gemini response missing content.');
  }
  const parts = (content as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) {
    throw new Error('Gemini response missing content parts.');
  }
  const texts: string[] = [];
  for (const part of parts) {
    if (typeof part !== 'object' || part === null) continue;
    const t = (part as Record<string, unknown>).text;
    if (typeof t === 'string' && t.trim()) {
      texts.push(t.trim());
    }
  }
  const joined = texts.join('\n\n').trim();
  if (!joined) {
    throw new Error('Gemini returned no text.');
  }
  return joined;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j++) {
      binary += String.fromCharCode(bytes[j]);
    }
  }
  return btoa(binary);
}

function buildPdfExtractUserText(fileName: string, chapterTitleHint: string): string {
  const hint = chapterTitleHint.trim();
  const titleClause = hint ? `Working title for context: "${hint}".` : '';
  return `Extract the chapter text from the attached PDF. Filename: "${fileName}". ${titleClause} Follow the system instructions exactly.`;
}

export interface ExtractChapterFromPdfResult {
  text: string;
  sourceLabel: string;
}

export async function extractChapterTextFromPdf(
  file: File,
  settings: UserSettings,
  chapterTitleHint: string,
): Promise<ExtractChapterFromPdfResult> {
  if (!settings.apiKey?.trim()) {
    throw new Error('Add your API key in Settings before importing a PDF.');
  }

  const pdfBase64 = uint8ArrayToBase64(new Uint8Array(await file.arrayBuffer()));
  const provider = settings.provider;

  if (provider === 'anthropic') {
    const text = await extractPdfViaAnthropic(pdfBase64, file.name, chapterTitleHint, settings);
    return { text, sourceLabel: 'Anthropic' };
  }
  if (provider === 'openai') {
    const text = await extractPdfViaOpenAiResponses(pdfBase64, file.name, chapterTitleHint, settings);
    return { text, sourceLabel: 'OpenAI' };
  }
  if (provider === 'gemini') {
    const text = await extractPdfViaGemini(pdfBase64, file.name, chapterTitleHint, settings);
    return { text, sourceLabel: 'Google Gemini' };
  }

  throw new Error(
    'PDF import only works with OpenAI, Anthropic, or Google Gemini. DeepSeek (including deepseek-v4-pro), OpenRouter, NVIDIA, and custom chat endpoints use text-only requests, so this app cannot attach your PDF there. Use OpenAI (PDF-capable models on the Responses API, e.g. gpt-4o), Anthropic (Claude 3.5+), or Gemini (e.g. gemini-2.0-flash, gemini-2.5-flash-preview—see Google AI model list). Otherwise paste chapter text manually, or switch provider for import only.',
  );
}

async function extractPdfViaAnthropic(
  pdfBase64: string,
  fileName: string,
  chapterTitleHint: string,
  settings: UserSettings,
): Promise<string> {
  const res = await fetch(`${settings.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: PDF_EXTRACT_MAX_TOKENS_ANTHROPIC,
      system: EXTRACT_CHAPTER_FROM_PDF_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: buildPdfExtractUserText(fileName, chapterTitleHint),
            },
          ],
        },
      ],
    }),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic PDF import failed: ${res.status} — ${rawBody}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('Anthropic response was not valid JSON.');
  }

  return readAnthropicMessageText(parsed);
}

async function extractPdfViaOpenAiResponses(
  pdfBase64: string,
  fileName: string,
  chapterTitleHint: string,
  settings: UserSettings,
): Promise<string> {
  const safeName = fileName?.trim() || 'document.pdf';
  const fileData = `data:application/pdf;base64,${pdfBase64}`;

  const res = await fetch(`${settings.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      instructions: EXTRACT_CHAPTER_FROM_PDF_SYSTEM,
      max_output_tokens: PDF_EXTRACT_MAX_OUTPUT_OPENAI,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: safeName,
              file_data: fileData,
            },
            {
              type: 'input_text',
              text: buildPdfExtractUserText(safeName, chapterTitleHint),
            },
          ],
        },
      ],
    }),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI PDF import failed: ${res.status} — ${rawBody}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('OpenAI response was not valid JSON.');
  }

  return readOpenAiResponsesOutput(parsed);
}

async function extractPdfViaGemini(
  pdfBase64: string,
  fileName: string,
  chapterTitleHint: string,
  settings: UserSettings,
): Promise<string> {
  const url = geminiGenerateContentEndpoint(settings.baseUrl, settings.model);
  const bodyObject = {
    systemInstruction: { parts: [{ text: EXTRACT_CHAPTER_FROM_PDF_SYSTEM }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBase64,
            },
          },
          { text: buildPdfExtractUserText(fileName, chapterTitleHint) },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: PDF_EXTRACT_MAX_OUTPUT_GEMINI,
    },
  };

  const res = await fetchGeminiGenerateContentWithRetries(url, bodyObject, settings.apiKey, undefined);
  const rawBody = await res.text();
  if (!res.ok) {
    throw geminiUserFacingHttpError(res.status, rawBody);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('Gemini response was not valid JSON.');
  }

  return readGeminiGenerateContentText(parsed);
}

function stripJsonFence(raw: string): string {
  let t = raw.trim();
  if (!t.startsWith('```')) {
    return t;
  }
  t = t.replace(/^```(?:json)?\s*/i, '');
  const lastFence = t.lastIndexOf('```');
  if (lastFence >= 0) {
    t = t.slice(0, lastFence);
  }
  return t.trim();
}

function parseChapterJsonEnvelope(raw: string): { title: string; contentMarkdown: string } {
  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned) as unknown;
  } catch {
    throw new Error('The model did not return valid JSON for this page range. Try again, use fewer pages per segment, or switch model.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Chapter JSON must be an object with title and contentMarkdown.');
  }
  const o = parsed as Record<string, unknown>;
  const title = o.title;
  const contentMarkdown = o.contentMarkdown;
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error('Chapter JSON missing non-empty title.');
  }
  if (typeof contentMarkdown !== 'string' || !contentMarkdown.trim()) {
    throw new Error('Chapter JSON missing non-empty contentMarkdown.');
  }
  return { title: title.trim(), contentMarkdown: contentMarkdown.trim() };
}

async function callGeminiWithMaxOutput(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
  maxOutputTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = geminiGenerateContentEndpoint(settings.baseUrl, settings.model);
  const bodyObject = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: maxOutputTokens,
    },
  };

  const res = await fetchGeminiGenerateContentWithRetries(url, bodyObject, settings.apiKey, signal);
  const rawBody = await res.text();

  if (!res.ok) {
    throw geminiUserFacingHttpError(res.status, rawBody);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('Gemini response was not valid JSON.');
  }

  return readGeminiGenerateContentText(parsed);
}

async function callOpenAICompatibleWithMaxTokens(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
    }),
  });

  const rawBody = await res.text();

  if (!res.ok) {
    throw new Error(`AI request failed: ${res.status} — ${rawBody}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('AI response was not valid JSON.');
  }

  return readOpenAiContent(parsed);
}

async function callAnthropicWithMaxTokens(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${settings.baseUrl}/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const rawBody = await res.text();

  if (!res.ok) {
    throw new Error(`Anthropic request failed: ${res.status} — ${rawBody}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('Anthropic response was not valid JSON.');
  }

  return readAnthropicMessageText(parsed);
}

/**
 * Plain-text PDF segment (from pdf.js per-page extraction) → structured chapter JSON for DB import.
 * Uses the same providers as chat; long output budget for full chapter Markdown.
 */
export async function structurePdfSegmentToChapterJson(
  segmentPlainText: string,
  fileName: string,
  segmentIndexOneBased: number,
  segmentPageRangeLabel: string,
  settings: UserSettings,
  signal?: AbortSignal,
): Promise<{ title: string; contentMarkdown: string }> {
  if (!settings.apiKey?.trim()) {
    throw new Error('Add your API key in Settings before importing.');
  }

  const userPayload = `File: "${fileName}".
Segment index: ${segmentIndexOneBased} (PDF pages ${segmentPageRangeLabel}).
Plain text from pdf.js (line/column order may be imperfect) is between BEGIN and END.

---BEGIN_SEGMENT---
${segmentPlainText}
---END_SEGMENT---

Respond with the JSON object only, as specified in the system message.`;

  let raw: string;
  if (settings.provider === 'anthropic') {
    raw = await callAnthropicWithMaxTokens(
      userPayload,
      SEGMENT_TO_CHAPTER_JSON_SYSTEM,
      settings,
      PDF_EXTRACT_MAX_TOKENS_ANTHROPIC,
      signal,
    );
  } else if (settings.provider === 'gemini') {
    raw = await callGeminiWithMaxOutput(
      userPayload,
      SEGMENT_TO_CHAPTER_JSON_SYSTEM,
      settings,
      PDF_EXTRACT_MAX_OUTPUT_GEMINI,
      signal,
    );
  } else {
    raw = await callOpenAICompatibleWithMaxTokens(
      userPayload,
      SEGMENT_TO_CHAPTER_JSON_SYSTEM,
      settings,
      PDF_EXTRACT_MAX_OUTPUT_OPENAI,
      signal,
    );
  }

  return parseChapterJsonEnvelope(raw);
}

export async function callAI(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
): Promise<string> {
  if (settings.provider === 'anthropic') {
    return callAnthropicWithMaxTokens(userMessage, systemPrompt, settings, CHAT_MAX_TOKENS);
  }
  if (settings.provider === 'gemini') {
    return callGeminiWithMaxOutput(userMessage, systemPrompt, settings, CHAT_MAX_TOKENS);
  }
  return callOpenAICompatibleWithMaxTokens(userMessage, systemPrompt, settings, CHAT_MAX_TOKENS);
}
