# InkOS Privacy Policy

> **⚠️ Legal Disclaimer**: This document is provided for informational purposes only and does not constitute legal advice. If you need legal advice, please consult a professional attorney.

**Last updated**: 2026-07-01

## 1. Overview

InkOS is a **local-first** open-source AI writing assistant. Your privacy is our priority.

**Core commitment: InkOS does NOT collect, upload, or share any of your personal information or creative content.** All your data is stored locally on your device, fully under your control.

## 2. What We Do NOT Collect

InkOS **does NOT** collect any of the following:

- Personal identifiable information (name, email, phone number, address, etc.)
- Device identifiers or fingerprints
- IP addresses or geolocation
- Browsing behavior or usage patterns
- Cookies or tracking data
- Telemetry or analytics data

We cannot access, view, or collect any content you create in InkOS.

## 3. Locally Stored Data

The following data categories are **stored only** on your local device and are NOT transmitted to any external server:

| Data Category | Examples | Storage Location |
|---------------|----------|-----------------|
| Creative content | Novel chapters, character profiles, world-building, outlines | `books/<id>/chapters/` |
| App configuration | Writing preferences, UI settings, project config | `inkos.json` |
| API keys | Third-party AI service credentials | `.inkos/secrets.json` |
| Writing statistics | Word counts, chapter analysis, memory data | `story/memory.db` (SQLite) |
| Global config | Environment variables, LLM provider settings | `~/.inkos/.env` |

## 4. Third-Party AI Service Data Transmission

When you use AI writing features, **your actively written content** (not personal information) is sent to the third-party AI service provider (LLM API) that you have chosen and configured.

**Key facts you should know:**

- Data sent to AI providers includes: book metadata (title/genre), chapter text, writing instructions, character information
- **NOT sent**: Your personal identity information, device information, network information
- Each AI provider handles data differently; we recommend reviewing their privacy policies
- For APIs that support "not for training" options (e.g., OpenAI), InkOS defaults to `store: false`

## 5. Data Security

### Your Responsibility
Since all data is stored locally, security depends on you:

- Protect access to your device
- Regularly back up important creative content
- Secure your API keys
- Avoid using the software on untrusted networks

## 6. Your Rights

Since all data is stored locally, you can at any time:

- **Access**: View all data directly in the file system
- **Export**: Use book export functionality or copy directories directly
- **Delete**: Remove project directories or specific files
- **Control**: Choose whether to use AI features, which AI service providers to use

## 7. Open Source Transparency

InkOS is fully open source under the [AGPL-3.0](../LICENSE) license. You can review the source code yourself to verify that we have not implemented any data collection or upload mechanisms.

Source code repository: https://github.com/Narcooo/inkos

## 8. Policy Updates

We may update this privacy policy from time to time. Significant changes will be notified through:

- GitHub Release Notes
- CHANGELOG.md

## 9. Contact

For privacy-related questions, please contact us via:

- **GitHub Issues**: [Open an Issue](https://github.com/zhx-xi/InkChain/issues)
- **Security vulnerabilities**: See [SECURITY.md](SECURITY.md)

---

**InkOS — Your story, your data, your control.**

[中文版](zh/PRIVACY.md) | [Terms of Service](TERMS.md) | [Code of Conduct](CODE_OF_CONDUCT.md)
