# IMS Agent — Google Gemini Setup

The IMS Agent (in-app assistant) runs on **Google Gemini Flash** as its runtime AI model.
GLM 5.3 Flash remains the DeepSeek Harness dev/coding model — it is unrelated to the app's runtime agent.

## How it works

1. `api/agent.js` checks for `GEMINI_API_KEY` at request time.
2. **Key present** → the agent's understanding layer uses Gemini (`generateContent`, JSON mode) and returns a plan: `{intent, reply, plan:{kind, tool, args, tab}}`.
3. **No key / Gemini error / bad output** → the agent automatically falls back to the built-in offline NLU (`LocalProvider`). The agent NEVER hard-fails because of the model.
4. The API key stays server-side only — it is never sent to the browser.

## Setup steps

### Local (run-local.bat / node)
1. Create an API key in Google AI Studio: https://aistudio.google.com/apikey
2. Add it to `.env.local` in the project folder (create the file if it doesn't exist):

```
GEMINI_API_KEY=AIza...your-key...
```

3. Optional — override the model:

```
GEMINI_MODEL=gemini-flash-latest
```

Default is `gemini-flash-latest` — Google's stable alias that always points at the current recommended Flash model. Any valid Gemini model id works (e.g. `gemini-2.5-flash`).

### Keeping the key safe
`.env.local` is gitignored, so your key is never committed to the repo. It stays on this machine only — which means the app keeps working (on the offline NLU) even without it.

## Verify

- Open the app, log in, click the IMS Agent and say **"Hello IMS"** — the greeting should come from the agent.
- The POST /api/agent response contains `"provider": "gemini"` when Gemini answered, `"local"` when the offline NLU answered (key missing or a Gemini hiccup — then it silently falls back).

## Env variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | optional | — (absent = local NLU) | Google AI Studio API key |
| `GEMINI_MODEL` | optional | `gemini-flash-latest` | Gemini model id |

## Safety rules (already enforced in code)

- Plan kinds are whitelisted: respond / navigate / tool / prepare / reprepare / execute / cancel.
- Tools are whitelisted per kind; tabs are whitelisted for navigation.
- Role locks still apply (e.g. devadmin cannot execute write operations).
- Confirmation gating: execute only after the user confirms a pending prepare.
