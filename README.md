# ticket-autopilot

MVP for tracker-agnostic ticket triage with Temporal and LLM.

## Flow

1. Poller starts a parent Temporal workflow by schedule.
2. Parent workflow calls tracker queue and gets pending tickets.
3. Parent workflow starts a child workflow for every ticket.
4. Child workflow analyzes ticket with LLM.
5. Child workflow applies deterministic safety policy.
6. Child workflow sets labels, adds comment, marks ticket as processed.
7. Poller repeats.

## Current MVP

Implemented:

- universal HTTP tracker adapter;
- demo HTTP tracker;
- Temporal parent workflow for polling cycle;
- Temporal child workflow per ticket;
- mock LLM;
- OpenAI-compatible LLM client;
- labels:
  - `ai:processed`
  - `ai:llm-candidate`
  - `ai:human-required`
  - `ai:rejected`
  - `ai:failed`;
- comments with analysis;
- processed attributes.

Not implemented yet:

- PR creation;
- code generation;
- GitHub/Jira/Linear native adapters;
- n8n adapter;
- persistent demo tracker storage.

## Tracker HTTP contract

### Get pending tickets

```http
GET /tickets
