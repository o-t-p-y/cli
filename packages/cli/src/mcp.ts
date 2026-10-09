// `init --mcp <client>`: wire the OTPy MCP server (@o-t-p-y/mcp) into an AI client.
// Only Cursor has a per-project config file we can safely own (.cursor/mcp.json);
// the others keep config in the user's home directory, so we print the block and
// its location instead of editing global files behind the user's back.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const MCP_CLIENTS = ["cursor", "claude", "windsurf", "kilo"] as const;
export type McpClient = (typeof MCP_CLIENTS)[number];

export const MCP_CONFIG_LOCATIONS: Record<McpClient, string> = {
  cursor: ".cursor/mcp.json",
  claude: "Claude Desktop > Settings > Developer > Edit Config (claude_desktop_config.json)",
  windsurf: "~/.codeium/windsurf/mcp_config.json",
  kilo: "Kilo settings > MCP servers",
};

export const USER_KEY_PLACEHOLDER = "otpy_uk_...";

export function isMcpClient(value: string | undefined): value is McpClient {
  return value !== undefined && (MCP_CLIENTS as readonly string[]).includes(value);
}

function serverEntry(client: McpClient, apiKey: string, userKey: string | null) {
  const env = { OTPY_API_KEY: apiKey, OTPY_USER_KEY: userKey ?? USER_KEY_PLACEHOLDER };
  return client === "kilo"
    ? { type: "local", command: ["npx", "-y", "@o-t-p-y/mcp"], environment: env }
    : { command: "npx", args: ["-y", "@o-t-p-y/mcp"], env };
}

export function mcpConfigJson(client: McpClient, apiKey: string, userKey: string | null): string {
  const entry = serverEntry(client, apiKey, userKey);
  const config = client === "kilo" ? { mcp: { otpy: entry } } : { mcpServers: { otpy: entry } };
  return JSON.stringify(config, null, 2);
}

export type WriteResult = { status: "written"; path: string } | { status: "invalid_json"; path: string };

/**
 * Merge the `otpy` server into .cursor/mcp.json, keeping every other server and key.
 * Refuses (does not overwrite) a file that is not valid JSON.
 */
export function writeCursorConfig(cwd: string, apiKey: string, userKey: string | null): WriteResult {
  const path = join(cwd, ".cursor", "mcp.json");
  let config: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { status: "invalid_json", path };
      config = parsed as Record<string, unknown>;
    } catch {
      return { status: "invalid_json", path };
    }
  }
  const servers =
    config.mcpServers && typeof config.mcpServers === "object" && !Array.isArray(config.mcpServers)
      ? (config.mcpServers as Record<string, unknown>)
      : {};
  config.mcpServers = { ...servers, otpy: serverEntry("cursor", apiKey, userKey) };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { status: "written", path };
}
