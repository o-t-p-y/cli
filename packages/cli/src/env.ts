import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function getExistingEnvKey(filePath: string, keyName: string = "OTPY_API_KEY"): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, "utf8");
    const match = new RegExp(`^${keyName}=(.*)$`, "m").exec(content);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export function appendOrUpdateEnvKey(filePath: string, keyName: string, keyValue: string): void {
  let content = "";
  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf8");
  }

  const regex = new RegExp(`^${keyName}=.*$`, "m");
  if (regex.test(content)) {
    content = content.replace(regex, `${keyName}=${keyValue}`);
  } else {
    const endsWithNewline = content.length === 0 || content.endsWith("\n");
    content = `${content}${endsWithNewline ? "" : "\n"}${keyName}=${keyValue}\n`;
  }

  writeFileSync(filePath, content, "utf8");
}
