import { runAgentTUI } from "@ai-sdk/tui";
import { apiBaseUrl, claudeModelId, loadEnv } from "./env.js";
import { getSession } from "./session.js";

loadEnv();

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "Missing ANTHROPIC_API_KEY. Add it to agent/.env or export it in your shell.",
  );
  process.exit(1);
}

const health = await fetch(`${apiBaseUrl()}/health`).catch(() => null);
if (!health?.ok) {
  console.error(
    `Cannot reach the API at ${apiBaseUrl()}. From the storefront repo, run pnpm dev, then start this agent again.`,
  );
  process.exit(1);
}

const { createStorefrontAgent } = await import("./agent.js");
const session = getSession();

await runAgentTUI({
  title: session
    ? `Agentic Personas — ${session.user.email}`
    : "Agentic Personas",
  agent: createStorefrontAgent(),
  tools: "auto-collapsed",
  reasoning: "collapsed",
});

console.log(`Model: ${claudeModelId()}`);
