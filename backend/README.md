---
title: Market-Neutral Hedging Live Trading
emoji: 📊
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

Private-submission API for the FinReason Task 2 test. Source is public;
submissions and decisions are held in a separate **private** dataset repository.
The API deliberately exposes only published data and aggregate cumulative returns.

Secrets: HF_TOKEN (private storage access), ADMIN_KEY (organizer endpoints).
Variables: STORE_REPO, PUBLIC_ORIGIN.
The OpenAI API key is never stored here. Baseline and news generation run only
on the organizer's local device, then the results are uploaded.
No credentials or submitted actions belong in this Space's source repository.
