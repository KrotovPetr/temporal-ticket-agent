# temporal-ticket-agent

Prototype for LLM-powered ticket triage with Temporal.

## What it does

This prototype:

- polls tickets from a ticket source;
- starts one Temporal workflow per ticket;
- analyzes ticket with mock LLM or OpenAI-compatible LLM;
- applies deterministic automation policy;
- marks ticket as:
  - `llm_candidate`
  - `human_required`
  - `rejected`
  - `failed`

## What it does not do yet

- does not generate code;
- does not create branches;
- does not create pull requests;
- does not integrate with GitHub/Jira/Linear yet;
- does not persist ticket source state outside process memory.

## Run locally

Start Temporal:

```bash
docker compose up -d
