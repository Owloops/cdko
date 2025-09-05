export function matchPattern(text: string, pattern: string): boolean {
  if (pattern === "*") {
    return true;
  }

  if (!pattern.includes("*")) {
    return text === pattern;
  }

  if (pattern.startsWith("*") && pattern.endsWith("*")) {
    const middle = pattern.slice(1, -1);
    return text.includes(middle);
  }

  if (pattern.startsWith("*")) {
    const suffix = pattern.slice(1);
    return text.endsWith(suffix);
  }

  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return text.startsWith(prefix);
  }

  const parts = pattern.split("*");
  if (parts.length === 2) {
    const [prefix, suffix] = parts;
    return text.startsWith(prefix || "") && text.endsWith(suffix || "");
  }

  return text === pattern;
}
