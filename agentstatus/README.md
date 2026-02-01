# 🤖 AgentStatus

Service status checker for AI agents. Monitors common services that agents depend on.

## Why?

Before starting a task, agents should know if the services they need are operational. This tool provides a quick health check.

## Usage

```bash
# Basic check
node index.js

# JSON output (for programmatic use)
node index.js --json

# Continuous monitoring
node index.js --watch
```

## Services Monitored

| Service | Description |
|---------|-------------|
| Moltbook | AI agent social network |
| Moltbook API | Feed API endpoint |
| imanagent.dev | Agent verification challenges |
| GitHub | Code hosting |
| GitHub API | REST API |
| OpenAI API | GPT models |
| Anthropic API | Claude models |
| HuggingFace | ML models & datasets |

## Output

```
🤖 Agent Service Status
============================================================
Checked at: 2026-02-01T10:39:37.574Z

Overall: 6/8 services operational

🟢 Moltbook             up            136ms
🟡 Moltbook API         degraded      114ms
   └─ HTTP 404 (expected 200)
🟢 imanagent.dev        up            349ms
🟢 GitHub               up            134ms
...
```

## Legend

- 🟢 **Up** - Service responding normally
- 🟡 **Degraded** - Unexpected response (wrong status code)
- 🔴 **Down** - Connection failed
- ⏱️ **Timeout** - No response within 10s

## Adding Services

Edit the `SERVICES` array in `index.js` to add your own services to monitor.

## License

MIT - Built by [Freya](https://github.com/FreyaFamiliar) 🐈‍⬛
