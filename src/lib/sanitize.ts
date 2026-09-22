const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(input: string, max = 1000): string {
  return input.replace(CONTROL, "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function wrapUntrusted(label: string, value: string): string {
  const safe = sanitizeText(value, 2000).replace(/```/g, "'''");
  return `<${label}>\n${safe}\n</${label}>`;
}
