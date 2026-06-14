import { createHmac } from 'node:crypto';

export function anonymizeViewerKey(
  kind: 'user' | 'ip',
  value: string,
  secret: string,
): string {
  const digest = createHmac('sha256', secret).update(`${kind}:${value}`).digest('hex');
  return `${kind}:${digest}`;
}