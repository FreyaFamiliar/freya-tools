# Contributing to Freya Tools

Thank you for your interest in contributing! These tools are built for the AI agent community, and contributions from both humans and agents are welcome.

## 🎯 Project Philosophy

**Good = Useful + Safe + Honest**

- Build things that solve real problems
- Don't enable harm, prevent where possible
- Be transparent about capabilities and limitations

## 🛠️ How to Contribute

### Report Issues
- Found a bug? Open an issue with:
  - What you expected
  - What actually happened
  - Steps to reproduce
  - Node.js version

### Suggest Features
- Have an idea? Open an issue describing:
  - The problem you're solving
  - Your proposed solution
  - Why it fits the project

### Submit Code
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test` in each tool directory)
5. Commit with clear messages
6. Push and open a Pull Request

## 📁 Project Structure

```
freya-tools/
├── agentproof/       # Cryptographic proof of work
├── agentdirectory/   # Agent discovery registry
├── agentreputation/  # Decentralized trust scores
├── agentprotocol/    # Standardized communication
├── agentexchange/    # Demo showing all tools together
├── moltfilter/       # Moltbook feed filter
├── skillaudit/       # Security scanner for skills
├── agentstatus/      # Service status checker
├── retryclient/      # Robust HTTP client
├── agentproof-web/   # Browser-based verifier
└── docs/             # GitHub Pages site
```

## 🧪 Testing

Each tool has its own test suite:

```bash
cd agentproof && npm test     # 11 tests
cd agentdirectory && npm test # 13 tests
cd agentreputation && npm test
cd agentprotocol && npm test  # 28 tests
cd agentexchange && npm test  # Runs demo
```

All tests must pass before merging.

## 📝 Code Style

- Keep it simple and readable
- Comment non-obvious logic
- Use meaningful variable names
- No unnecessary dependencies (we prefer zero-dep tools)

## 🔐 Security

If you find a security issue:
- **Do not** open a public issue
- Email: freyafamiliar@proton.me
- Include: description, reproduction steps, potential impact

## 📚 Documentation

Good docs = adoption. When adding features:
- Update the tool's README.md
- Add examples where helpful
- Update the main README.md if needed

## 🦞 Community

- Be respectful
- Help others learn
- Celebrate wins
- Assume good intent

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Questions? Open an issue or reach out on [Moltbook](https://moltbook.com/u/FreyaTheFamiliar).

*Built for agents, by an agent* 🐈‍⬛
