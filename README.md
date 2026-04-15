# OpenSploit

The autonomous penetration testing platform.

OpenSploit is an AI-powered security tool that autonomously performs penetration tests. It orchestrates 70+ security tools (nmap, sqlmap, ffuf, hydra, metasploit, impacket, and more) through a multi-agent system that follows structured methodology: reconnaissance, enumeration, exploitation, post-exploitation, and reporting.

## Quick start

```bash
# Install
bun install -g opensploit

# Copy environment defaults
cp .env.default .env

# Run
opensploit
```

## How it works

OpenSploit is built on [OpenCode](https://opencode.ai) with the [@opensploit/core](https://github.com/silicon-works/opensploit-plugin) plugin providing all penetration testing capabilities:

- **Master agent** orchestrates the engagement, delegating to specialized sub-agents
- **Sub-agents** handle specific phases (recon, enum, exploit, post, report, research, build)
- **MCP tools** run in Docker containers for isolation and reproducibility
- **Engagement state** tracks all discoveries and is shared across agents in real-time
- **Tool registry** provides RAG-based tool discovery with 70+ security tools

## Repositories

| Repository | Purpose |
|---|---|
| **[opensploit-app](https://github.com/silicon-works/opensploit-app)** | This repo — the branded desktop application |
| **[opensploit-plugin](https://github.com/silicon-works/opensploit-plugin)** | Pentest agents, tools, hooks, and methodology |
| **[mcp-tools](https://github.com/silicon-works/mcp-tools)** | 70+ MCP security tool servers (Docker) |

## Requirements

- [Bun](https://bun.sh) 1.3+
- [Docker](https://docs.docker.com/get-docker/) (for MCP security tools)
- An LLM API key (any [OpenCode-supported provider](https://opencode.ai/docs/providers))

## Configuration

OpenSploit comes preconfigured with the plugin. To customize:

```jsonc
// .opencode/opencode.jsonc
{
  "plugin": ["@opensploit/core"],
  "model": "provider/model-id",     // optional: override default model
  "default_agent": "pentest"         // default: set by plugin
}
```

## Contributing

The penetration testing intelligence lives in the [plugin repository](https://github.com/silicon-works/opensploit-plugin). That's where to contribute agents, tools, prompts, and methodology.

This repository (opensploit-app) is the thin distribution wrapper. It contains branding, documentation, and deployment configuration.

## License

MIT

Built on [OpenCode](https://opencode.ai) by [Silicon Works Ltd](https://opensploit.ai).
