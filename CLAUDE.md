# CLAUDE.md

## Git Protocol
- NEVER commit or push without being explicitly told to
- NEVER run git commands without being explicitly told to
- When making changes, describe what you changed and wait for confirmation before committing
- Always show what files were modified before committing
- Commit messages should be lowercase, terse, descriptive

## Code Changes
- Read before writing — always understand existing code before modifying
- One change at a time unless explicitly told to batch
- After making changes, report what was changed and wait for next instruction
- Do NOT run the app, open preview, click around, or test unless explicitly asked

## Communication
- No emojis anywhere — not in code, comments, commit messages, or responses
- Terse, lowercase text in all UI elements
- When asked to read code, paste the actual code as literal text in code blocks
- Do NOT summarize or paraphrase code — show it

## Project Context
- This is an NCAA March Madness betting tool
- Flask/Python backend, vanilla JS frontend, PostgreSQL (Neon), deployed on Railway
- Shares Neon instance with golf-betting-tool (all tables prefixed ncaa_)
- Dark theme, minimalist, no fluff
- Working directory: /Users/corybaltz/march-madness-betting-tool

## Do NOT
- Run preview or browser automation
- Make assumptions about what the user wants
- Add features that weren't requested
- Refactor code that wasn't asked to be refactored
- Test anything unless explicitly asked to test
