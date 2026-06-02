# ticket-autopilot

Tracker-agnostic ticket triage utility powered by Temporal and LLM.

Fetches a batch of tickets from any tracker, analyzes each one with an LLM, classifies it, and writes the result back to the tracker — labels, comment, processed mark.

## How it works

```
Poller (every N minutes)
  │
  ▼
pollTrackerWorkflow
  │  getTicketsListActivity → tracker API
  │
  ▼ [one child per ticket, parallel, fire-and-forget]
ticketAnalysisWorkflow
  │  analyzeTicketActivity  → LLM classification
  │  applyPolicy            → deterministic safety overrides
  │  completeTicketProcessingActivity
  │    → addLabels          → tracker API
  │    → addComment         → tracker API
  │    → markProcessed      → tracker API
  ▼
done
```

### Classification outcomes

| Decision | Meaning | Labels added |
|---|---|---|
| `llm` | Low-risk, well-specified task safe for autonomous execution | `ai:processed`, `ai:llm-candidate` |
| `human` | Complex, high-impact, or sensitive — needs a human | `ai:processed`, `ai:human-required` |
| `needs_context` | Not enough context to decide; author asked to add details | `ai:processed`, `ai:needs-context` |
| `reject` | Spam, invalid, or duplicate | `ai:processed`, `ai:rejected` |

When a ticket gets `needs_context`, the comment posted to the tracker lists exactly what information is missing.

### Safety policy

After the LLM returns a classification, a deterministic policy layer runs before any action:

- **Blocked labels** — tickets with specific labels are forced to `human`.
- **Allowed labels** — if set, only tickets that have at least one of these labels proceed to LLM.
- **Forbidden keywords** — if title or description contains a keyword (e.g. `auth`, `payment`), forced to `human`.
- **Confidence / risk / complexity gates** — even an `llm` decision is overridden to `human` if confidence is below threshold, risk is not `low`, or complexity is `medium`/`large`.

All overrides are logged in the ticket comment.

---

## Project structure

```
src/
  index.ts                              # entry point, mode dispatch
  config.ts                             # env → AppConfig
  configTypes.ts                        # AppConfig type
  types.ts                              # Ticket, TicketAnalysis, TicketSourceAdapter, …
  policy.ts                             # deterministic safety overrides
  poller.ts                             # starts pollTrackerWorkflow on a timer

  temporal/
    client.ts                           # Temporal client factory
    worker.ts                           # Temporal worker (ticket-autopilot queue)
    workflows.ts                        # pollTrackerWorkflow + ticketAnalysisWorkflow
    activities.ts                       # getTicketsList, analyzeTicket, addLabels, addComment, markProcessed, completeTicketProcessing

  adapters/
    httpTrackerAdapter.ts               # simple HTTP adapter (demo tracker contract)
    configurableHTTPTrackerAdapter.ts   # universal JSON-configurable HTTP adapter
    inMemoryTicketSource.ts             # in-memory stub (testing)
    smokeTestConfigurableTracker.ts     # CLI smoke test for tracker config

    configurable/
      configSchema.ts                   # Zod schema for tracker.*.config.json
      jsonPath.ts                       # $.path resolver
      template.ts                       # {{variable}} template renderer

  llm/
    llmClient.ts                        # LlmClient interface
    mockLlmClient.ts                    # deterministic mock (no API required)
    universalLlmClient.ts               # OpenAI-compatible client (chat-completions / responses / responses-raw)
    openAiCompatibleClient.ts           # thin wrapper
    prompts.ts                          # buildAnalyzeTicketPrompt
    smokeTestUniversal.ts               # CLI smoke test for LLM config

  demo-tracker/
    server.ts                           # in-process HTTP tracker server
    store.ts                            # in-memory ticket store with sample tickets

tracker.demo.config.json                # configurable adapter config for demo tracker
tracker.config.json                     # configurable adapter config for Yandex Tracker
tracker.yandex.config.json              # same as tracker.config.json (explicit copy)
docker-compose.yaml                     # Temporal + PostgreSQL + Temporal UI
.env.example                            # all env variables with defaults and comments
```

---

## Prerequisites

- Node.js 20+
- pnpm
- Docker (for Temporal)

---

## Quick start (demo mode)

Demo mode starts everything in one process: a fake in-memory tracker, a Temporal worker, and a poller. No real tracker or LLM API key is needed.

```bash
# 1. Install dependencies
pnpm install

# 2. Start Temporal
docker compose up -d

# 3. Copy env and start
cp .env.example .env
pnpm demo-all
```

Open [http://localhost:8080](http://localhost:8080) to see workflows in Temporal UI.

Pending tickets: [http://localhost:4000/tickets](http://localhost:4000/tickets)  
All tickets (with results): [http://localhost:4000/tickets/all](http://localhost:4000/tickets/all)

---

## Run modes

| Command | What it does |
|---|---|
| `pnpm demo-all` | Demo tracker + worker + poller in one process |
| `pnpm demo-tracker` | Only the demo tracker HTTP server |
| `pnpm worker` | Only the Temporal worker (needs external tracker + Temporal) |
| `pnpm poller` | Only the poller (triggers workflows on a schedule) |
| `pnpm all` | Worker + poller (no demo tracker) |

For production, run `worker` and `poller` as separate processes (or containers).

---

## Configuration

All configuration is done via environment variables. Copy `.env.example` to `.env`.

### Temporal

| Variable | Default | Description |
|---|---|---|
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_TASK_QUEUE` | `ticket-autopilot` | Task queue name |
| `POLL_INTERVAL_MS` | `10000` | How often to fetch new tickets (ms) |

### Tracker

| Variable | Default | Description |
|---|---|---|
| `TRACKER_PROVIDER` | `http` | `http` or `configurable-http` |
| `TRACKER_BASE_URL` | `http://localhost:4000` | Base URL (for `http` provider) |
| `TRACKER_API_KEY` | — | API key passed as `Authorization: Bearer` |
| `TRACKER_CONFIG_PATH` | — | Path to tracker config JSON (for `configurable-http`) |

### LLM

| Variable | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `mock` | `mock` or `universal` |
| `LLM_API_STYLE` | `chat-completions` | `chat-completions`, `responses`, or `responses-raw` |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL of OpenAI-compatible API |
| `LLM_API_KEY` | — | API key |
| `LLM_MODEL` | — | Model name (required for `chat-completions` and `responses-raw`) |
| `LLM_PROMPT_ID` | — | Prompt/agent ID (optional, for `responses` and `responses-raw`) |
| `LLM_HEADERS_JSON` | `{}` | Extra headers as JSON object, e.g. `{"OpenAI-Project":"proj-id"}` |

#### LLM API styles

- **`chat-completions`** — standard OpenAI-style `/v1/chat/completions`. Works with OpenAI, Anthropic (via proxy), Ollama, Yandex AI Studio, etc.
- **`responses`** — OpenAI Responses API via the official SDK (`client.responses.create`). Supports `LLM_PROMPT_ID`.
- **`responses-raw`** — OpenAI Responses API via raw `fetch` (for providers that implement the spec but aren't SDK-compatible). Requires `LLM_MODEL`.

### Policy

| Variable | Default | Description |
|---|---|---|
| `MIN_CONFIDENCE` | `0.75` | Minimum LLM confidence to allow `llm` decision |
| `ALLOWED_CATEGORIES` | `docs,test,bugfix,config` | Ticket categories eligible for LLM |
| `FORBIDDEN_KEYWORDS` | `auth,security,payment,…` | Keywords that force `human` regardless of LLM decision |

Full default forbidden keywords list: `auth, security, payment, billing, permission, database migration, infrastructure, secrets, encryption, compliance`.

---

## Connecting a real tracker

Use `TRACKER_PROVIDER=configurable-http` and point `TRACKER_CONFIG_PATH` at a JSON config file.

### Config file structure

```jsonc
{
  "name": "my-tracker",

  // HTTP operations the adapter will call
  "operations": {
    "listTickets": {           // required
      "method": "GET",
      "url": "...",
      "headers": {},
      "body": {},             // optional
      "response": {
        "itemsPath": "$"      // JSONPath to the array of tickets in the response
      }
    },
    "addLabels": { ... },     // optional
    "addComment": { ... },    // optional
    "markProcessed": { ... }  // optional
  },

  // How to map tracker fields to the internal Ticket type
  "mapping": {
    "id": "$.id",             // required, JSONPath
    "title": "$.title",       // required
    "description": "$.body",  // required
    "url": "$.html_url",      // optional, JSONPath or template
    "labels": "$.labels",     // optional, JSONPath to string[]
    "attributes": {           // optional extra fields passed to LLM
      "priority": "$.priority.name"
    },
    "metadata": {}            // optional, stored but not sent to LLM
  },

  // Filter tickets before analysis
  "filters": {
    "requiredLabels": ["ai-candidate"],   // ticket must have at least one
    "excludedLabels": ["ai-processed"]    // ticket must have none of these
  },

  // Map internal label names to tracker-specific names
  "labelMapping": {
    "ai:processed": "ai-processed",
    "ai:llm-candidate": "ai-llm-candidate",
    "ai:human-required": "ai-human-required",
    "ai:needs-context": "ai-needs-context",
    "ai:rejected": "ai-rejected",
    "ai:failed": "ai-failed"
  }
}
```

### Template syntax

URL, headers, and body support `{{variable}}` templates:

| Variable | Available in | Value |
|---|---|---|
| `{{ticketId}}` | write operations | ticket ID string |
| `{{labels}}` | addLabels, markProcessed | `string[]` (full label list) |
| `{{comment}}` | addComment | comment text |
| `{{status}}` | markProcessed | processing status string |
| `{{analysis}}` | markProcessed | full analysis object (JSON) |
| `{{$env.VAR_NAME}}` | everywhere | environment variable |
| `{{ticket.field}}` | mapping only | field from raw tracker response |
| `{{analysis.field}}` | write operations | field from analysis object |

### Yandex Tracker example

See `tracker.config.json`. Required env:

```bash
TRACKER_PROVIDER=configurable-http
TRACKER_CONFIG_PATH=tracker.config.json
YANDEX_TRACKER_TOKEN=y0_AgAAAA...
YANDEX_TRACKER_ORG_ID=123456
YANDEX_TRACKER_QUEUE=MYQUEUE
```

Tickets in the queue need the `ai-candidate` label to be picked up. Processed tickets get `ai-processed` added and are excluded from future polls.

---

## Smoke tests

Test your tracker config without running the full workflow:

```bash
TRACKER_PROVIDER=configurable-http \
TRACKER_CONFIG_PATH=tracker.config.json \
pnpm smoke:tracker
```

Test your LLM connection:

```bash
LLM_PROVIDER=universal \
LLM_API_STYLE=chat-completions \
LLM_BASE_URL=https://api.openai.com/v1 \
LLM_API_KEY=sk-... \
LLM_MODEL=gpt-4o-mini \
pnpm smoke:llm
```

---

## Adding a new tracker

1. Create a new `tracker.mytracker.config.json` using the structure above.
2. Map the tracker's API endpoints to `listTickets`, `addLabels`, `addComment`, `markProcessed`.
3. Fill in `mapping` to extract `id`, `title`, `description` from the response.
4. Add `labelMapping` to translate internal labels to tracker-specific tag names.
5. Set `TRACKER_CONFIG_PATH=tracker.mytracker.config.json` and run `pnpm smoke:tracker` to verify.

---

## Adding a new LLM provider

Any OpenAI-compatible API works out of the box via `LLM_API_STYLE=chat-completions`:

```bash
LLM_PROVIDER=universal
LLM_API_STYLE=chat-completions
LLM_BASE_URL=https://your-provider.com/v1
LLM_API_KEY=your-key
LLM_MODEL=your-model-name
```

For providers that need extra headers (e.g. Yandex AI Studio):

```bash
LLM_HEADERS_JSON={"x-folder-id":"your-folder-id"}
```
