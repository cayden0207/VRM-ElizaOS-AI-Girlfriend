# Contributing Guidelines

This project uses English as the default language for all development activities. Please follow these rules when contributing.

## Language Policy

- Code: English for identifiers, comments, logs, and errors.
- UI text: English strings by default, placed behind i18n keys when applicable.
- Documentation: Write in English (README, guides, scripts, comments).
- Commits & PRs: Commit messages, PR titles, and descriptions in English.
- Exceptions: Content that is inherently multi‑lingual (e.g., localized character data) may contain non‑English values, but keys and structural metadata must remain in English.

## i18n Rules

- Prefer i18n keys for user‑facing text.
- Keep `en` as the primary source of truth; other locales are optional.
- Do not hardcode non‑English strings in code paths; put them into i18n files.

## Logging Rules

- Default to English for console output.
- Non‑critical logs must be guarded by the project’s debug switch (`AppConfig.features.enableDebugLogs`).
- Use `AppConfig.debug.log/warn` for debug‑level output; reserve `console.error` for actual errors.

## Pull Requests

- Keep PRs focused and small where possible.
- Include a brief changelog in the PR description (what/why).
- Update relevant docs if behavior or configuration changes.
- Verify that UI text follows i18n rules.

## Commit Messages

Follow the general conventional style:

```
feat: add wallet connect fallback mount
fix: prevent chat window vertical jitter on hover
chore: translate SECURITY_CHECKLIST and README to English
```

## Code Style

- Follow existing patterns in this repository.
- Prefer descriptive names; avoid non‑English identifiers.
- Keep comments clear and concise.

## Security & Privacy

- Never commit secrets; use environment variables.
- Avoid logging sensitive data.

Thanks for contributing!

