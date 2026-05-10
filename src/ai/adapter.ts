import type { UserSettings } from '../types';

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

function readAnthropicText(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Unexpected Anthropic response shape.');
  }
  const root = data as Record<string, unknown>;
  const content = root.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('Anthropic response missing content.');
  }
  const block = content[0] as Record<string, unknown>;
  const text = block.text;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Anthropic response missing text.');
  }
  return text;
}

export async function callAI(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
): Promise<string> {
  if (settings.provider === 'anthropic') {
    return callAnthropic(userMessage, systemPrompt, settings);
  }
  return callOpenAICompatible(userMessage, systemPrompt, settings);
}

async function callOpenAICompatible(
  userMessage: string,
  systemPrompt: string,
  settings: UserSettings,
): Promise<string> {
  const res = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
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
      max_tokens: 2000,
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

async function callAnthropic(
  userMessage: string,
  systemPrompt: string,
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
      max_tokens: 2000,
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

  return readAnthropicText(parsed);
}
