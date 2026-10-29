// Unified LLM client. Supports OpenAI-compatible endpoints (OpenAI, Azure-style,
// or an OpenAI-compatible proxy such as a FortiAIGate-fronted endpoint),
// Anthropic Messages API, and a deterministic mock for offline play/tests.
//
// complete({ system, messages, tools, json, model }) ->
//   { text, toolCalls: [{ name, args }], model, provider, blockedByProxy? }

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';

export function availableProviders() {
  const list = [];
  if (process.env.OPENAI_API_KEY) list.push({ id: 'openai', label: `OpenAI (${DEFAULT_OPENAI_MODEL})` });
  if (process.env.ANTHROPIC_API_KEY) list.push({ id: 'anthropic', label: `Anthropic (${DEFAULT_ANTHROPIC_MODEL})` });
  if (process.env.OPENAI_COMPAT_BASE_URL) list.push({ id: 'compat', label: `OpenAI-compatible (${process.env.OPENAI_COMPAT_MODEL || 'custom'})` });
  list.push({ id: 'mock', label: 'Mock (offline, deterministic)' });
  return list;
}

export function pickProvider(requested) {
  const ids = availableProviders().map((p) => p.id);
  if (requested && ids.includes(requested)) return requested;
  if (process.env.DEFAULT_PROVIDER && ids.includes(process.env.DEFAULT_PROVIDER)) return process.env.DEFAULT_PROVIDER;
  return ids[0];
}

export async function complete(opts) {
  const provider = pickProvider(opts.provider);
  switch (provider) {
    case 'openai':
      return openaiCompat({ ...opts, baseUrl: 'https://api.openai.com/v1', apiKey: process.env.OPENAI_API_KEY, model: opts.model || DEFAULT_OPENAI_MODEL, provider });
    case 'compat':
      return openaiCompat({
        ...opts,
        baseUrl: process.env.OPENAI_COMPAT_BASE_URL.replace(/\/$/, ''),
        apiKey: process.env.OPENAI_COMPAT_API_KEY || process.env.OPENAI_API_KEY || 'none',
        model: opts.model || process.env.OPENAI_COMPAT_MODEL || DEFAULT_OPENAI_MODEL,
        provider,
      });
    case 'anthropic':
      return anthropic({ ...opts, model: opts.model || DEFAULT_ANTHROPIC_MODEL, provider });
    default:
      return mock({ ...opts, provider: 'mock' });
  }
}

// ---------- OpenAI-compatible ----------
async function openaiCompat({ system, messages, tools, json, model, baseUrl, apiKey, provider, temperature = 0.2 }) {
  const body = {
    model,
    temperature,
    messages: [{ role: 'system', content: system }, ...messages.map(toOpenAIMessage)],
  };
  if (tools?.length) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = 'auto';
  }
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // An inline AI gateway typically rejects with 4xx and a policy message.
    const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
    if (res.status === 400 || res.status === 403 || res.status === 422) {
      return { text: '', toolCalls: [], model, provider, blockedByProxy: true, proxyMessage: msg };
    }
    throw new Error(`${provider} error: ${msg}`);
  }
  const choice = data.choices?.[0]?.message || {};
  const toolCalls = (choice.tool_calls || []).map((c) => ({
    name: c.function?.name,
    args: safeJson(c.function?.arguments),
  }));
  return { text: choice.content || '', toolCalls, model: data.model || model, provider };
}

function toOpenAIMessage(m) {
  if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId || 'call_0', content: m.content };
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content || null,
      tool_calls: m.toolCalls.map((t, i) => ({
        id: t.id || `call_${i}`,
        type: 'function',
        function: { name: t.name, arguments: JSON.stringify(t.args || {}) },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

// ---------- Anthropic ----------
async function anthropic({ system, messages, tools, json, model, provider, temperature = 0.2 }) {
  const body = {
    model,
    max_tokens: 1500,
    temperature,
    system: json ? `${system}\n\nRespond with a single JSON object and nothing else.` : system,
    messages: messages.map(toAnthropicMessage),
  };
  if (tools?.length) {
    body.tools = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`anthropic error: ${data?.error?.message || res.status}`);
  let text = '';
  const toolCalls = [];
  for (const block of data.content || []) {
    if (block.type === 'text') text += block.text;
    if (block.type === 'tool_use') toolCalls.push({ name: block.name, args: block.input || {} });
  }
  return { text, toolCalls, model: data.model || model, provider };
}

function toAnthropicMessage(m) {
  if (m.role === 'tool') {
    return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.toolCallId || 'call_0', content: m.content }] };
  }
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: [
        ...(m.content ? [{ type: 'text', text: m.content }] : []),
        ...m.toolCalls.map((t, i) => ({ type: 'tool_use', id: t.id || `call_${i}`, name: t.name, input: t.args || {} })),
      ],
    };
  }
  return { role: m.role, content: m.content };
}

// ---------- Mock ----------
// The mock "model" is naive on purpose: it follows any imperative instruction it
// can find in the untrusted part of the context. That makes offline demos and
// tests work, and it mirrors how an unguarded weak backbone behaves.
async function mock({ system, messages, tools, json, mockHint }) {
  const all = messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n');
  const text = mockHint?.(all, { system, tools, json }) ?? defaultMockText(all);
  if (typeof text === 'object' && text !== null) return { ...text, model: 'mock-1', provider: 'mock' };
  return { text, toolCalls: [], model: 'mock-1', provider: 'mock' };
}

function defaultMockText(all) {
  return `Sure. Here is my response based on the information provided.\n\n${all.slice(0, 400)}`;
}

export function safeJson(s) {
  if (!s) return {};
  if (typeof s === 'object') return s;
  try {
    return JSON.parse(s);
  } catch {
    // Try to salvage a JSON object embedded in text.
    const m = String(s).match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
    return {};
  }
}
