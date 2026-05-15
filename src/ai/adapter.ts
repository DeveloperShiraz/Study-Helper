import type { UserSettings } from '../types';
import { AwsClient } from 'aws4fetch';
import { jsonrepair } from 'jsonrepair';
import { bedrockRuntimeBaseUrl } from '../lib/aiTaskSettings';
import { resolveBedrockInvokeModelId } from '../lib/bedrockInferenceProfile';
import { sleepMs } from '../lib/sleep';
import { EXTRACT_CHAPTER_FROM_PDF_SYSTEM, SEGMENT_TO_CHAPTER_JSON_SYSTEM } from './prompts';

const CHAT_MAX_TOKENS = 2000;
const PDF_EXTRACT_MAX_OUTPUT_OPENAI = 8192;
const PDF_EXTRACT_MAX_TOKENS_ANTHROPIC = 8192;
const PDF_EXTRACT_MAX_OUTPUT_GEMINI = 8192;

/** Segment structuring: long Markdown from dense PDFs; Claude on Bedrock often allows up to 64k output (older models may error—reduce in Settings model if needed). */
const PDF_SEGMENT_STRUCTURE_MAX_TOKENS_ANTHROPIC = 64000;
const PDF_SEGMENT_STRUCTURE_MAX_OUTPUT_OPENAI = 16384;
const PDF_SEGMENT_STRUCTURE_MAX_OUTPUT_GEMINI = 8192;

const SEGMENT_CHAPTER_TITLE_START = '<<<SH_CHAPTER_TITLE>>>';
const SEGMENT_CHAPTER_TITLE_END = '<<<SH_CHAPTER_TITLE_END>>>';
const SEGMENT_CHAPTER_META_MARKER = '<<<SH_CHAPTER_META>>>';
const SEGMENT_CHAPTER_MD_MARKER = '<<<SH_CHAPTER_MARKDOWN>>>';
const SEGMENT_CHAPTER_END_MARKER = '<<<SH_CHAPTER_END>>>';

const SEGMENT_OUTPUT_TRUNCATED_MESSAGE =
  'The model hit its output length limit before finishing this segment (response was cut off). Use fewer PDF pages per range, or pick a Bedrock model that allows a higher max output.';

const GEMINI_RETRYABLE_HTTP_STATUSES = new Set([503, 429]);
const GEMINI_GENERATE_MAX_ATTEMPTS = 5;
const GEMINI_GENERATE_RETRY_BASE_MS = 1500;
/** 429 / quota: start backoff higher so we do not hammer the API. */
const GEMINI_429_RETRY_BASE_MS = 5000;
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

function readAnthropicStopReason(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const sr = (data as Record<string, unknown>).stop_reason;
  return typeof sr === 'string' ? sr : null;
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
    if (b.type === 'tool_use' && b.input !== undefined) {
      if (typeof b.input === 'object' && b.input !== null) {
        try {
          const serialized = JSON.stringify(b.input);
          if (serialized.trim().length > 2) {
            parts.push(serialized);
          }
        } catch {
          /* ignore */
        }
      }
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
      `Gemini rate-limited this key (429) after automatic retries. Wait several minutes, check quota/billing for your Google AI plan, try a lighter model (e.g. gemini-2.0-flash-lite), or import fewer chapters per run${detail}.`,
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
      const baseMs = res.status === 429 ? GEMINI_429_RETRY_BASE_MS : GEMINI_GENERATE_RETRY_BASE_MS;
      const delayMs = baseMs * 2 ** attempt;
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

  if (provider === 'bedrock') {
    const text = await extractPdfViaBedrock(pdfBase64, file.name, chapterTitleHint, settings);
    return { text, sourceLabel: 'Amazon Bedrock' };
  }

  throw new Error(
    'PDF import only works with OpenAI, Anthropic, Google Gemini, or Amazon Bedrock (Claude with PDF in Messages). DeepSeek (including deepseek-v4-pro), OpenRouter, NVIDIA, and custom chat endpoints cannot attach PDF bytes here. Use one of the supported providers, use segment-based book PDF import, paste text manually, or set a PDF import override in Settings.',
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

async function extractPdfViaBedrock(
  pdfBase64: string,
  fileName: string,
  chapterTitleHint: string,
  settings: UserSettings,
): Promise<string> {
  const parsed = await bedrockInvokeModelParsed(settings, {
    anthropic_version: 'bedrock-2023-05-31',
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
  });

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

const CHAPTER_JSON_PARSE_ERROR_MESSAGE =
  'The model did not return valid JSON for this page range. Try again, use fewer pages per segment, or switch model.';

/** Cap JSON blob enumeration so pathological model output cannot stall the UI thread. */
const CHAPTER_JSON_SCAN_MAX_CHARS = 400_000;
const CHAPTER_JSON_MAX_OPEN_BRACE_SCANS = 80;
const CHAPTER_JSON_MAX_BLOB_CANDIDATES = 28;

function stripMarkdownJsonFence(raw: string): string {
  const t = raw.trim().replace(/^\uFEFF/, '');
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fenced) {
    return fenced[1].trim();
  }
  return t;
}

function collectMarkdownFenceContents(raw: string): string[] {
  const out: string[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const inner = m[1].trim();
    if (inner.length > 0) {
      out.push(inner);
    }
  }
  return out;
}

function normalizeModelJsonDelimiters(s: string): string {
  return s.replace(/\u201c/g, '"').replace(/\u201d/g, '"').replace(/\uFEFF/g, '');
}

function sliceForJsonBlobScan(source: string): string {
  const t = source.trim();
  if (t.length <= CHAPTER_JSON_SCAN_MAX_CHARS) {
    return t;
  }
  return t.slice(0, CHAPTER_JSON_SCAN_MAX_CHARS);
}

function extractBalancedJsonObjectFrom(source: string, start: number): string | null {
  if (start < 0 || start >= source.length || source[start] !== '{') {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') {
      depth++;
      continue;
    }
    if (c === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return null;
}

function listBalancedJsonObjectCandidates(source: string): string[] {
  const t = sliceForJsonBlobScan(source);
  const seen = new Set<string>();
  const blobs: string[] = [];
  let openScans = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== '{') {
      continue;
    }
    const blob = extractBalancedJsonObjectFrom(t, i);
    if (!blob || blob.length < 12 || seen.has(blob)) {
      continue;
    }
    seen.add(blob);
    blobs.push(blob);
    openScans += 1;
    if (openScans >= CHAPTER_JSON_MAX_OPEN_BRACE_SCANS) {
      break;
    }
  }
  blobs.sort((a, b) => b.length - a.length);
  return blobs.slice(0, CHAPTER_JSON_MAX_BLOB_CANDIDATES);
}

function extractChapterJsonCandidateString(source: string): string | null {
  const trimmed = source.trim().replace(/^\uFEFF/, '');
  const keyIdx = trimmed.search(/"title"\s*:/);
  if (keyIdx >= 0) {
    const braceStart = trimmed.lastIndexOf('{', keyIdx);
    if (braceStart >= 0) {
      const blob = extractBalancedJsonObjectFrom(trimmed, braceStart);
      if (blob) {
        return blob;
      }
    }
  }
  const firstBrace = trimmed.indexOf('{');
  if (firstBrace < 0) {
    return null;
  }
  return extractBalancedJsonObjectFrom(trimmed, firstBrace);
}

function tryJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function tryJsonParseWithRepair(raw: string): unknown | null {
  const direct = tryJsonParse(raw);
  if (direct !== null) {
    return direct;
  }
  try {
    const repaired = jsonrepair(raw);
    return tryJsonParse(repaired);
  } catch {
    return null;
  }
}

function listChapterJsonObjectRoots(parsed: unknown): Record<string, unknown>[] {
  if (typeof parsed !== 'object' || parsed === null) {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
    ) as Record<string, unknown>[];
  }
  return [parsed as Record<string, unknown>];
}

function extractJsonBlobEndingBeforeKey(source: string, keyIndex: number): string | null {
  const braceStart = source.lastIndexOf('{', keyIndex);
  if (braceStart < 0) {
    return null;
  }
  return extractBalancedJsonObjectFrom(source, braceStart);
}

const CHAPTER_JSON_KEY_MARKER_SOURCES = ['"contentMarkdown"\\s*:', '"content_markdown"\\s*:', '"title"\\s*:'] as const;

function extractChapterJsonByKeyAnchors(source: string): string[] {
  const trimmed = source.trim().replace(/^\uFEFF/, '');
  const out: string[] = [];
  const seen = new Set<string>();
  for (const src of CHAPTER_JSON_KEY_MARKER_SOURCES) {
    const re = new RegExp(src, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(trimmed)) !== null) {
      const blob = extractJsonBlobEndingBeforeKey(trimmed, m.index);
      if (!blob || seen.has(blob)) {
        continue;
      }
      seen.add(blob);
      out.push(blob);
    }
  }
  return out;
}

function stringifyChapterJsonScalar(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function readChapterJsonFields(o: Record<string, unknown>): { title: string; contentMarkdown: string } | null {
  const titleRaw = o.title ?? o.Title ?? o.chapter_title ?? o.chapterTitle;
  const mdRaw =
    o.contentMarkdown ??
    o.content_markdown ??
    o.markdown ??
    o.body ??
    o.content ??
    o.text;
  const title = stringifyChapterJsonScalar(titleRaw);
  const contentMarkdown = typeof mdRaw === 'string' ? mdRaw.trim() : '';
  if (!title || !contentMarkdown) {
    return null;
  }
  return { title, contentMarkdown };
}

function tryParsePlainTitleDelimiterChapterFormat(raw: string): { title: string; contentMarkdown: string } | null {
  const t = raw.trim();
  const iTs = t.indexOf(SEGMENT_CHAPTER_TITLE_START);
  const iTe = t.indexOf(SEGMENT_CHAPTER_TITLE_END);
  const iMd = t.indexOf(SEGMENT_CHAPTER_MD_MARKER);
  const iEnd = t.indexOf(SEGMENT_CHAPTER_END_MARKER);
  if (iTs < 0 || iTe < 0 || iMd < 0 || iEnd < 0) {
    return null;
  }
  if (!(iTs < iTe && iTe < iMd && iMd < iEnd)) {
    return null;
  }
  const title = t.slice(iTs + SEGMENT_CHAPTER_TITLE_START.length, iTe).trim();
  const markdown = t.slice(iMd + SEGMENT_CHAPTER_MD_MARKER.length, iEnd).trim();
  if (!title || !markdown) {
    return null;
  }
  return { title, contentMarkdown: markdown };
}

function tryParseLegacyJsonMetaDelimiterChapterFormat(raw: string): { title: string; contentMarkdown: string } | null {
  const t = raw.trim();
  const iMeta = t.indexOf(SEGMENT_CHAPTER_META_MARKER);
  const iMd = t.indexOf(SEGMENT_CHAPTER_MD_MARKER);
  const iEnd = t.indexOf(SEGMENT_CHAPTER_END_MARKER);
  if (iMeta < 0 || iMd < 0 || iEnd < 0 || !(iMeta < iMd && iMd < iEnd)) {
    return null;
  }
  const metaRaw = t.slice(iMeta + SEGMENT_CHAPTER_META_MARKER.length, iMd).trim();
  const markdown = t.slice(iMd + SEGMENT_CHAPTER_MD_MARKER.length, iEnd).trim();
  if (!metaRaw || !markdown) {
    return null;
  }
  const metaForParse = stripMarkdownJsonFence(metaRaw).trim();
  const metaParsed = tryJsonParseWithRepair(metaForParse);
  if (metaParsed === null) {
    return null;
  }
  for (const root of listChapterJsonObjectRoots(metaParsed)) {
    const titleRaw = root.title ?? root.Title ?? root.chapter_title ?? root.chapterTitle;
    const title = stringifyChapterJsonScalar(titleRaw);
    if (title) {
      return { title, contentMarkdown: markdown };
    }
  }
  return null;
}

function tryParseDelimiterChapterFormat(raw: string): { title: string; contentMarkdown: string } | null {
  return tryParsePlainTitleDelimiterChapterFormat(raw) ?? tryParseLegacyJsonMetaDelimiterChapterFormat(raw);
}

function parseSegmentChapterStructure(raw: string): { title: string; contentMarkdown: string } {
  const trimmed = raw.trim().replace(/^\uFEFF/, '');
  const attempts: string[] = [];
  const pushAttempt = (value: string) => {
    const t = value.trim();
    if (t.length > 0 && !attempts.includes(t)) {
      attempts.push(t);
    }
  };
  pushAttempt(trimmed);
  for (const inner of collectMarkdownFenceContents(trimmed)) {
    pushAttempt(inner);
  }
  for (const fragment of attempts) {
    const fromDelim = tryParseDelimiterChapterFormat(fragment);
    if (fromDelim) {
      return fromDelim;
    }
  }
  return parseChapterJsonEnvelope(raw);
}

function parseChapterJsonEnvelope(raw: string): { title: string; contentMarkdown: string } {
  const trimmedRaw = raw.trim().replace(/^\uFEFF/, '');
  if (!trimmedRaw) {
    throw new Error(CHAPTER_JSON_PARSE_ERROR_MESSAGE);
  }

  const bases: string[] = [];
  const pushBase = (s: string) => {
    const t = s.trim();
    if (t.length > 0 && !bases.includes(t)) {
      bases.push(t);
    }
  };

  pushBase(trimmedRaw);
  for (const inner of collectMarkdownFenceContents(trimmedRaw)) {
    pushBase(inner);
  }
  const legacyStrip = stripMarkdownJsonFence(raw).trim();
  pushBase(legacyStrip);

  const candidates: string[] = [];
  const seenCand = new Set<string>();
  const addCandidate = (value: string | null | undefined) => {
    if (typeof value !== 'string') {
      return;
    }
    const t = value.trim();
    if (t.length === 0 || seenCand.has(t)) {
      return;
    }
    seenCand.add(t);
    candidates.push(t);
  };

  for (const b of bases) {
    addCandidate(b);
    addCandidate(normalizeModelJsonDelimiters(b));
    addCandidate(extractChapterJsonCandidateString(b));
    addCandidate(extractChapterJsonCandidateString(normalizeModelJsonDelimiters(b)));
    for (const anchored of extractChapterJsonByKeyAnchors(b)) {
      addCandidate(anchored);
      addCandidate(normalizeModelJsonDelimiters(anchored));
    }
    for (const anchored of extractChapterJsonByKeyAnchors(normalizeModelJsonDelimiters(b))) {
      addCandidate(anchored);
    }
    for (const blob of listBalancedJsonObjectCandidates(b)) {
      addCandidate(blob);
      addCandidate(normalizeModelJsonDelimiters(blob));
    }
    const nb = normalizeModelJsonDelimiters(b);
    if (nb !== b) {
      for (const blob of listBalancedJsonObjectCandidates(nb)) {
        addCandidate(blob);
      }
    }
  }

  for (const cand of candidates) {
    const parsed = tryJsonParseWithRepair(cand);
    if (parsed === null) {
      continue;
    }
    for (const root of listChapterJsonObjectRoots(parsed)) {
      const fields = readChapterJsonFields(root);
      if (fields) {
        return fields;
      }
    }
  }

  throw new Error(CHAPTER_JSON_PARSE_ERROR_MESSAGE);
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

async function callAnthropicWithMaxTokensParsed(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<{ text: string; stopReason: string | null }> {
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

  return {
    text: readAnthropicMessageText(parsed),
    stopReason: readAnthropicStopReason(parsed),
  };
}

async function callAnthropicWithMaxTokens(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const r = await callAnthropicWithMaxTokensParsed(userMessage, systemPrompt, settings, maxTokens, signal);
  return r.text;
}

const BEDROCK_HTTP_ERROR_BODY_MAX_CHARS = 800;

function throwBedrockInvokeHttpError(status: number, rawBody: string): never {
  const snippet =
    rawBody.length > BEDROCK_HTTP_ERROR_BODY_MAX_CHARS
      ? `${rawBody.slice(0, BEDROCK_HTTP_ERROR_BODY_MAX_CHARS)}…`
      : rawBody;

  let hint = '';
  const lower = rawBody.toLowerCase();
  if (lower.includes('inference profile')) {
    hint =
      ' For on-demand access, Amazon Bedrock expects an inference profile id (for example us.anthropic.claude-sonnet-4-6), not the bare foundation model id (anthropic.claude-sonnet-4-6). In Settings pick a US/EU/Global profile from the list, or paste a full profile ARN under Other.';
  }

  throw new Error(`Bedrock request failed: ${status} — ${snippet}${hint}`);
}

function bedrockRuntimeRoot(settings: UserSettings): string {
  const trimmed = settings.baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.length > 0) {
    return trimmed;
  }
  const region = settings.bedrockRegion?.trim() || 'us-east-1';
  return bedrockRuntimeBaseUrl(region);
}

function bedrockInvokeModelUrl(settings: UserSettings): string {
  const root = bedrockRuntimeRoot(settings);
  const region = settings.bedrockRegion?.trim() || 'us-east-1';
  const modelId = resolveBedrockInvokeModelId(settings.model, region);
  if (!modelId) {
    throw new Error('Model id is required for Amazon Bedrock.');
  }
  return `${root}/model/${encodeURIComponent(modelId)}/invoke`;
}

/** When set, `apiKey` is the IAM secret access key and requests use SigV4. Otherwise `apiKey` is a Bedrock API key (Bearer). */
function usesBedrockIamCredentials(settings: UserSettings): boolean {
  return Boolean(settings.bedrockAccessKeyId?.trim());
}

async function bedrockInvokeModelParsed(
  settings: UserSettings,
  bodyRecord: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const url = bedrockInvokeModelUrl(settings);
  const bodyString = JSON.stringify(bodyRecord);
  const region = settings.bedrockRegion?.trim() || 'us-east-1';

  if (usesBedrockIamCredentials(settings)) {
    const accessKeyId = settings.bedrockAccessKeyId!.trim();
    const secretAccessKey = settings.apiKey.trim();
    if (!secretAccessKey) {
      throw new Error('Add your IAM secret access key in Settings for Amazon Bedrock (with the access key ID).');
    }
    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region,
    });
    const res = await aws.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: bodyString,
      signal,
    });
    const rawBodyIam = await res.text();
    if (!res.ok) {
      throwBedrockInvokeHttpError(res.status, rawBodyIam);
    }
    try {
      return JSON.parse(rawBodyIam) as unknown;
    } catch {
      throw new Error('Bedrock response was not valid JSON.');
    }
  }

  const bearer = settings.apiKey.trim();
  if (!bearer) {
    throw new Error(
      'Add your Amazon Bedrock API key in Settings (Bedrock console → API keys), or use IAM access key ID + secret access key for SigV4.',
    );
  }

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: bodyString,
  });

  const rawBody = await res.text();
  if (!res.ok) {
    throwBedrockInvokeHttpError(res.status, rawBody);
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new Error('Bedrock response was not valid JSON.');
  }
}

async function callBedrockWithMaxTokensParsed(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<{ text: string; stopReason: string | null }> {
  const parsed = await bedrockInvokeModelParsed(
    settings,
    {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    },
    signal,
  );

  return {
    text: readAnthropicMessageText(parsed),
    stopReason: readAnthropicStopReason(parsed),
  };
}

async function callBedrockWithMaxTokens(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const r = await callBedrockWithMaxTokensParsed(userMessage, systemPrompt, settings, maxTokens, signal);
  return r.text;
}

/**
 * Plain-text PDF segment (from pdf.js per-page extraction) → chapter title + Markdown for DB import.
 * Bedrock/Anthropic use a large max output budget; delimiter format avoids fragile JSON around legal text.
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

Respond using Format A from the system message: plain title between ${SEGMENT_CHAPTER_TITLE_START} and ${SEGMENT_CHAPTER_TITLE_END}, then Markdown between ${SEGMENT_CHAPTER_MD_MARKER} and ${SEGMENT_CHAPTER_END_MARKER}. Do not put the chapter body inside JSON. If you cannot use Format A, use strictly valid Format B JSON only.`;

  let raw: string;
  let segmentStopReason: string | null = null;
  if (settings.provider === 'anthropic') {
    const r = await callAnthropicWithMaxTokensParsed(
      userPayload,
      SEGMENT_TO_CHAPTER_JSON_SYSTEM,
      settings,
      PDF_SEGMENT_STRUCTURE_MAX_TOKENS_ANTHROPIC,
      signal,
    );
    raw = r.text;
    segmentStopReason = r.stopReason;
  } else if (settings.provider === 'bedrock') {
    const r = await callBedrockWithMaxTokensParsed(
      userPayload,
      SEGMENT_TO_CHAPTER_JSON_SYSTEM,
      settings,
      PDF_SEGMENT_STRUCTURE_MAX_TOKENS_ANTHROPIC,
      signal,
    );
    raw = r.text;
    segmentStopReason = r.stopReason;
  } else if (settings.provider === 'gemini') {
    raw = await callGeminiWithMaxOutput(
      userPayload,
      SEGMENT_TO_CHAPTER_JSON_SYSTEM,
      settings,
      PDF_SEGMENT_STRUCTURE_MAX_OUTPUT_GEMINI,
      signal,
    );
  } else {
    raw = await callOpenAICompatibleWithMaxTokens(
      userPayload,
      SEGMENT_TO_CHAPTER_JSON_SYSTEM,
      settings,
      PDF_SEGMENT_STRUCTURE_MAX_OUTPUT_OPENAI,
      signal,
    );
  }

  try {
    return parseSegmentChapterStructure(raw);
  } catch (err) {
    if (segmentStopReason === 'max_tokens') {
      throw new Error(SEGMENT_OUTPUT_TRUNCATED_MESSAGE);
    }
    throw err;
  }
}

export async function callAI(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
): Promise<string> {
  if (settings.provider === 'anthropic') {
    return callAnthropicWithMaxTokens(userMessage, systemPrompt, settings, CHAT_MAX_TOKENS);
  }
  if (settings.provider === 'bedrock') {
    return callBedrockWithMaxTokens(userMessage, systemPrompt, settings, CHAT_MAX_TOKENS);
  }
  if (settings.provider === 'gemini') {
    return callGeminiWithMaxOutput(userMessage, systemPrompt, settings, CHAT_MAX_TOKENS);
  }
  return callOpenAICompatibleWithMaxTokens(userMessage, systemPrompt, settings, CHAT_MAX_TOKENS);
}
