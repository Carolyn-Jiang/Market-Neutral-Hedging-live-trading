# Market-Neutral Hedging — Live Trading Test

Public test website for FinReason Cup Task 2:
https://carolyn-jiang.github.io/Market-Neutral-Hedging-live-trading/

The public frontend displays the 12 New York release rounds on 14–15 October
2026, Parquet downloads, the four-field submission form, and aggregate returns.
The final action cutoff is 16 October 08:00 New York time; terminal valuation
is at 09:30; final rankings and curves appear at 10:30 after settlement.

## Deployment status

GitHub Pages is the public frontend. Private submissions require the Docker
Space in `backend/`. Creating that Space is currently blocked by Hugging Face:
the account must have PRO to host a new cpu-basic Docker/Gradio Space.
The frontend keeps the form disabled until a verified API endpoint is configured.
An empty public returns feed means no verified returns have been published.

## Private data boundary

Actions and stock selections belong only in a private Hugging Face dataset.
The public leaderboard contract allows display name, cumulative return, and
baseline designation. Return history is shown only after final settlement.
The four participant fields are Team Name, Stock 1, Stock 2, and Action;
the round ID is supplied automatically. The first accepted submission claims
the team name and returns a private browser token. Later rounds require that token,
so a different browser cannot impersonate an already-claimed team. Each team has
at most one accepted submission per round; successful submissions cannot be revised
or replaced. Rejected/invalid requests do not consume the allowance. Team Name is
free text; both stock fields and Action are single-selection dropdowns, and duplicate
stocks are rejected by both the frontend and server.

## Local generation and scoring

OpenAI API keys stay on the organizer's local device. They are not uploaded to
GitHub, Hugging Face source, or Hugging Face Secrets. Local code creates the
English news summaries and seals Codex baseline decisions before the deadline.
Published artifacts contain results, not API credentials or private decisions.

The scoring convention is a common entry valuation at each action deadline,
followed by the next release's exit valuation (16 October 09:30 for the final
round). This avoids granting participants executions at a price observed before
they submitted. Each leg uses 50% of equity; gross exposure is 100%, net exposure
is zero. LS earns half the Stock 1 return minus half the Stock 2 return; SL reverses
the signs; F earns zero. Returns compound; transaction costs are zero in this test.
Absent/invalid/late actions are F, not carried-forward actions. Baseline uses the
same entry/exit prices, sizing, and costs. Missing baseline generation is pending,
not a fabricated F prediction. Missing valuation data keeps settlement pending.

## API contract

`GET /status`: server-authoritative open round and deadline.
`GET /releases`: only published price/news file URLs.
`GET /leaderboard`: names and cumulative returns; final histories after 10:30.
`POST /submissions`: four fields plus round ID, returns an acceptance receipt.
`X-Team-Token` preserves team ownership without another participant form field.
`GET /admin/state`, `POST /admin/event`: organizer-only, require ADMIN_KEY.

Configure public endpoint URLs in `config.json` only after deployment checks pass.
Do not commit `.env` files, credentials, private submissions, or baseline actions.

## Checks

`node --test tests/*.test.js`
`python3 -m unittest discover -s backend/tests`
