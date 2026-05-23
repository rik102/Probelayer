export type ChatMessage = {
  role: "system" | "user";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

export async function callOpenAICompatibleChat({
  model,
  messages,
  maxTokens = 4000
}: {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
}) {
  const url = process.env.OPENAI_COMPAT_CHAT_URL;
  if (!url) return null;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.OPENAI_COMPAT_API_KEY
        ? { authorization: `Bearer ${process.env.OPENAI_COMPAT_API_KEY}` }
        : {})
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Model endpoint failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content ?? null;
}
