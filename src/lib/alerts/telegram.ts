export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(12000),
  });
  const response = await res.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!res.ok || !response?.ok) {
    // Never include the token, request URL, or response body in errors/logs.
    throw new Error(`Telegram delivery failed (${res.status}): ${response?.description ?? 'unknown error'}`);
  }
}
