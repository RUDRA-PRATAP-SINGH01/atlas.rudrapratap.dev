# Rate Limiting and Distributed Rate Limiters: A Complete Guide From First Principles

> A ground-up walkthrough of rate limiting — the concepts, the algorithms, the distributed-systems problems it creates, and how to design and talk about a production-grade, distributed rate limiter. Written to take you from "what even is a rate limiter" to being able to hold your own in a staff-level system design interview on the topic.

---

## Table of Contents

- [Part 1: Foundations — What, Why, and the Vocabulary You Need](#part-1-foundations--what-why-and-the-vocabulary-you-need)
  - [1.1 What Is a Rate Limiter?](#11-what-is-a-rate-limiter)
  - [1.2 Why Systems Need Rate Limiting](#12-why-systems-need-rate-limiting)
  - [1.3 Rate Limiting in the Real World](#13-rate-limiting-in-the-real-world)
  - [1.4 Rate Limiting vs Related Concepts](#14-rate-limiting-vs-related-concepts)
  - [1.5 Core Vocabulary](#15-core-vocabulary)
- [Part 2: The Five Core Algorithms](#part-2-the-five-core-algorithms)
  - [2.1 Fixed Window Counter](#21-fixed-window-counter)
  - [2.2 Sliding Window Log](#22-sliding-window-log)
  - [2.3 Sliding Window Counter](#23-sliding-window-counter)
  - [2.4 Token Bucket](#24-token-bucket)
  - [2.5 Leaky Bucket](#25-leaky-bucket)
  - [2.6 Algorithm Comparison Table](#26-algorithm-comparison-table)
  - [2.7 Hybrid and Cost-Based Rate Limiting](#27-hybrid-and-cost-based-rate-limiting)
- [Part 3: Where to Put the Rate Limiter (Placement)](#part-3-where-to-put-the-rate-limiter-placement)
- [Part 4: The Interview Framework](#part-4-the-interview-framework)
- [Part 5: Storage — Where the Counters Live](#part-5-storage--where-the-counters-live)
- [Part 6: Race Conditions and Atomicity](#part-6-race-conditions-and-atomicity)
- [Part 7: The Response Contract](#part-7-the-response-contract)
- [Part 8: Scaling the Rate Limiter](#part-8-scaling-the-rate-limiter)
- [Part 9: High Availability](#part-9-high-availability)
- [Part 10: Latency Optimization](#part-10-latency-optimization)
- [Part 11: Hot Keys and Abuse](#part-11-hot-keys-and-abuse)
- [Part 12: Dynamic Configuration](#part-12-dynamic-configuration)
- [Part 13: Advanced Follow-ups](#part-13-advanced-follow-ups)
- [Part 14: Diagramming the System](#part-14-diagramming-the-system)
- [Part 15: Interview Calibration](#part-15-interview-calibration)
- [Part 16: Cheat Sheet, Checklist, and Glossary](#part-16-cheat-sheet-checklist-and-glossary)
- [References](#references)

---

## Part 1: Foundations — What, Why, and the Vocabulary You Need

### 1.1 What Is a Rate Limiter?

A **rate limiter** is a component that controls how many requests a client is allowed to make to a service within a given window of time. If a client stays under the limit, its requests pass through. If it exceeds the limit, the extra requests are rejected (or delayed) until the window resets.

The mental model that survives every interview is the **nightclub bouncer**. The club has a legal capacity. The bouncer at the door does exactly one job: for each person who walks up, decide *let them in* or *turn them away*. The bouncer does not cook the food, mix the drinks, or run the sound system — the club (your application) does that. The bouncer just protects the club from being dangerously overcrowded.

A rate limiter is that bouncer, expressed as code:

```
             ┌──────────────────┐
 request ──▶ │   RATE LIMITER   │ ──▶ allowed?  ──▶ backend / app logic
             │  (the bouncer)   │
             └──────────────────┘
                     │
                     └── no ──▶ reject with HTTP 429 Too Many Requests
```

Formally, a rate limiter answers a single yes/no question for every incoming request:

> **"Has this client already used up its allowance for the current time window?"**

- **No** → allow the request, and record that one more unit of the allowance has been consumed.
- **Yes** → deny the request, typically with an HTTP `429 Too Many Requests` status.

That is the *entire* conceptual surface area. Everything else in this guide — the five algorithms, Redis, Lua scripts, consistent hashing, fail-open vs fail-closed — exists only to answer that one question **correctly, quickly, and at massive scale, across many servers at once**. Keep that framing in your head; it is the thread that ties the whole topic together.

A rate *limiter* is distinct from a rate *limit*. The **limit** is the policy — "100 requests per minute per user." The **limiter** is the machinery that enforces the policy. Interviewers care mostly about the machinery, because the policy is a one-line business decision while the machinery is a genuine distributed-systems problem.

### 1.2 Why Systems Need Rate Limiting

Rate limiting is not a "nice to have." Almost every serious public API and internet-facing service has it, for at least one of the following five reasons.

**Reason 1 — Prevent resource exhaustion and protect availability.**
Every backend has finite capacity: CPU, memory, database connections, worker threads, downstream quotas. A single misbehaving client — a buggy retry loop, a runaway script, a scraper — can send tens of thousands of requests per second and consume all of that capacity, starving every *legitimate* user. Rate limiting draws a hard ceiling so that one client cannot degrade the service for everyone else. This is the difference between "one customer is having a bad day" and "the whole platform is down."

**Reason 2 — Defend against abuse and attacks.**
Many attacks are, at their core, *volume* attacks:
- **Brute-force login**: trying thousands of passwords against an account. A limit of "5 failed logins per account per 15 minutes" makes brute force impractical.
- **Credential stuffing**: replaying leaked username/password pairs across many accounts.
- **Scraping**: harvesting your entire catalog or user directory.
- **DoS / DDoS**: deliberately flooding you to knock you offline.

Rate limiting is one of the cheapest, most effective first lines of defense against all of these.

**Reason 3 — Control cost.**
Modern systems pay per unit of work: cloud compute, per-request database billing, and especially **third-party APIs** you call downstream (payment providers, SMS gateways, LLM APIs, mapping services). If those downstream calls are metered and expensive, an unbounded client can run up an enormous bill. Rate limiting keeps spend predictable and prevents a single actor from turning your API into their free, unlimited proxy.

**Reason 4 — Enforce fairness across tenants.**
In a multi-tenant system, resources are shared. Without limits, the loudest tenant wins and quiet tenants suffer. Per-client rate limits guarantee that *everyone* gets a fair slice of capacity. "Fair" can be uniform (everyone gets the same) or tiered (see reason 5).

**Reason 5 — Enable business tiers and monetization.**
Rate limits are a product feature. The classic SaaS shape:

| Tier | Limit |
| --- | --- |
| Free | 100 requests / hour |
| Pro | 10,000 requests / hour |
| Enterprise | Custom / negotiated |

Here the rate limiter is literally how you sell your API. The limit *is* the product boundary between plans, and upgrading is how customers buy more of it.

> **Interview tip:** When asked "why rate limit?", do not give one reason — name the categories: **availability, security, cost, fairness, monetization.** Signaling that you see all five dimensions instantly reads as senior.

### 1.3 Rate Limiting in the Real World

You interact with rate limiters constantly, usually without noticing until you hit one.

- **GitHub API**: 5,000 requests/hour for authenticated requests, 60/hour for unauthenticated. It returns `X-RateLimit-Remaining` headers so clients can self-throttle.
- **Twitter/X API**: per-endpoint windows (e.g. N requests per 15-minute window), differentiated by endpoint and access tier.
- **Stripe**: limits API calls per second and famously uses a token-bucket-style limiter with local approximation for low latency.
- **Cloudflare / AWS WAF / API Gateway**: offer rate limiting as an edge feature you configure with a few clicks.
- **Login endpoints everywhere**: "Too many attempts, try again later" is a rate limiter on the authentication path.
- **LLM APIs (OpenAI, Anthropic, etc.)**: limit both requests-per-minute (RPM) *and* tokens-per-minute (TPM) — a real-world example of **cost-based** limiting where not all requests are equal.

The takeaway: rate limiting is ubiquitous, and the patterns you learn here map directly onto systems you already use every day.

### 1.4 Rate Limiting vs Related Concepts

These terms get conflated in conversation. Being precise about them is a senior signal.

| Concept | What it does | Direction / scope |
| --- | --- | --- |
| **Rate limiting** | Caps the *number* of requests per client per time window; rejects excess | Per-client, request count over time |
| **Throttling** | Deliberately *slows down* (delays/queues) rather than rejecting | Often smoothing, may queue instead of drop |
| **Load shedding** | Drops requests to protect the *system* when it is overloaded, regardless of who sent them | System-wide, health-driven |
| **Backpressure** | A downstream component signals upstream to slow down | Flow control between components |
| **Circuit breaker** | Stops calling a *failing dependency* to let it recover | Protects against cascading failure downstream |

Key distinctions to say out loud:

- **Rate limiting is proactive and per-client**; it enforces a policy ("you get 100/min") regardless of current system health.
- **Load shedding is reactive and system-wide**; it kicks in *because the system is struggling right now* and may drop even well-behaved traffic to survive.
- **Throttling** is a softer cousin of rate limiting: instead of a hard `429`, it delays you. Rate limiting *rejects*; throttling *slows*.
- A **circuit breaker** protects *you* from a broken *dependency*; a rate limiter protects *your dependency* (or you) from a *client*. They point in opposite directions.

> **Interview tip:** If asked "isn't this just load shedding?", answer: "No — rate limiting enforces a per-client contract even when the system is perfectly healthy; load shedding is an emergency valve driven by system health." That one sentence shows you understand the *why*, not just the *how*.

### 1.5 Core Vocabulary

You will use these terms constantly. Internalize them now.

| Term | Definition |
| --- | --- |
| **Client / identity** | The entity being limited — a user ID, IP address, API key, or tenant. |
| **Rule / policy** | The limit definition, e.g. "100 requests per 60 seconds per user." |
| **Limit / quota** | The maximum allowed count (e.g. `100`). |
| **Window** | The time span the limit applies to (e.g. `60s`). |
| **Counter** | The running count of requests a client has made in the current window. |
| **Bucket** | In token/leaky-bucket algorithms, the container holding tokens or queued requests. |
| **Token** | A unit of allowance; consuming a token permits one request. |
| **Refill rate** | How fast tokens are added back to a token bucket (e.g. 10 tokens/sec). |
| **Burst** | A short spike of traffic above the steady rate; some algorithms tolerate it, others don't. |
| **Throttle** | To slow/delay rather than reject. |
| **429** | HTTP status code "Too Many Requests" — the standard "you're rate limited" response. |
| **Retry-After** | HTTP header telling the client how long to wait before retrying. |
| **Fail-open** | On limiter failure, *allow* requests (favor availability). |
| **Fail-closed** | On limiter failure, *reject* requests (favor protection). |
| **Hot key** | A single limiter key receiving a disproportionate share of traffic. |
| **TTL** | Time-to-live; how long a stored key survives before automatic expiry. |

With the vocabulary in place, we can now look at the heart of the topic: the algorithms that actually decide *allow or deny*.

---

## Part 2: The Five Core Algorithms

Every rate limiter, no matter how fancy, is built on one of a handful of counting strategies. There are **five canonical algorithms** you must be able to explain, compare, and implement. We'll build each from intuition → mechanics → diagram → worked numeric example → pros/cons → Redis data model → when to use.

Throughout, assume our example policy is **"5 requests per 60-second window per user"** unless stated otherwise, so the numbers are easy to follow.

### 2.1 Fixed Window Counter

**Intuition / analogy.** Imagine a parking meter that resets on the hour. You can park up to 5 times between 9:00 and 10:00. At 10:00:00 the counter is wiped and you get a fresh 5 for the 10:00–11:00 window. Simple, cheap, and — as we'll see — a little unfair at the boundaries.

**How it works, step by step.**
1. Divide time into fixed, non-overlapping windows (e.g. `[00:00, 01:00)`, `[01:00, 02:00)`, …).
2. Keep one integer counter per client per window.
3. On each request, increment the counter for the *current* window.
4. If the counter is `≤ limit`, allow. If it's `> limit`, reject.
5. When a new window starts, the counter resets to 0 (in practice, you use a new key or let the old one expire).

**Timeline example (limit = 5 per 60s).**

```
Window A: [12:00:00 ─────────────── 12:00:59]   Window B: [12:01:00 ── ...
 req at :05  count=1  allow
 req at :10  count=2  allow
 req at :20  count=3  allow
 req at :35  count=4  allow
 req at :50  count=5  allow
 req at :55  count=6  DENY (429)
                                            ┊ reset ┊
                                             count=0
 req at 12:01:02  count=1  allow
```

**Worked numerical example — the boundary problem.**
Fixed windows have a notorious flaw: a client can send **2× the limit** across a window boundary. Suppose limit = 5/min.

```
Window A [12:00:00–12:00:59]:  5 requests all sent at 12:00:59  → all allowed (count 1..5)
Window B [12:01:00–12:01:59]:  5 requests all sent at 12:01:00  → all allowed (count 1..5)
```

In the 2-second span from `12:00:59` to `12:01:01`, the client got **10 requests** through — double the intended rate — because the counter reset at the boundary. This "double burst at the edge" is the single most important thing to mention about fixed windows.

**Pros.**
- Trivial to implement and reason about.
- Extremely memory-efficient: one integer per client per window.
- Very fast; a single increment.

**Cons.**
- **Boundary bursts** allow up to 2× the limit around window edges.
- Bursty: all traffic can cluster at the start of a window, causing spiky load.

**Redis data model.**
```
Key:   ratelimit:{user_id}:{window_start_epoch_minute}
Op:    INCR key           # atomic, returns new count
       EXPIRE key 60      # so old windows clean themselves up
Check: if returned_count > limit → deny
```
Two commands (`INCR` then `EXPIRE`), and `INCR` on a missing key conveniently starts at 1. In production you'd wrap both in a small Lua script or pipeline so the `EXPIRE` isn't lost.

**When to use.** Great when approximate limits are fine and simplicity/throughput matter most — internal services, coarse quotas, or as a first cut. Avoid when boundary bursts are unacceptable (e.g. strict fairness or abuse prevention).

**Reference implementation (single-node pseudocode).**
```python
def fixed_window_allow(client_id, limit=5, window=60, now=time.time()):
    window_start = int(now // window) * window        # bucket this request into a window
    key = f"ratelimit:{client_id}:{window_start}"
    count = redis.incr(key)                            # atomic increment; starts at 1
    if count == 1:
        redis.expire(key, window)                      # first hit sets the TTL
    return count <= limit                              # allow while at/under the limit
```

**A second worked example — steady traffic vs edge burst.**
Consider limit = 100/min. If a client sends a perfectly steady 100 requests spread evenly across each minute, fixed window behaves ideally: every minute it allows exactly 100 and rejects the 101st. The problem *only* appears when traffic clusters at a boundary:

```
Steady case (fine):    minute 1: 100 ok    minute 2: 100 ok    → 100/min honored
Edge-burst case (bad): 100 at 00:59.9  +  100 at 01:00.1       → 200 in 0.2s
```

The lesson: fixed window's worst case is exactly `2 * limit` within any window-length span straddling a boundary. If your `limit` is generous and traffic is naturally spread, that flaw may never bite you — which is why fixed window survives in plenty of real systems despite its theoretical weakness.

### 2.2 Sliding Window Log

**Intuition / analogy.** Instead of a meter that resets on the hour, imagine you write down the **exact timestamp** of every entry on a guest list. To decide if someone can enter *now*, you look back exactly 60 seconds and count how many timestamps fall in that trailing window. There are no artificial boundaries — the window slides continuously with the current moment.

**How it works, step by step.**
1. For each client, store a **log of timestamps** of every allowed request.
2. On a new request at time `now`:
   - Remove all timestamps older than `now - window` (they've slid out of range).
   - Count the remaining timestamps.
   - If `count < limit`, record `now` in the log and allow.
   - Otherwise, reject.

**Timeline example (limit = 3 per 10s, for clarity).**

```
now = 12:00:12, window = last 10s → [12:00:02, 12:00:12]
log before: [12:00:01, 12:00:04, 12:00:07, 12:00:11]
drop < 12:00:02 → drop 12:00:01
log now:    [12:00:04, 12:00:07, 12:00:11]   count = 3 = limit → DENY
```

The 12:00:01 entry "slid out" of the window, but three still remain, so the new request is denied. This is *exactly* accurate — no boundary loophole.

**Worked numerical example.** Limit = 5/60s. Client's log has timestamps at seconds `10, 20, 30, 40, 50`. A request arrives at `65`. Trailing window is `[5, 65]`. All five (10–50) are inside it → count = 5 = limit → **deny**. At `71`, the window is `[11, 71]`; timestamp `10` has expired, so count = 4 → **allow**, and `71` is appended.

**Pros.**
- **Perfectly accurate** — no boundary bursts. The limit is enforced over any rolling 60-second window.

**Cons.**
- **Memory-heavy**: stores one entry *per request*. A client doing 10k requests/min needs 10k timestamps stored. At scale this is expensive.
- More work per request (trim + count).

**Redis data model.**
```
Key:   ratelimit:{user_id}          # a Sorted Set (ZSET)
       score = timestamp, member = unique request id
Ops (ideally in one Lua script):
  ZREMRANGEBYSCORE key 0 (now - window)   # trim expired
  ZCARD key                               # count remaining
  if count < limit:
      ZADD key now  <unique_member>
      allow
  else deny
  EXPIRE key window                       # cleanup
```
The ZSET's score is the timestamp, which makes range-trimming a single command.

**When to use.** When you need *exact* enforcement and per-client request volume is modest. Common for security-sensitive limits (e.g. login attempts) where the boundary loophole is unacceptable. Avoid for very high-volume clients due to memory.

**Reference implementation (single-node pseudocode).**
```python
def sliding_log_allow(client_id, limit=5, window=60, now=time.time()):
    key = f"ratelimit:{client_id}"
    cutoff = now - window
    redis.zremrangebyscore(key, 0, cutoff)             # drop timestamps that slid out
    count = redis.zcard(key)                           # how many remain in the window
    if count < limit:
        redis.zadd(key, {f"{now}:{uuid4()}": now})     # record this request
        redis.expire(key, window)
        return True
    return False
```

**Memory cost, made concrete.** Suppose each stored member+score costs ~64 bytes of Redis overhead. A client allowed 10,000 requests/minute keeps ~10,000 entries alive at once → ~640 KB *for a single client*. Multiply by a million active clients and you're at hundreds of gigabytes — clearly untenable at high volume. This is precisely why the sliding window *counter* (next) exists: it keeps the sliding behavior but throws away the per-request storage.

**Why it's exact.** Because you literally count real request timestamps in the trailing window, there is no approximation and no boundary artifact whatsoever. If the interviewer says "the limit must be provably exact," this is your algorithm — you just have to defend the memory cost or bound the per-client volume.

### 2.3 Sliding Window Counter

**Intuition / analogy.** This is the clever compromise: get *most* of the accuracy of the sliding log with *almost* the cheapness of the fixed window. Instead of storing every timestamp, keep just **two counters** — one for the current fixed window and one for the previous — and **blend** them by how far you are into the current window.

**How it works, step by step.**
1. Keep a counter for the **current** fixed window and the **previous** fixed window.
2. Compute how far into the current window you are as a fraction (e.g. 30s into a 60s window → 0.5).
3. Estimate the count in the trailing window with a weighted formula:

```
estimated = current_count + previous_count * (1 - elapsed_fraction)
```

4. If `estimated < limit`, allow and increment the current counter; else reject.

**Worked numerical example.** Limit = 100/min. Previous window had `84` requests; current window (we're 30% into it, so `elapsed_fraction = 0.3`) has `36` so far.

```
estimated = 36 + 84 * (1 - 0.3)
          = 36 + 84 * 0.7
          = 36 + 58.8
          = 94.8   →  < 100  →  ALLOW  (current becomes 37)
```

The idea: as you move through the current window, the previous window's contribution smoothly fades from full weight to zero, approximating a true sliding window without storing individual timestamps.

**Pros.**
- **Smooths out boundary bursts** far better than fixed window.
- **Memory-efficient**: just two counters per client (not one per request).
- Fast and cheap — this is why it's a favorite in production (Cloudflare popularized it).

**Cons.**
- It's an **approximation**. It assumes requests in the previous window were uniformly distributed, which isn't always true, so it can be slightly off (usually within a small margin — Cloudflare reported ~0.003% error in practice).

**Redis data model.**
```
Keys:  ratelimit:{user}:{current_window}   (INCR)
       ratelimit:{user}:{previous_window}  (GET)
Op:    read both counters, apply weighted formula, then INCR current
       EXPIRE each key ~2 windows
```
Again, wrap the read-compute-increment in a Lua script for atomicity.

**When to use.** The **default production choice** for API rate limiting: near-accurate, cheap, fast. When someone asks "what would you actually ship?", this is a strong answer.

**Reference implementation (single-node pseudocode).**
```python
def sliding_counter_allow(client_id, limit=100, window=60, now=time.time()):
    cur_win  = int(now // window) * window
    prev_win = cur_win - window
    cur_key  = f"ratelimit:{client_id}:{cur_win}"
    prev_key = f"ratelimit:{client_id}:{prev_win}"

    prev_count = int(redis.get(prev_key) or 0)
    cur_count  = int(redis.get(cur_key) or 0)
    elapsed_fraction = (now - cur_win) / window        # how far into current window
    estimated = cur_count + prev_count * (1 - elapsed_fraction)

    if estimated < limit:
        pipe = redis.pipeline()
        pipe.incr(cur_key)
        pipe.expire(cur_key, 2 * window)               # keep long enough to be "previous"
        pipe.execute()
        return True
    return False
```

**A second worked example — early vs late in the window.** Limit = 10/min, previous window had 10 requests (a full window). Watch how the same "previous" count contributes less as time passes:

```
just after boundary (elapsed_fraction = 0.0):
   estimated = 0 + 10 * (1 - 0.0) = 10  → at limit → first new request DENIED
halfway (elapsed_fraction = 0.5):
   estimated = cur + 10 * 0.5 = cur + 5 → you have ~5 units of headroom
near end (elapsed_fraction = 0.9):
   estimated = cur + 10 * 0.1 = cur + 1 → previous window barely matters
```

This is the smoothing in action: a heavy previous window "leaks" its influence away linearly, preventing the fixed-window edge burst while never storing individual timestamps.

**Why the tiny error is acceptable.** The formula assumes the previous window's requests were spread uniformly. If they were actually all bunched at the very end of the previous window, the estimate can slightly under- or over-count. In practice this error is minuscule (Cloudflare measured roughly 0.003% of requests wrongly handled over a large sample), and — crucially — it aligns with our NFR that **eventual consistency / minor inaccuracy is acceptable**. You trade a rounding-error level of precision for O(1) memory.

### 2.4 Token Bucket

**Intuition / analogy.** Picture a bucket that holds up to `B` tokens. Tokens **drip in at a steady rate** (say 10/sec). Every request must **take one token** to proceed. If the bucket is empty, the request is rejected. Because the bucket can be *full* of saved-up tokens, it naturally allows **bursts** up to its capacity, while the drip rate enforces the long-run average.

This is the algorithm to reach for when you want to say "**average 10/sec but allow short bursts up to 50**."

**How it works, step by step.**
1. Each client has a bucket with capacity `B` (max tokens) and a refill rate `r` (tokens/sec).
2. Track two things per client: `tokens` (current count) and `last_refill` (timestamp).
3. On each request at time `now`:
   - Refill: `tokens = min(B, tokens + (now - last_refill) * r)`; set `last_refill = now`.
   - If `tokens >= 1`: consume one (`tokens -= 1`) and allow.
   - Else: reject.

Note the refill is **lazy** — you don't run a background timer; you compute how many tokens *should* have accrued since `last_refill` the moment a request arrives. This is elegant and cheap.

**Worked numerical example.** Capacity `B = 10`, refill `r = 1 token/sec`. Bucket starts full (10 tokens).

```
t=0s   burst of 10 requests → consume all 10 tokens → all allowed, tokens=0
t=0.5s 1 request → refill = 0.5*1 = 0.5 token → tokens=0.5 → <1 → DENY
t=3s   1 request → refill since t=0: 3*1=3 tokens (capped at 10) → tokens=3 → allow → tokens=2
t=3s   another    → tokens=2 → allow → tokens=1
t=3s   another    → tokens=1 → allow → tokens=0
t=3s   another    → tokens=0 → DENY
```

The burst of 10 at `t=0` is allowed (that's the point), then the client is throttled down to the 1/sec drip.

**Pros.**
- **Allows bursts** up to bucket capacity while enforcing an average rate — matches real traffic well.
- **Memory-efficient**: two values per client (`tokens`, `last_refill`).
- Smooth and flexible; tune burst vs steady-rate independently.

**Cons.**
- Slightly more logic (floating point refill math).
- Choosing `B` and `r` requires thought; a too-large bucket permits large bursts.

**Redis data model.**
```
Key:   ratelimit:{user}   → a HASH { tokens, last_refill }
Op (Lua script, atomic):
   read tokens, last_refill
   refill = min(capacity, tokens + (now - last_refill) * rate)
   if refill >= 1: tokens = refill - 1; allow
   else: tokens = refill; deny
   write back tokens, last_refill; EXPIRE
```
A hash with two fields, updated atomically in one Lua script. This is one of the most common production designs.

**When to use.** The go-to when you want to permit bursts but cap the average — API gateways, most public APIs. Stripe uses a token-bucket-style approach. If an interviewer gives no other constraint, token bucket is a defensible default.

**Reference implementation (single-node pseudocode).**
```python
def token_bucket_allow(client_id, capacity=10, rate=1.0, cost=1, now=time.time()):
    key = f"ratelimit:{client_id}"
    state = redis.hgetall(key)                         # {tokens, last_refill}
    tokens      = float(state.get("tokens", capacity)) # new client starts full
    last_refill = float(state.get("last_refill", now))

    tokens = min(capacity, tokens + (now - last_refill) * rate)  # lazy refill
    allowed = tokens >= cost
    if allowed:
        tokens -= cost
    redis.hset(key, mapping={"tokens": tokens, "last_refill": now})
    redis.expire(key, int(capacity / rate) * 2)
    return allowed
```

**A second worked example — sustained rate after a burst.** Capacity = 5, refill = 2 tokens/sec, bucket starts full.

```
t=0.0  5 requests instantly → consume 5 → tokens 0 → all allowed (burst honored)
t=0.5  refill 0.5*2 = 1 token → tokens 1 → 1 request allowed → tokens 0
t=0.5  next request → tokens 0 → DENIED
t=1.0  refill (1.0-0.5)*2 = 1 → tokens 1 → 1 allowed → tokens 0
...steady state: ~2 requests/sec get through — exactly the refill rate.
```

Notice how the *burst* (5 at once) is permitted because the bucket was full, but the *long-run* throughput converges on the refill rate of 2/sec. That decoupling of "burst size" (capacity) from "sustained rate" (refill) is the defining superpower of token bucket, and why it maps so well to real API traffic that is spiky but bounded on average.

**Tuning knobs.** `capacity` controls how big a burst you tolerate; `rate` controls the steady-state throughput. Set `capacity = rate` for a strict smooth limiter, or `capacity >> rate` to be burst-friendly. For cost-based limiting, pass a per-request `cost` instead of `1`.

### 2.5 Leaky Bucket

**Intuition / analogy.** Now flip the bucket around. Requests **pour into** a bucket (a FIFO queue) from the top, and the bucket **leaks out at a constant rate** through a hole in the bottom — say exactly 10 requests/sec, no matter how fast they arrive. If the bucket **overflows** (queue is full), new requests are dropped. The defining property: the **output rate is perfectly smooth and constant**, regardless of how bursty the input is.

Token bucket smooths by *saving allowance*; leaky bucket smooths by *pacing output*.

**How it works, step by step.**
1. Maintain a FIFO queue of capacity `C` per client.
2. Incoming requests are appended to the queue; if the queue is full, they're dropped.
3. A processor removes (leaks) requests from the queue at a fixed rate `r` and forwards them to the backend.

**Timeline example (leak rate = 2/sec, capacity = 4).**

```
input:   ▓▓▓▓▓▓  (6 requests arrive in a burst)
queue:   [▓▓▓▓]  first 4 accepted, last 2 DROPPED (overflow)
output:  ▓ . ▓ . ▓ . ▓ .   (leaks at a steady 2/sec)
```

**Worked numerical example.** Leak rate `r = 1/sec`, capacity `C = 3`. Ten requests arrive instantly at `t=0`.

```
t=0: queue accepts 3 (fills to capacity), the other 7 are DROPPED
t=1: leak 1 → forwarded (queue has 2)
t=2: leak 1 → forwarded (queue has 1)
t=3: leak 1 → forwarded (queue has 0)
```
Only 3 of the 10 got in, and they were delivered downstream at a perfectly even 1/sec.

**Pros.**
- **Perfectly smooth, constant output rate** — great for protecting a fragile downstream that hates spikes.
- Predictable load on the backend.

**Cons.**
- **No bursts allowed** — even a legitimate short spike gets shaped/dropped.
- Requests may **wait in the queue**, adding latency.
- If the queue fills, recent requests are dropped even though the client is "within budget" on average.

**Redis data model.**
```
Key:   ratelimit:{user}  → conceptually a queue; often implemented as a
       counter of "queued/processed" via the GCRA variant, or a LIST.
GCRA (a common efficient form): store a single "theoretical arrival time"
(TAT) and compare against now — O(1), no actual queue needed.
```
In practice, leaky bucket is frequently implemented as **GCRA** (Generic Cell Rate Algorithm), which stores just one timestamp and achieves the same shaping without an explicit queue.

**When to use.** When the downstream needs a **strictly smooth** input and you can tolerate queuing/dropping bursts — e.g. feeding a rate-sensitive third-party API, or traffic shaping in networking. Avoid when clients legitimately need to burst.

**Reference implementation (GCRA form, single-node pseudocode).** The queue-based version needs a background worker; the GCRA form achieves the same shaping statelessly with a single stored timestamp (the "theoretical arrival time", or TAT):
```python
def leaky_bucket_gcra_allow(client_id, rate=1.0, capacity=3, now=time.time()):
    key = f"ratelimit:{client_id}"
    emission_interval = 1.0 / rate                     # min spacing between requests
    burst_tolerance   = emission_interval * capacity   # how much bunching we allow
    tat = float(redis.get(key) or now)                 # theoretical arrival time

    allow_at = tat - burst_tolerance
    if now >= allow_at:
        new_tat = max(tat, now) + emission_interval
        redis.set(key, new_tat, ex=int(burst_tolerance) + 1)
        return True
    return False                                       # would arrive "too early"
```

**Token bucket vs leaky bucket — the crisp contrast.** They look similar but shape traffic oppositely:

```
Token bucket:  allowance ACCUMULATES while idle  → permits a burst, then paces
Leaky bucket:  output rate is FIXED regardless   → never bursts, output is flat
```

Put differently: token bucket asks "do you have saved-up allowance?" (rewards clients who were quiet), while leaky bucket asks "is it your turn yet?" (enforces even spacing no matter what). If your downstream is a fragile service that falls over on spikes, leaky bucket's flat output is a feature; if your clients are legitimately bursty and you just want to cap the average, token bucket's flexibility wins.

### 2.6 Algorithm Comparison Table

| Algorithm | Accuracy | Memory | Allows bursts? | Boundary problem? | Typical use |
| --- | --- | --- | --- | --- | --- |
| **Fixed Window** | Low (2× edge burst) | Very low (1 int) | Bursty at edges | **Yes** | Simple/approximate quotas |
| **Sliding Window Log** | Exact | High (1 entry/request) | Controlled | No | Exact limits, security |
| **Sliding Window Counter** | Very good (approx) | Low (2 ints) | Slightly | Mostly solved | **Default production choice** |
| **Token Bucket** | Good | Low (2 values) | **Yes, up to capacity** | No | Bursty APIs, gateways |
| **Leaky Bucket** | Good (shapes) | Low–med (queue/TAT) | **No (smooths)** | No | Smooth downstream feed |

Quick decision heuristics to say out loud in an interview:
- Need **exactness** and volume is low → sliding window log.
- Need **cheap + accurate enough** for a public API → sliding window counter.
- Need to **allow bursts** but cap the average → token bucket.
- Need a **perfectly smooth output** to protect a fragile dependency → leaky bucket.
- Need dead-simple and don't care about edge bursts → fixed window.

### 2.7 Hybrid and Cost-Based Rate Limiting

Real systems rarely use a single limit. Two important extensions:

**Hybrid / layered limits.** Apply several limits at once, and a request must pass *all* of them:
- Per-second limit to stop instantaneous floods (e.g. 20/sec).
- Per-minute limit for sustained rate (e.g. 300/min).
- Per-day quota for cost/business tiers (e.g. 100k/day).

You typically implement each layer with the algorithm that fits it (token bucket for the burst layer, sliding window counter for the sustained layer, fixed window for the daily quota) and reject if any layer says no.

**Cost-based (weighted) rate limiting.** Not all requests are equal. A cheap `GET /health` and an expensive `POST /report/generate` shouldn't cost the same against your budget. Instead of counting requests, count **cost units**:
- Assign each endpoint a weight/cost.
- Deduct the cost from the client's budget instead of a flat `1`.
- Token bucket generalizes cleanly: consume `cost` tokens instead of one.

The canonical example is **GraphQL query complexity**. A single GraphQL request can ask for arbitrarily nested, expensive data, so counting "requests" is meaningless. Instead you compute a **complexity score** for the query (based on field count, nesting depth, and multipliers for lists/pagination) and rate limit on **total complexity per window**.

```
query {
  users(first: 100) {        # 100 * (cost of user)
    posts(first: 50) {       # 100 * 50 * (cost of post)  ← explodes fast
      comments(first: 20) { text }
    }
  }
}
# complexity ≈ 100 * 50 * 20 = 100,000 units → likely rejected
```

LLM APIs do the same thing with **tokens-per-minute (TPM)**: a request generating 4,000 tokens costs far more of your budget than one generating 40. This is cost-based limiting in the wild.

**Layered limiter in code (all-must-pass).** A hybrid limiter simply runs several checks and denies if *any* fail:

```python
def check_all_limits(client, endpoint, cost=1, now=time.time()):
    checks = [
        # (algorithm, key, params) — a request must pass every one
        token_bucket_allow(f"{client}:burst",   capacity=20,   rate=20,   cost=cost, now=now),
        sliding_counter_allow(f"{client}:min",   limit=300,     window=60, now=now),
        fixed_window_allow(f"{client}:day",      limit=100_000, window=86400, now=now),
        sliding_counter_allow(f"{client}:{endpoint}", limit=50,  window=60, now=now),
    ]
    return all(checks)      # deny if any layer says no; most-restrictive wins
```

The burst layer stops instantaneous floods, the per-minute layer caps sustained rate, the daily layer enforces the business quota, and the per-endpoint layer protects expensive routes — independently, with the right algorithm for each. This is how production limiters are actually shaped: not one rule, but a small stack of complementary ones.

> **Interview tip:** Mentioning cost-based / GraphQL complexity limiting unprompted is a strong staff-level signal — it shows you know that "1 request = 1 unit" is an oversimplification real systems outgrow.

---

## Part 3: Where to Put the Rate Limiter (Placement)

Deciding *where* the limiter lives is as important as *which algorithm* it uses. The same logic behaves very differently at the client, the edge, the gateway, or inside your app. Let's walk the request path from outside in.

**Client-side.**
The client (browser, mobile app, SDK) throttles itself before sending. Cheap and reduces wasted network traffic, and good SDKs do it (respecting `Retry-After`). **But it can never be trusted for security** — an attacker simply doesn't run your client code. Use client-side limiting only as a UX/politeness optimization, *never* as your actual enforcement.

**CDN / Edge (Cloudflare, Fastly, Akamai, AWS CloudFront + WAF).**
Rate limit at the network edge, geographically close to the user, before traffic ever reaches your infrastructure. This is the best place to absorb **volumetric attacks (DDoS)** because malicious traffic is dropped far from your origin. Downsides: the edge often has coarser identity info (mostly IP) and limited business context. Excellent as a *first coarse layer*.

**Reverse proxy (Nginx, HAProxy, Envoy).**
Nginx has built-in rate limiting (`limit_req_zone` using a leaky-bucket algorithm). Sits in front of your app servers, is battle-tested, and offloads limiting from application code. Great for simple per-IP or per-endpoint limits. Limitation: its native state is **per-proxy-instance**, so distributed enforcement across many proxies needs shared state (or you accept approximate per-node limits).

A concrete Nginx example — 10 requests/sec per IP, allowing a small burst of 20:

```nginx
# Define a 10MB shared-memory zone keyed by client IP, leaking at 10 req/s
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    location /api/ {
        # burst=20 queues up to 20 excess requests; nodelay serves them immediately
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;                 # return 429 instead of default 503
        proxy_pass http://backend;
    }
}
```

The catch to state out loud: `api_limit:10m` is a *per-Nginx-process* shared-memory zone. If you run five Nginx boxes behind a load balancer, each enforces 10r/s independently → effectively 50r/s globally. For true global limits you either put a shared store behind it (e.g. an OpenResty + Redis Lua module) or accept per-node approximation — the same shared-state problem from Part 3's anti-pattern, just one layer out.

**API Gateway (Kong, AWS API Gateway, Apigee, Envoy-based meshes) — the sweet spot.**
This is usually the **best place** for application-level rate limiting. The gateway already sits on the request path doing auth, routing, and observability, so it *knows the client identity* (API key, user, tenant) and is the natural policy-enforcement point. Most gateways offer rate limiting as a first-class, configurable feature backed by a shared store (often Redis). If an interviewer asks "where would you put it?", **API Gateway is the strong default answer.**

```
client ─▶ CDN/Edge ─▶ API Gateway ─▶ [app servers] ─▶ backend/db
           (coarse,     (BEST: knows      (business
            DDoS)        identity,          logic only)
                         shared store)
```

**Application middleware.**
Rate limiting logic embedded in your app as middleware (e.g. Express/Django middleware calling Redis). Pro: full access to rich business context (user roles, subscription tier, per-feature logic). Con: couples limiting to app code and runs *after* the request has already reached your servers, so it protects the *backend/DB* but not the app tier itself. Good for fine-grained, context-aware limits layered *on top of* a coarser edge/gateway limit.

**In-process, per-server counters — the anti-pattern.**
The tempting-but-wrong approach: each app server keeps its *own* in-memory counter. It's blazing fast (no network hop) and needs no external store — but it's **broken in any multi-server deployment**:

```
Limit = 100/min, 10 servers, load balancer spreads traffic evenly.
Each server independently allows 100/min.
Actual global limit enforced = 10 * 100 = 1000/min.  ← 10x the intended limit!
```

Because there's no shared state, the *effective* limit multiplies by the number of servers, and it drifts as you autoscale. This is *the* classic mistake interviewers probe for. It's only acceptable if you have exactly one server, or you deliberately want a cheap approximate local guard *in addition to* a shared limiter.

**Dedicated rate-limiting service.**
A standalone microservice that every other service calls to ask "is this request allowed?" Centralizes policy, is reusable across teams, and is easy to evolve independently. The cost is an **extra network hop and a hard dependency** on that service (latency + a new failure domain you must make highly available). Big organizations (with many services needing consistent limits) favor this; smaller ones embed the limiter in the gateway.

**Placement comparison.**

| Placement | Latency | Trust/Security | Global accuracy | Business context | Verdict |
| --- | --- | --- | --- | --- | --- |
| Client-side | Best (local) | **None** (untrusted) | N/A | High | UX only, never security |
| CDN / Edge | Excellent | High (drops early) | Coarse (IP) | Low | Best for DDoS, coarse layer |
| Reverse proxy | Excellent | High | Per-node unless shared | Low | Simple per-IP limits |
| **API Gateway** | Very good | High | Good (shared store) | Good (identity) | **Best default** |
| App middleware | Good | High | Good (shared store) | **Highest** | Fine-grained, layered |
| In-process counters | **Best** | High | **Broken (Nx)** | High | Anti-pattern (multi-server) |
| Dedicated service | +1 hop | High | Best (centralized) | Good | Big orgs, many consumers |

> **Interview tip:** The winning answer is usually **layered**: coarse IP-based limiting at the CDN/edge for DDoS, then identity-aware limiting at the API Gateway backed by a shared Redis, and optionally fine-grained business-tier limits in app middleware. Naming the *in-process per-server counter* as an anti-pattern unprompted earns strong points.

---

## Part 4: The Interview Framework

When "Design a rate limiter" appears, don't jump to Redis. Walk the standard system-design framework. This part gives you a script.

### 4.1 Functional Requirements (FR)

State what the system must *do*:
- **Limit requests per client** based on a configurable rule (e.g. N requests per window).
- **Identify the client** — by user ID, IP, API key, or tenant (see 4.6).
- **Configurable rules** — limits differ by endpoint, client tier, and method; rules must be changeable without redeploying (see Part 12).
- **Reject over-limit requests** with **HTTP 429** and informative headers (`X-RateLimit-*`, `Retry-After`).
- **Allow under-limit requests** to pass through with minimal added latency.

Explicitly scope *out* things like billing, authn/z (assume it exists upstream), and analytics unless asked.

### 4.2 Non-Functional Requirements (NFR)

This is where the interesting engineering lives:
- **Low latency**: the limiter is on the hot path of *every* request, so its overhead must be tiny — target **< 10 ms** added latency (often single-digit ms).
- **High availability**: if the limiter dies, does the whole site go down? Decide fail-open vs fail-closed (Part 9). The limiter must be at least as available as the service it protects.
- **Scalability**: handle the service's peak — we'll size for something like **1M requests/sec** / **100M DAU** to force the distributed conversation.
- **Accuracy**: how strict must the limit be? Usually **eventual consistency is acceptable** — being off by a request or two around edges is fine; we don't need linearizable global counting. Saying this explicitly is a senior move because it unlocks cheaper designs.
- **Low memory / cost**: counters for millions of clients must be affordable (favor O(1)-per-client algorithms).

### 4.3 Back-of-the-Envelope Math

Do the numbers out loud; it justifies your architecture.

```
Assume: 100M DAU, average 100 requests/user/day
Total requests/day = 100M * 100 = 10 billion/day
Average RPS       = 10e9 / 86,400 ≈ 115,000 RPS
Peak (say 5x avg) ≈ 575,000 RPS  → design headroom to ~1M RPS

Storage (sliding window counter, 2 ints per active client):
  ~ each client key ≈ 100 bytes with overhead
  100M clients * 100 bytes ≈ 10 GB  → fits in memory across a Redis cluster
  (sliding window LOG would be far larger — call that out)
```

The key conclusions to voice: **a single Redis node can't do ~1M ops/sec (it caps around 100–200k ops/sec), so we must shard** (Part 8), and **the memory fits comfortably in RAM** if we pick an O(1)-per-client algorithm rather than the log.

**Storage comparison across algorithms** (per active client), to make the memory argument concrete:

| Algorithm | State per client | ~Bytes/client | 100M clients |
| --- | --- | --- | --- |
| Fixed window | 1 integer | ~50 B | ~5 GB |
| Sliding window counter | 2 integers | ~100 B | ~10 GB |
| Token bucket | 2 values (hash) | ~120 B | ~12 GB |
| Leaky bucket (GCRA) | 1 timestamp | ~60 B | ~6 GB |
| Sliding window log | 1 entry **per request** | ~64 B × N | **100s of GB–TB** |

The takeaway you say aloud: "Every O(1)-per-client algorithm fits in ~5–12 GB across the cluster — trivial. Only the sliding window *log* explodes, because it scales with request *volume*, not client *count*. That memory profile alone often decides the algorithm." Also note that TTLs mean *idle* clients evict themselves, so the real footprint tracks *active* clients, not your total user base — usually far smaller than 100M at any instant.

### 4.4 Core Entities

Three entities cover the model:
- **Rule / Policy**: `{ id, scope (endpoint/method/tier), limit, window, algorithm }`.
- **Client / Identity**: the thing being limited (`user_id`, `ip`, `api_key`, `tenant_id`).
- **Request / Counter**: the runtime state — the counter/bucket keyed by `(client, rule)`.

### 4.5 The Core Interface

Reduce the whole system to one method — this framing impresses interviewers because it isolates the contract from the implementation:

```
isRequestAllowed(clientId, ruleId) -> Decision {
    allowed: bool,
    limit: int,
    remaining: int,
    resetAfterSeconds: int,
    retryAfterSeconds: int   // set when allowed == false
}
```

Everything else — algorithm choice, Redis, Lua, sharding — is *how* you implement this one function. Design the interface first, then fill in the box behind it.

### 4.6 Identifying Clients

You can't limit a client you can't name. Options, from most to least trustworthy:
- **API key / user ID** (authenticated): the gold standard — stable, tied to a real account and tier.
- **IP address** (unauthenticated): available for anonymous traffic, but imperfect. Caveats:
  - **NAT / shared IPs**: an entire office, campus, or mobile carrier can share one IP, so an IP limit may punish thousands of innocent users (see Part 11).
  - **IPv6**: attackers can rotate through huge address ranges cheaply, so limit by `/64` subnet, not single address.
  - **Spoofing / proxies**: X-Forwarded-For can be forged if not sanitized at a trusted edge.
- **Composite / layered keys**: combine identifiers, e.g. limit per `(api_key)` *and* per `(ip)` *and* per `(api_key, endpoint)` simultaneously.

**Layered rules** are standard in production: a request must pass *all* applicable limits (global per-IP flood guard **and** per-user quota **and** per-endpoint limit). Reject if any layer denies.

### 4.7 High-Level Design (HLD)

Put it together:

```
                     ┌─────────────────────────────────────────┐
 client ──▶ LB ──▶   │  API Gateway / Rate-Limit Middleware     │
                     │   1. extract clientId (key/IP/user)      │
                     │   2. look up matching rule(s)            │
                     │   3. isRequestAllowed()? ── Lua on Redis │
                     └───────────────┬─────────────┬───────────┘
                        allowed │            │ denied
                                ▼            ▼
                         backend/app     429 + headers
                                              (Retry-After)
                                │
                                ▼
                   ┌──────────────────────────┐
                   │  Redis Cluster (sharded   │   ◀── Rule config store
                   │  by clientId; counters/   │       (pushed/polled;
                   │  buckets; Lua atomic ops) │        Part 12)
                   └──────────────────────────┘
```

Flow: request → identify client → fetch rule(s) (from a fast-changing config store) → run the algorithm atomically in Redis via a Lua script → allow (forward) or deny (429 + headers). The rest of this guide details each box: storage (Part 5), atomicity (Part 6), the response (Part 7), scaling (Part 8), HA (Part 9), latency (Part 10).

> **Interview tip:** Spend your first 5–8 minutes on FR/NFR/math/interface *before* drawing boxes. Interviewers grade the framework as much as the design. The single method `isRequestAllowed` is your anchor.

---

## Part 5: Storage — Where the Counters Live

The heart of a *distributed* rate limiter is a shared-state problem. Let's motivate it and pick a store.

### 5.1 Why Shared State Is Required

As shown in Part 3, per-server in-memory counters multiply your limit by the number of servers. In any horizontally scaled system, **all instances must consult a single, shared source of truth** for the counters. That's the whole distributed challenge: fast, consistent, shared counting across many machines.

### 5.2 In-Memory vs Centralized vs Distributed

| Approach | Where state lives | Global accuracy | Latency | Problem |
| --- | --- | --- | --- | --- |
| **Per-node in-memory** | Each app server | Broken (Nx) | Best | Not global |
| **Centralized store (single Redis)** | One shared node | Correct | +1 network hop | Single point of failure + throughput cap |
| **Distributed store (Redis Cluster)** | Sharded nodes | Correct | +1 hop | Complexity, but scales |

The progression of the interview is: naive in-memory → "that's wrong across servers" → centralized shared store → "that won't scale/HA" → distributed sharded store. Narrate this evolution.

### 5.3 Why Redis

**Redis** is the near-universal answer, and you should be able to say *why*:
- **In-memory** → microsecond-level operations, which keeps us under the <10 ms budget.
- **Single-threaded command execution** → each command is **atomic** by nature, which is huge for avoiding race conditions (Part 6).
- **Rich data structures** → strings/`INCR`, hashes, and sorted sets map perfectly onto the algorithms.
- **Built-in TTL / `EXPIRE`** → windows and buckets clean themselves up automatically; no garbage-collection job.
- **Atomic `INCR`** and **Lua scripting** → the two workhorses for correct rate limiting.
- **Clustering & replication** → scales horizontally and supports HA.
- Mature, ubiquitous, well-understood operationally.

Alternatives exist (Memcached — lacks the rich structures and Lua; in-memory embedded stores; purpose-built systems), but Redis is the default you should propose and defend.

### 5.4 Data Models Per Algorithm

Concretely, how each algorithm maps to Redis:

**Fixed window** — a string counter with expiry:
```
INCR  ratelimit:{client}:{window_epoch}
EXPIRE ratelimit:{client}:{window_epoch} <window_seconds>
# deny if returned value > limit
```

**Sliding window counter** — two string counters:
```
cur  = INCR ratelimit:{client}:{current_window}
prev = GET  ratelimit:{client}:{previous_window}   (0 if missing)
estimated = cur + prev * (1 - elapsed_fraction)
# deny if estimated > limit
```

**Token bucket** — a hash holding tokens + last refill time:
```
HGETALL ratelimit:{client}      → { tokens, last_refill }
# lazily refill by elapsed time, consume 1 (or `cost`), write back
HSET ...; EXPIRE ...
```

**Leaky bucket (GCRA)** — a single stored timestamp (theoretical arrival time):
```
GET ratelimit:{client}   → TAT
# compare now vs TAT + emission interval; update TAT if allowed
```

**Sliding window log** — a sorted set of timestamps:
```
ZREMRANGEBYSCORE key 0 (now - window)   # trim
ZCARD key                               # count
ZADD key now member                     # record (if allowed)
EXPIRE key window
```

Every one of these should be executed **atomically** — which is exactly the subject of Part 6.

---

## Part 6: Race Conditions and Atomicity

This is where good candidates separate from great ones. The moment counters are shared across concurrent requests, you have a **race condition** to defeat.

### 6.1 The Classic Double-Allow Race

Consider the naive read-modify-write with limit = 5 and current count = 5 (client is *at* the limit). Two requests arrive at the same instant on two different app servers:

```
Time  Server A                     Server B
 t0   count = GET key  → 5
 t1                                count = GET key  → 5
 t2   5 < ... hmm, is 5 < 5? no    (both read the SAME stale value)
```

More dangerously, with count = 4 and limit = 5:

```
 t0   A: GET → 4
 t1   B: GET → 4          (B hasn't seen A's write yet)
 t2   A: 4 < 5 → allow, SET 5
 t3   B: 4 < 5 → allow, SET 5     ← should have been denied!
```

Both requests are allowed even though only one slot remained. Under high concurrency this **over-admits** — the exact thing the limiter exists to prevent. The root cause is a **non-atomic read-then-write**: two clients interleave between the read and the write.

### 6.2 `INCR` Is Atomic (Partial Fix)

Redis `INCR` reads, increments, and writes **as a single atomic operation**, returning the new value. So the fixed-window check becomes:

```
new = INCR key          # atomic; no interleaving possible
if new == 1: EXPIRE key window
if new > limit: deny else allow
```

Because `INCR` can't be interleaved, two concurrent requests get distinct values (say 5 and 6), and only the correct number are allowed. This solves the *simple counter* race. **But** notice the `EXPIRE` is a *separate* command — if the process crashes between `INCR` and `EXPIRE`, the key can leak without a TTL. And more complex algorithms need more than a single increment.

### 6.3 `MULTI/EXEC` Still Races If You Read Outside It

A common wrong answer is "just use a Redis transaction (`MULTI/EXEC`)." Redis transactions **queue commands and execute them together without interleaving other clients**, but they are **not** read-decide-write within the transaction — you can't branch inside a plain `MULTI/EXEC` based on a value you read. So people do:

```
value = GET key            # (1) read OUTSIDE the transaction
if value < limit:
    MULTI
    INCR key               # (2) executed later, atomically
    EXEC
```

The decision in step (1) is made on a value read **before** the transaction, so two clients can both read `value < limit` and both proceed — the race is *back*. (`WATCH`/optimistic locking can fix this via retries, but it adds complexity and retries under contention.) The clean, standard solution is different.

### 6.4 Lua Scripts: The Real Solution

Redis executes a **Lua script atomically** — the entire script runs as one uninterruptible unit, with no other command interleaving. This lets you do **read → decide → write** atomically, which is *exactly* what rate limiting needs. This is the canonical, production-correct approach and the answer interviewers want to hear.

You embed the whole algorithm — read state, compute, branch, update, set TTL — in one script, and Redis guarantees it runs indivisibly on the node holding that key.

### 6.5 Full Token-Bucket Redis Lua Walkthrough

Here is a complete, atomic token-bucket limiter in Lua. Read it carefully — being able to write something close to this from memory is a strong signal.

```lua
-- KEYS[1] = bucket key, e.g. ratelimit:{user123}
-- ARGV[1] = capacity        (max tokens, e.g. 10)
-- ARGV[2] = refill_rate      (tokens per second, e.g. 1)
-- ARGV[3] = now              (current time, seconds, from caller or redis TIME)
-- ARGV[4] = requested        (cost of this request, usually 1)

local key       = KEYS[1]
local capacity  = tonumber(ARGV[1])
local rate      = tonumber(ARGV[2])
local now       = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

-- 1. Load current state (default to a full bucket for a new client)
local data       = redis.call("HMGET", key, "tokens", "last_refill")
local tokens     = tonumber(data[1])
local last_refill= tonumber(data[2])
if tokens == nil then
  tokens = capacity
  last_refill = now
end

-- 2. Lazily refill based on elapsed time
local elapsed = math.max(0, now - last_refill)
tokens = math.min(capacity, tokens + elapsed * rate)
last_refill = now

-- 3. Decide
local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

-- 4. Persist state + set TTL so idle clients are evicted
redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
redis.call("EXPIRE", key, math.ceil(capacity / rate) * 2)

-- 5. Return decision + remaining tokens (for X-RateLimit-Remaining)
return { allowed, tokens }
```

Why this is correct:
- The **entire** read-refill-decide-write sequence runs atomically — no two requests can interleave, so the double-allow race is impossible.
- **Lazy refill** means no background timer; tokens accrue based on wall-clock elapsed time.
- The **TTL** guarantees idle clients don't leak memory.
- It returns `remaining`, which the app turns into `X-RateLimit-Remaining` (Part 7).
- Generalizes to **cost-based** limiting for free via `requested` (pass the query's complexity/cost).

### 6.6 Fixed Window and Sliding Window Counter in Lua

The same atomicity discipline applies to the other algorithms. A **fixed window** limiter, made race-proof and leak-proof in one script (the `INCR` and `EXPIRE` can no longer be split by a crash):

```lua
-- KEYS[1] = ratelimit:{client}:{window_start}
-- ARGV[1] = limit,  ARGV[2] = window_seconds
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
end
if count > tonumber(ARGV[1]) then
  return 0            -- denied
end
return 1              -- allowed
```

A **sliding window counter**, computing the weighted estimate atomically so no two requests can both squeeze past the threshold:

```lua
-- KEYS[1] = current window key, KEYS[2] = previous window key
-- ARGV[1] = limit, ARGV[2] = elapsed_fraction (0..1)
local cur  = tonumber(redis.call("GET", KEYS[1]) or "0")
local prev = tonumber(redis.call("GET", KEYS[2]) or "0")
local estimated = cur + prev * (1 - tonumber(ARGV[2]))
if estimated >= tonumber(ARGV[1]) then
  return 0            -- denied
end
redis.call("INCR", KEYS[1])
redis.call("EXPIRE", KEYS[1], 120)   -- ~2 windows so it survives as "previous"
return 1              -- allowed
```

And a **sliding window log** (trim, count, conditionally add — all indivisible):

```lua
-- KEYS[1] = ratelimit:{client}  (a ZSET of timestamps)
-- ARGV[1] = now, ARGV[2] = window, ARGV[3] = limit, ARGV[4] = unique_member
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, tonumber(ARGV[1]) - tonumber(ARGV[2]))
local count = redis.call("ZCARD", KEYS[1])
if count < tonumber(ARGV[3]) then
  redis.call("ZADD", KEYS[1], tonumber(ARGV[1]), ARGV[4])
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[2]))
  return 1            -- allowed
end
return 0              -- denied
```

The pattern is identical in every case: **read state, decide, mutate, set TTL — all inside one Lua script** so the whole decision is a single atomic step on the node that owns the key. Note that for Redis Cluster, all `KEYS` a script touches must live in the same slot, which is why we use hash tags like `ratelimit:{client}:...` (only the `{client}` part is hashed) so a client's current and previous window keys co-locate.

> **Interview tip:** The progression to narrate is: *naive read-modify-write (races) → `INCR` (fixes the simple case, but `EXPIRE` is separate and complex algorithms need more) → `MULTI/EXEC` (still races if you read outside it) → **Lua script** (atomic read-decide-write, the real answer).* Walking this ladder proves you understand *why* Lua, not just *that* Lua.

---

## Part 7: The Response Contract

When a request is rejected — and when it's allowed — what exactly do you send back? A good rate limiter is a good *citizen*: it tells clients what happened and how to recover.

### 7.1 HTTP 429 Too Many Requests

The standard status code for a rate-limited request is **`429 Too Many Requests`** (RFC 6585). Don't use `503` (that means the *server* is unavailable) or `403` (forbidden/authz). `429` specifically says "you're being throttled; slow down."

### 7.2 The Standard Headers

Return headers so well-behaved clients can self-regulate *without* having to hit the wall:

| Header | Meaning | Example |
| --- | --- | --- |
| `X-RateLimit-Limit` | Total requests allowed in the window | `100` |
| `X-RateLimit-Remaining` | Requests left in the current window | `0` |
| `X-RateLimit-Reset` | When the window resets (epoch seconds or seconds-until) | `1719-...` / `42` |
| `Retry-After` | Seconds (or HTTP date) to wait before retrying | `42` |

Send `X-RateLimit-*` on **every** response (even successful ones) so clients can pace themselves proactively. Send **`Retry-After`** specifically on `429` responses so the client knows exactly how long to back off. (There's also a newer standardized `RateLimit`/`RateLimit-Policy` header draft; mentioning it is a nice bonus.)

A typical 429 response:
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 42
Retry-After: 42
Content-Type: application/json

{ "error": "rate_limit_exceeded",
  "message": "Too many requests. Retry after 42 seconds." }
```

### 7.3 Fail-Fast vs Queueing

When a client is over the limit, you have two philosophies:
- **Fail-fast (reject)**: return `429` immediately. Simple, predictable, and standard for APIs. The client owns the retry.
- **Queue / throttle (delay)**: hold the request and process it later at the allowed rate (leaky-bucket style). Smooths load but adds latency, consumes server memory holding queued requests, and risks timeouts. Use only when the workload tolerates delay (e.g. background/batch jobs) — not for interactive APIs.

For most interview answers, **fail-fast with a helpful `Retry-After`** is the right default; mention queueing as an option for specific async workloads.

### 7.4 Shadowban / Silent Handling

Sometimes you *don't* want to tell an abuser they've been detected. Options:
- **Silent 200 / shadowban**: accept the request and return `200`, but **drop or ignore** the action (common in anti-spam/anti-bot). The attacker thinks they're succeeding and doesn't adapt.
- **Tarpitting**: deliberately respond very slowly to waste the attacker's resources.

These trade transparency for security and are used against malicious actors, not legitimate over-eager clients. For normal clients, always be transparent with a clear `429` + `Retry-After`.

### 7.5 A Good Client's Lifecycle Against the Headers

Well-behaved clients use your headers to *never hit the wall*. Here's the intended loop:

```
GET /api/data
← 200 OK
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 42        ← client sees it has budget, proceeds freely

...many requests later...
← 200 OK
  X-RateLimit-Remaining: 3         ← client notices it's low, starts pacing itself

GET /api/data
← 429 Too Many Requests
  X-RateLimit-Remaining: 0
  Retry-After: 18                  ← client sleeps 18s (ideally with jitter) then retries
```

Two client-side best practices to mention: (1) **honor `Retry-After` exactly** rather than hammering, and (2) add **jitter** to backoff so thousands of clients that were limited at the same instant don't all retry in lockstep and create a synchronized thundering herd when the window resets. A limiter that emits good headers *and* clients that respect them together produce a smooth, self-regulating system instead of a reject-retry storm.

### 7.6 Idempotency and Retries

A subtle interaction: when a client retries after a `429`, you don't want the retry to be *double-counted* or to re-execute a non-idempotent action. Guidance: rate-limit *before* doing work, so a rejected request never touches the backend and never consumes anything but the limiter check itself. For non-idempotent writes, pair rate limiting with an **idempotency key** so a client that retries a `POST` after a `429` (or a network blip) doesn't create duplicate resources. Rate limiting and idempotency are orthogonal concerns, but they meet on the retry path, and mentioning that shows end-to-end thinking.

> **Interview tip:** Saying "I'd return `429` with `Retry-After` and emit `X-RateLimit-*` on every response so good clients self-throttle" shows you think about the *client experience*, not just server enforcement. Mentioning shadowbanning for abuse scenarios adds nuance.

---

## Part 8: Scaling the Rate Limiter

A single Redis node handles a lot — but not a million ops per second. Let's scale.

### 8.1 The Single-Redis Bottleneck

A single Redis instance is single-threaded for command execution and typically tops out around **~100,000–200,000 operations/sec** (varies with pipelining, payload, and hardware). Our back-of-envelope target was ~1M RPS at peak, and each rate-limit check is at least one Redis op. So **one node cannot keep up**, and it's also a **single point of failure**. We must distribute the counters across multiple Redis nodes.

### 8.2 Sharding by Client ID (Consistent Hashing)

We partition (**shard**) the keyspace across N Redis nodes. The crucial rule: **shard by client identity** so that *all* requests for a given client always land on the *same* node — otherwise that client's counter would be split across nodes and be meaningless.

```
node = hash(client_id) mod N          # naive modulo sharding
```

Naive `mod N` has a fatal flaw: adding/removing a node changes `N`, which **remaps almost every key**, blowing away counters and causing a thundering herd of misses. The fix is **consistent hashing**: place nodes and keys on a hash ring so that adding/removing a node only remaps the keys in one segment (`~1/N` of keys) instead of all of them. This keeps rebalancing cheap during scaling and failures.

```
        ┌───────── hash ring ─────────┐
        │   ●nodeA        ●nodeB       │
        │        key123→A              │   add nodeD → only keys between
        │   ●nodeC        (nodeD?)     │   nodeC and nodeD move; rest stay
        └──────────────────────────────┘
```

### 8.3 Redis Cluster and the 16384 Slots

Redis Cluster formalizes this with **16,384 hash slots**. Every key is mapped to a slot via `CRC16(key) mod 16384`, and slots are distributed across the cluster's master nodes. To scale, you **move slots** (and their keys) between nodes; clients are redirected transparently. This gives you sharding + the ability to rebalance in slot-sized chunks.

- Use a **hash tag** like `ratelimit:{user123}:...` so that all keys for a client hash to the *same* slot (the `{...}` part is what Redis hashes), keeping a client's multiple keys/Lua `KEYS` co-located — important because a Lua script's keys must live in the same slot.

### 8.4 Capacity Math

Size the cluster from the numbers:

```
Peak target        ≈ 1,000,000 ops/sec
Per-node capacity  ≈ 150,000 ops/sec (conservative)
Nodes needed       ≈ 1,000,000 / 150,000 ≈ 7 masters
Add headroom + replicas: ~8–10 masters, each with 1 replica  → ~16–20 nodes
Memory: ~10 GB of counters / 8 masters ≈ 1.25 GB per node  → trivial
```

You conclude: a modest Redis Cluster of roughly 8–10 shards (plus replicas for HA) comfortably serves 1M RPS with room to grow, and consistent hashing/slots let us add shards as traffic grows without nuking counters.

### 8.5 A Worked Resharding Example

To make consistent hashing concrete, contrast what happens when you grow from 4 → 5 nodes.

**Naive `mod N`:** with `node = hash(client) mod 4`, a client hashing to `13` lands on `13 % 4 = 1`. Switch to `mod 5` and it lands on `13 % 5 = 3`. Almost *every* client's node changes, so almost every counter is suddenly on the "wrong" node — a cold start where all clients briefly appear to have zero usage (a giant free-for-all) plus a stampede of cache misses. Unacceptable during a routine scale-up.

**Consistent hashing:** nodes and clients are placed on a ring by hash. A client is served by the next node clockwise. Adding node E only steals the arc of keys between E and its clockwise neighbor — roughly `1/5` of keys move; the other `~80%` stay exactly where they were, counters intact.

```
Before (4 nodes):  A····B····C····D····(wrap to A)
Add E between B,C: A····B··E··C····D····(wrap to A)
Only keys in (B, E] move from C to E; A, D, and most of B/C keys untouched.
```

In Redis Cluster terms, this is "move a subset of the 16384 slots to the new node." You migrate slots online, and clients following `MOVED`/`ASK` redirections find the relocated keys transparently. Virtual nodes (many ring positions per physical node) further smooth the distribution so no single node gets an unfairly large arc.

> **Interview tip:** The three magic facts to have ready: **single Redis ≈ 100–200k ops/sec**, **shard by client id with consistent hashing (not naive mod N)**, and **Redis Cluster uses 16384 slots**. Dropping these unprompted signals real distributed-systems depth.

---

## Part 9: High Availability

The limiter sits on *every* request's critical path, so if it goes down, what happens? This is one of the most important design decisions.

### 9.1 Fail-Open vs Fail-Closed

When the rate-limiter store (Redis) is unreachable, you must choose a default:

| Mode | Behavior on limiter failure | Optimizes for | Risk |
| --- | --- | --- | --- |
| **Fail-open** | **Allow** the request | Availability / UX | Backend gets flooded (no protection) |
| **Fail-closed** | **Reject** the request (429/503) | Protection | You take yourself down / block real users |

- **Fail-open** is the common default for *most* APIs: "if my rate limiter breaks, don't take the whole product down — just stop enforcing limits temporarily." The danger is that during a Redis outage you have *zero* protection, so a coincident traffic spike/attack could overwhelm the backend.
- **Fail-closed** is right for **security-critical** paths (login, payments) where allowing unlimited requests is worse than rejecting some legitimate ones. Better to deny than to let a brute-force run wild.

The mature answer: **it depends on the endpoint** — fail-open for general read APIs, fail-closed for sensitive/abuse-prone endpoints. You can also degrade to a **local approximate limiter** if the shared store is down (fail to a conservative local guard rather than pure open/closed).

### 9.2 Master–Replica Replication

To avoid the store being a single point of failure:
- Run each Redis shard as a **master with one or more replicas**.
- Replication is **asynchronous**, so a failover can lose the last few writes — meaning a client might get a handful of extra requests around a failover. That's acceptable because we already agreed **eventual consistency / minor inaccuracy is fine** (Part 4.2).
- Use **Redis Sentinel** (or Cluster's built-in failover) to detect a dead master and promote a replica automatically.

The key insight to state: because we tolerate small inaccuracies, we can use *cheap async replication* rather than expensive strong consistency — a deliberate trade-off that keeps latency low and availability high.

### 9.3 Monitoring and Metrics

You can't run what you can't see. Track:
- **Allowed vs rejected (429) rates** — overall and per client/endpoint; a spike in 429s may signal an attack *or* a misconfigured limit hurting real users.
- **Limiter latency (p50/p99)** — must stay within budget; watch for Redis slowness.
- **Redis health** — ops/sec, memory, evictions, replication lag, hit/miss.
- **Fail-open/closed activations** — alert loudly whenever the limiter is degraded.
- **Top limited clients (hot keys)** — feeds abuse detection (Part 11).

Alert on abnormal 429 ratios and on any fail-open event, because a silent fail-open means you're unprotected without knowing it.

**Concrete metrics and alert thresholds:**

| Metric | Why it matters | Example alert |
| --- | --- | --- |
| 429 rate (global) | Sudden spike = attack or misconfigured limit | > 5% of traffic for 5 min |
| 429 rate per client | Identifies abusers / broken integrations | single client > 90% rejected |
| Limiter latency p99 | Must stay within budget | p99 > 10 ms for 5 min |
| Redis ops/sec per shard | Approaching the ~150k ceiling | > 80% of node capacity |
| Redis memory / evictions | Leaks or under-provisioning | evictions > 0, or mem > 80% |
| Replication lag | Failover data-loss window | lag > 1 s |
| Fail-open activations | You are currently unprotected | **any** occurrence → page |

**Degraded mode.** When the shared store is unreachable, rather than a binary open/closed choice, many systems degrade to a **conservative local limiter**: each node enforces a small local budget from memory. This keeps *some* protection alive during a Redis outage (better than pure fail-open) without hard-rejecting everyone (better than pure fail-closed). It over-admits a bit (per-node budgets don't coordinate), but that's acceptable for a temporary degraded window — and it's another place our eventual-consistency tolerance pays off.

> **Interview tip:** Don't just pick fail-open or fail-closed — explain the trade-off and say it's **per-endpoint**, then note that async replication is acceptable *because* we already accepted eventual consistency. Tying decisions back to earlier NFRs shows coherent reasoning.

---

## Part 10: Latency Optimization

The limiter adds work to every request, so shaving milliseconds matters. Here are the standard techniques.

### 10.1 Connection Pooling

Opening a new TCP connection to Redis per request is wasteful (handshake cost). **Pool and reuse** connections so each check just borrows a warm connection. This alone removes a large chunk of per-request overhead.

### 10.2 Geographic Distribution

For a global service, a request from Tokyo shouldn't cross the ocean to hit a Redis cluster in Virginia — that adds 150+ ms of pure network latency. **Deploy rate-limiter state regionally**, close to users. The subtlety: a *global* limit is hard to enforce with regional stores (cross-region coordination is slow). Practical answers:
- Enforce limits **per region** (often fine — a client usually hits one region), or
- Use a **global limit split across regions** (e.g. divide the quota), accepting approximation, or
- Asynchronously **replicate/aggregate** counts for a loosely-global view.

State clearly that a strict global limit trades latency for accuracy, and most systems choose regional/approximate enforcement.

### 10.3 Local Cache + Accuracy Trade-off (Stripe-style)

The most important latency technique: keep a **small local (in-process) cache** in front of the shared Redis. Ideas:
- **Local token buckets synced periodically** with the central store. The node serves most decisions from local memory (nanoseconds) and reconciles with Redis in the background.
- Batch or **defer syncing**: allow a node a small local budget, then top up from the central store.

**Stripe** is the canonical example: they use a local approximation to keep the common path fast, accepting that the limit is *slightly* less precise. This directly leverages our NFR that **eventual consistency is acceptable** — a tiny inaccuracy buys a huge latency win. The trade-off: local caches can allow a bit of over-admission (each node has a small independent budget), so you tune the local budget small enough that the aggregate drift is negligible.

```
request ─▶ [local token bucket]  ── hit (fast path) ─▶ allow
                   │  budget low?
                   └── async top-up / reconcile ─▶ [central Redis]
```

### 10.4 Pipelining

When a request needs multiple Redis operations (or you batch several checks), **pipeline** them — send all commands at once without waiting for each round-trip — collapsing N network round-trips into one. Combined with Lua (which already bundles logic server-side), this keeps the network cost minimal.

```python
# Without pipelining: 4 round-trips (one per limit layer) → 4 × RTT
# With pipelining: 1 round-trip carrying all 4 EVALSHA calls → 1 × RTT
pipe = redis.pipeline(transaction=False)
for layer in layers:
    pipe.evalsha(layer.sha, 1, layer.key, *layer.args)   # queue, don't wait
results = pipe.execute()                                  # one network round-trip
allowed = all(r[0] == 1 for r in results)
```

Note that a single well-written Lua script already collapses an entire algorithm into one round-trip; pipelining is what you reach for when a request must satisfy *several* independent limits (layered rules) that live on the same shard. Preload scripts with `SCRIPT LOAD` and call them by SHA (`EVALSHA`) so you're not shipping the script body on every request.

> **Interview tip:** The standout answer here is the **local-cache/approximation trade-off (Stripe)**: "I'd serve most decisions from a local token bucket synced periodically with Redis, accepting slight inaccuracy for big latency wins — which is fine because we established eventual consistency is acceptable." That connects latency, accuracy, and your NFRs in one breath.

---

## Part 11: Hot Keys and Abuse

A **hot key** is a single limiter key taking a hugely disproportionate share of traffic. It concentrates load on one Redis slot/node and can become a bottleneck or a target.

### 11.1 Legitimate vs Abusive Hot Keys

First, diagnose the cause:
- **Legitimate**: a genuinely huge tenant, a viral event, or a popular shared resource. The traffic is real and welcome — you need to *scale to serve it*.
- **Abusive**: an attacker or runaway client hammering one endpoint/identity. You want to *shed/block it*.

The response differs: legitimate hot keys need capacity engineering; abusive ones need defense.

### 11.2 Strategies for Legitimate Hot Keys

- **Local caching / local rate limiting** (Part 10): serve most decisions at the node so the hot key isn't hammering one Redis slot on every request.
- **Key splitting / sharding a hot counter**: split one hot key into N sub-counters (`key:0..N-1`), spread across slots, and sum/allocate across them — trading a little accuracy for spread load.
- **Dedicated capacity**: route the biggest tenants to their own shard.

### 11.3 Strategies for Abusive Hot Keys

- **Client-side rate limiting** as politeness (never trusted for enforcement, but reduces friendly-client noise).
- **Progressive penalties**: escalate from throttling to temporary blocks to bans for repeat offenders.
- **Edge/network defenses** — push abuse handling as far out as possible:
  - **Cloudflare / AWS Shield / AWS WAF**: absorb volumetric DDoS at the edge before it reaches you.
  - **IP/subnet blocking**, bot detection, and challenge (CAPTCHA/JS challenge) for suspicious traffic.
- **Anomaly detection** on the "top limited clients" metric to spot new abuse patterns.

### 11.4 The NAT / Shared-IP Caveat

Be careful blocking by IP: **NAT means many users share one public IP** (a whole company, university, or mobile carrier can appear as a single address). A hard per-IP block can knock thousands of innocent users offline, and IPv6 lets attackers rotate addresses cheaply. Mitigations:
- Prefer **authenticated identity** (API key/user) over IP whenever possible.
- For IPv6, limit by **`/64` subnet**, not single address.
- Use IP limits as a **coarse first layer**, with more lenient thresholds, and combine with behavioral signals rather than blunt bans.

> **Interview tip:** Distinguishing **legitimate vs abusive** hot keys, and raising the **NAT/shared-IP** caveat unprompted, shows real production maturity — it signals you know rate limiting can *hurt* real users if applied naively.

---

## Part 12: Dynamic Configuration

Rate-limit rules change constantly — new tiers, emergency clamps during an incident, per-customer overrides. You must change them **without redeploying**, and every limiter node must pick up changes quickly.

### 12.1 Poll vs Push

Two ways to distribute config changes to all limiter instances:

| Approach | How | Pros | Cons |
| --- | --- | --- | --- |
| **Poll** | Each node periodically re-reads rules from a config store | Simple, resilient | Staleness up to poll interval; load on store |
| **Push** | Config store notifies nodes on change | Near-instant propagation | More moving parts (subscriptions/watches) |

Common mechanisms:
- **ZooKeeper / etcd / Consul**: nodes **watch** a config path and get notified on change (push) — strongly consistent config distribution.
- **Redis Pub/Sub**: publish a "rules changed" message; subscribed nodes reload (push, cheap, eventually consistent).
- **Periodic poll** of a database/S3/config service with a short cache TTL (poll) — dead simple and often good enough.

A pragmatic production pattern: store rules in a durable store, cache them locally on each node, and use **pub/sub (or a watch) to trigger a reload**, falling back to a periodic poll so a missed message self-heals.

### 12.2 Rule Schema (JSON)

Rules are just data. A workable schema:

```json
{
  "rules": [
    {
      "id": "login-ip-strict",
      "match": { "endpoint": "/login", "method": "POST", "scope": "ip" },
      "algorithm": "sliding_window_log",
      "limit": 5,
      "window_seconds": 900,
      "priority": 100
    },
    {
      "id": "api-user-pro",
      "match": { "endpoint": "*", "scope": "api_key", "tier": "pro" },
      "algorithm": "token_bucket",
      "limit": 10000,
      "window_seconds": 3600,
      "burst": 200,
      "priority": 50
    },
    {
      "id": "global-default",
      "match": { "endpoint": "*", "scope": "api_key" },
      "algorithm": "sliding_window_counter",
      "limit": 1000,
      "window_seconds": 3600,
      "priority": 1
    }
  ]
}
```

### 12.3 Evaluation Order: Most-Specific → Least-Specific

When multiple rules match a request, you need deterministic ordering. The standard approach: **evaluate from most-specific to least-specific**, using a `priority` field. A specific rule (`/login` for a given IP) overrides a broad default (`*` for all API keys). Two common policies:
- **First match wins**: apply the highest-priority matching rule and stop.
- **All-must-pass (layered)**: a request must satisfy *every* matching limit (global flood guard *and* per-user quota *and* per-endpoint) — reject if any denies. This is the more robust production choice for defense-in-depth.

Be explicit about which policy you're using; ambiguity here is a common source of production bugs.

**Rule evaluation in pseudocode.** How a node turns an incoming request + cached rules into a decision:

```python
def evaluate(request, rules_cache):
    # find every rule whose match block applies to this request
    matched = [r for r in rules_cache if matches(r["match"], request)]
    # sort most-specific first (highest priority first)
    matched.sort(key=lambda r: r["priority"], reverse=True)

    remaining_info = []
    for rule in matched:                       # all-must-pass
        decision = run_algorithm(rule, client_key(request, rule["match"]["scope"]))
        remaining_info.append(decision)
        if not decision.allowed:
            return deny(retry_after=decision.reset, headers=remaining_info)
    return allow(headers=remaining_info)       # report the tightest remaining budget

def matches(match, request):
    return ((match["endpoint"] in ("*", request.endpoint)) and
            (match.get("method", request.method) == request.method) and
            (match.get("tier",   request.tier)   == request.tier))
```

Two details worth noting: (1) rules are read from a **local cache** refreshed by pub/sub or a poll, so evaluation never blocks on the config store; and (2) when reporting `X-RateLimit-*` headers on an allowed request, surface the **tightest** remaining budget across all matched rules, so clients pace against whichever limit they'll hit first.

> **Interview tip:** Mentioning that rules live in a config store, propagate via **pub/sub or a watch (with a poll fallback)**, and are evaluated **most-specific-first / all-must-pass** shows you've thought past the happy path into operability.

---

## Part 13: Advanced Follow-ups

These are the curveballs interviewers throw once the core design is solid. Have crisp answers ready.

### 13.1 Cost-Based / GraphQL Complexity

Covered in Part 2.7. Summary: when requests aren't equal, limit on **cost units** not request count. Compute a **complexity score** per request (GraphQL query cost, LLM token count, payload size) and deduct that from the budget — token bucket handles this natively by consuming `cost` tokens. Say: "I'd weight expensive endpoints and rate limit on total cost per window rather than raw request count."

### 13.2 IP Rotation and Evasion

Attackers rotate IPs (botnets, proxy pools, cheap IPv6 ranges) to dodge per-IP limits. Defenses:
- Prefer **authenticated identity** over IP where possible.
- Limit by **subnet (`/64` for IPv6)**, not single address.
- Layer **behavioral / device fingerprinting** and reputation signals.
- Push volumetric defense to the **edge (Cloudflare/WAF/Shield)** and use challenges (CAPTCHA) for suspicious patterns.
- Accept that no single signal is perfect — **defense in depth** across identity, network, and behavior.

### 13.3 Geo-Distributed Rate Limiting

Covered in Part 10.2. The core tension: a **strict global limit** requires cross-region coordination (slow), while **regional limits** are fast but approximate. Practical answers: enforce per-region limits, or split a global quota across regions, or asynchronously aggregate counts for an approximate global view. State the latency-vs-accuracy trade-off explicitly and pick regional/approximate for most systems.

### 13.4 Clock Skew

Sliding-window and token-bucket math depends on time. If different app servers have skewed clocks and each passes its own `now`, the algorithm misbehaves (tokens refilled wrong, windows misaligned). **Solution: use a single source of time — Redis's own `TIME` command.** Since all requests for a key hit the same Redis node, using `redis.call("TIME")` *inside* the Lua script gives one consistent clock, eliminating cross-server skew entirely. (Keep servers on NTP too, but Redis `TIME` is the authoritative source in the script.)

### 13.5 Rate Limiting vs Throttling (again, precisely)

A frequent clarifying question. Crisp distinction:
- **Rate limiting**: hard cap; over-limit requests are **rejected** (`429`).
- **Throttling**: **slows/delays** requests to fit the allowed rate (queueing, leaky-bucket shaping) rather than rejecting them.

Both enforce a rate; the difference is the *reaction to excess* — reject vs delay. Load shedding, by contrast, is **system-health-driven** and drops traffic regardless of client identity to keep the system alive (see Part 1.4).

> **Interview tip:** The two follow-ups that most impress: **clock skew → use Redis `TIME` inside the Lua script**, and **cost-based limiting**. They're specific, correct, and rarely volunteered by mid-level candidates.

---

## Part 14: Diagramming the System

Interviews are visual. Know what to draw and in what order.

### 14.1 What to Draw

1. **Request flow** (happy path + rejected path).
2. **Component architecture** (client → edge → gateway/limiter → app → Redis cluster + config store).
3. Optionally, a **data-model sketch** (the Redis key/value shape for your chosen algorithm) and the **Lua atomicity** boundary.

Draw the flow first (it tells the story), then the architecture (it shows the pieces), then zoom into one detail (Redis data model or Lua) to demonstrate depth.

### 14.2 Request Flow

```
        ┌──────────────────────────────────────────────┐
        │                 Request arrives                │
        └───────────────────────┬────────────────────────┘
                                 ▼
                   1. Extract client identity
                      (API key / user / IP)
                                 ▼
                   2. Look up matching rule(s)
                      (from cached config)
                                 ▼
                   3. isRequestAllowed()?
                      → run Lua script on Redis
                        (atomic read-decide-write)
                                 │
                 ┌───────────────┴───────────────┐
             allowed                          denied
                 ▼                                ▼
        forward to backend               HTTP 429 + headers
        + X-RateLimit-* headers          (Retry-After, X-RateLimit-*)
```

### 14.3 Architecture Diagram

```
                              ┌──────────────────────┐
                              │   Config Store         │
                              │ (rules; pub/sub push)  │
                              └──────────┬─────────────┘
                                         │ watch/poll
   ┌────────┐   ┌──────────┐   ┌─────────▼──────────┐   ┌───────────────┐
   │ Client │──▶│ CDN/Edge │──▶│  API Gateway /      │──▶│  App Servers   │
   └────────┘   │ (DDoS,   │   │  Rate-Limit layer   │   │ (business      │
                │  coarse  │   │  - identify client  │   │  logic)        │
                │  IP)     │   │  - Lua on Redis     │   └───────┬───────┘
                └──────────┘   └─────────┬───────────┘           │
                                         │ atomic ops            ▼
                              ┌──────────▼───────────┐      backend / DB
                              │  Redis Cluster        │
                              │  (sharded by clientId │
                              │   consistent hashing, │
                              │   16384 slots,        │
                              │   master + replicas)  │
                              └──────────────────────┘
```

> **Interview tip:** Keep diagrams clean and labeled. Explicitly mark **where atomicity happens (Lua on Redis)**, **how you shard (by client id)**, and **the config path**. A well-annotated architecture diagram lets you narrate the entire design from one picture.

---

## Part 15: Interview Calibration

The same question is graded differently by level. Know what's expected of you.

### 15.1 Level Expectations

| Level | What "good" looks like |
| --- | --- |
| **Mid-level** | Explains 2–3 algorithms correctly; knows to use Redis with a shared counter; returns `429`; recognizes the multi-server problem exists. |
| **Senior** | Picks an algorithm with justification; **solves the race condition with Lua**; designs the `isRequestAllowed` interface; discusses fail-open/closed, headers, sharding; does back-of-envelope math. |
| **Staff** | Everything above, *plus* proactively raises the deep trade-offs: **local-cache/approximation for latency (Stripe)**, **eventual consistency as an enabling assumption**, **clock skew → Redis TIME**, **cost-based limiting**, **hot keys & NAT caveats**, **dynamic config propagation**, and **geo-distribution**. Frames everything as explicit trade-offs tied to NFRs. |

### 15.2 Why the Question Derails Even Strong Seniors

"Design a rate limiter" *looks* easy — everyone knows the token bucket. But it's a trap that separates candidates on the **distributed** dimension:
- Many jump straight to an algorithm and never address the **shared-state / multi-server** problem — the actual point of the question.
- Many forget the **race condition** entirely, or "solve" it with a plain transaction that still races (Part 6.3).
- Many state a fail-open/closed choice with no **trade-off reasoning**.
- Many never do the **math** that forces sharding, so they miss the single-Redis bottleneck.
- Many ignore the **client experience** (headers, `Retry-After`) and **operability** (config, monitoring).

The meta-lesson: the interviewer is not testing whether you know the token bucket. They're testing whether you can turn a deceptively simple feature into a correct, low-latency, highly-available **distributed system** — and *narrate the trade-offs* while you do it.

> **Interview tip:** Budget your time: ~5 min requirements + math, ~5 min algorithm choice, ~10 min distributed design (storage, Lua atomicity, sharding, HA), ~5 min latency/hot-keys/config, ~5 min follow-ups. Voice trade-offs constantly — that's the currency of senior/staff interviews.

### 15.3 A Worked Mock-Interview Walkthrough

Here is how a strong 40-minute answer flows. Read it as a script you can adapt.

**Interviewer:** "Design a rate limiter."

**You (scope, ~3 min):** "Let me clarify scope. I'll design a limiter that caps requests per client per time window, returns `429` with informative headers when exceeded, and lets under-limit traffic through with minimal latency. I'll assume auth happens upstream, so I already know the client identity — user ID or API key, falling back to IP for anonymous traffic. Rules should be configurable per endpoint and per tier without a redeploy. Out of scope: billing and analytics. Sound right?"

**Interviewer:** "Yes. What scale?"

**You (NFR + math, ~4 min):** "Let's assume 100M DAU, ~100 requests/user/day. That's 10B requests/day ≈ 115k RPS average, and with a 5x peak, ~575k RPS — I'll design headroom to ~1M RPS. The limiter is on every request's hot path, so I want sub-10ms overhead, ideally single-digit ms. It must be highly available — if it dies we shouldn't take the whole product down — and I'll accept eventual consistency: being off by a request or two at the edges is fine. That last assumption is important because it unlocks cheap replication and local caching later."

**Interviewer:** "Which algorithm?"

**You (algorithm, ~4 min):** "There are five standard options." (Quickly name fixed window's edge-burst flaw, sliding log's exactness-but-memory-cost, token bucket's burst-friendliness, leaky bucket's smoothing.) "For a general public API I'd ship a **sliding window counter** — it's O(1) memory per client, avoids the fixed-window boundary burst, and its tiny approximation error is acceptable given our consistency NFR. If the requirement were 'allow bursts up to N but cap the average', I'd switch to **token bucket**. If it were security-critical exactness like login attempts, I'd pay the memory for a **sliding window log**."

**Interviewer:** "How do you store state across many servers?"

**You (storage + the anti-pattern, ~4 min):** "The naive approach — per-server in-memory counters — is broken: with 10 servers each allowing 100/min, the effective limit is 1000/min. So all instances must share state. I'd use **Redis**: in-memory for microsecond ops, single-threaded so commands are atomic, native TTL so windows self-expire, and the right data structures — a couple of integer counters for the sliding window counter. I'd run the limiter at the **API Gateway**, which already knows the client identity, plus a coarse per-IP limit at the CDN edge for DDoS."

**Interviewer:** "Two requests arrive at once for a client that's at 4 of 5. Walk me through it."

**You (the race — the crux, ~5 min):** "This is the key correctness issue. If I do read-then-write, both requests read 4, both see 4 < 5, both write 5, and I've allowed two when only one slot remained — I over-admit. A plain `INCR` fixes the *simple counter* case because it's atomic, but the `EXPIRE` is a separate command and richer algorithms need read-decide-write. `MULTI/EXEC` doesn't save me if I read the value *outside* the transaction — the decision is still made on a stale read. The correct answer is a **Lua script**: Redis runs it atomically, so I read the state, apply the algorithm, mutate, and set the TTL as one indivisible step. Here's the token-bucket script..." (sketch the Lua from Part 6.5).

**Interviewer:** "Single Redis at 1M RPS?"

**You (scaling, ~4 min):** "One node caps around 100–200k ops/sec and is a single point of failure, so I shard. I shard **by client ID** so all of a client's requests hit the same node and its counter stays coherent — using **consistent hashing** (or Redis Cluster's 16384 slots) so adding a shard only remaps ~1/N of keys instead of nuking everything. At ~150k ops/node I need ~7 masters; with headroom and replicas, call it ~8–10 shards each with a replica."

**Interviewer:** "What if Redis goes down?"

**You (HA, ~3 min):** "Per-shard master + async replica with automatic failover via Sentinel or Cluster. Async replication can lose a few writes on failover, but that's fine given our eventual-consistency NFR. On total limiter failure I'd **fail open** for general read APIs — don't take the product down — but **fail closed** for security-critical endpoints like login/payments, where allowing unlimited requests is worse. I'd alert loudly on any fail-open event so we're not silently unprotected."

**Interviewer:** "Shave the latency."

**You (latency, ~3 min):** "Connection pooling and pipelining first. For a global product, put Redis regionally so a Tokyo request doesn't cross an ocean — accepting per-region limits or a split global quota. The big one is a **local in-process token bucket synced periodically with Redis** (the Stripe approach): serve most decisions from local memory in nanoseconds and reconcile in the background, accepting slight over-admission per node. That's only acceptable *because* we agreed eventual consistency is fine — it ties straight back to the NFR."

**Interviewer (follow-ups):** "GraphQL? Clock skew?"

**You:** "For GraphQL or LLM APIs, requests aren't equal — I'd compute a **cost/complexity score** and consume that many tokens instead of one; token bucket handles it natively. For clock skew across servers, I'd use **Redis's `TIME` command inside the Lua script** as the single clock source, so all decisions for a key use one consistent time regardless of app-server drift."

The throughline: every decision is justified by a requirement, and every requirement makes a later optimization legal. That coherence — not any single fact — is what earns a staff-level rating.

---

## Part 16: Cheat Sheet, Checklist, and Glossary

### 16.1 One-Page Cheat Sheet

**The one question:** *Has this client used up its allowance for the current window?* → allow (record) or deny (`429`).

**Five algorithms:**
- **Fixed window** — 1 counter; simplest; 2× edge-burst flaw. `INCR`+`EXPIRE`.
- **Sliding window log** — exact; stores every timestamp; memory-heavy. ZSET.
- **Sliding window counter** — 2 counters, weighted blend; cheap + accurate; **default**. Two `INCR`s.
- **Token bucket** — tokens drip in, allows bursts to capacity; average-rate cap. Hash {tokens,last_refill}.
- **Leaky bucket** — constant smooth output, no bursts; queue/GCRA.

**Distributed essentials:**
- Shared state in **Redis** (in-memory, atomic, TTL, structures).
- Beat the **race** with a **Lua script** (atomic read-decide-write). Plain `INCR` fixes only the simple case; `MULTI/EXEC` still races if you read outside it.
- **Shard by client id** with **consistent hashing**; Redis Cluster = **16384 slots**; single node ≈ **100–200k ops/sec**.
- **HA**: master+replica (async), **fail-open** (general) vs **fail-closed** (security), per-endpoint.
- **Latency**: connection pooling, pipelining, geo-distribution, **local cache/approx (Stripe)** leveraging eventual consistency.
- **Response**: `429` + `Retry-After` + `X-RateLimit-Limit/Remaining/Reset`.
- **Clock skew** → use Redis `TIME` inside Lua. **Cost-based** → consume `cost` tokens.
- **Config** in a store, propagated via pub/sub/watch (+poll), evaluated most-specific-first / all-must-pass.
- **Hot keys / NAT**: split legitimate hot keys, defend abusive ones at the edge; don't punish shared IPs.

### 16.2 Design Checklist

- [ ] Stated FR (limit per client, configurable rules, 429 + headers) and NFR (<10 ms, HA, scalable, eventual consistency OK).
- [ ] Did back-of-envelope math (RPS, storage) to justify sharding.
- [ ] Defined the `isRequestAllowed(clientId, ruleId)` interface.
- [ ] Chose an algorithm and *justified* it (default: sliding window counter or token bucket).
- [ ] Identified clients (user/API key/IP) and layered rules.
- [ ] Placed the limiter (edge for DDoS + API gateway with shared Redis; avoided per-server counters).
- [ ] Used a shared store (Redis) and gave reasons.
- [ ] Solved the race condition with a **Lua script** (walked the ladder to it).
- [ ] Defined the response contract (429, Retry-After, X-RateLimit-*).
- [ ] Scaled with sharding + consistent hashing + Redis Cluster; sized the cluster.
- [ ] Addressed HA (replicas, fail-open vs fail-closed per endpoint) and monitoring.
- [ ] Optimized latency (pooling, pipelining, local cache/approximation, geo).
- [ ] Handled hot keys and the NAT/shared-IP caveat.
- [ ] Made config dynamic (store + push/poll, rule schema, evaluation order).
- [ ] Prepped follow-ups (cost-based/GraphQL, IP rotation, geo, clock skew, throttling vs limiting).

### 16.3 Glossary

| Term | Definition |
| --- | --- |
| **Rate limiter** | Component that caps requests per client per window; allows or denies. |
| **Fixed window** | One counter per fixed time window; simple but bursts at edges. |
| **Sliding window log** | Stores every request timestamp; exact but memory-heavy. |
| **Sliding window counter** | Blends current + previous window counters; cheap and accurate. |
| **Token bucket** | Tokens refill at a rate; each request consumes one; allows bursts. |
| **Leaky bucket** | FIFO queue leaking at a constant rate; smooths output, no bursts. |
| **GCRA** | Generic Cell Rate Algorithm; leaky bucket via a single stored timestamp. |
| **Burst** | Short spike of traffic above the steady rate. |
| **Refill rate** | Tokens added per second in a token bucket. |
| **Consistent hashing** | Hash-ring sharding that remaps only ~1/N keys when nodes change. |
| **Hash slot** | Redis Cluster's 16384 partitions; keys map to slots via CRC16. |
| **Hot key** | A single key receiving disproportionate traffic. |
| **Lua script** | Redis server-side script executed atomically; used for read-decide-write. |
| **`INCR`** | Atomic increment in Redis; solves the simple counter race. |
| **`MULTI/EXEC`** | Redis transaction; queues commands but can't branch on reads inside. |
| **Fail-open** | Allow requests when the limiter fails (favor availability). |
| **Fail-closed** | Reject requests when the limiter fails (favor protection). |
| **429** | HTTP "Too Many Requests" status code. |
| **`Retry-After`** | Header telling the client how long to wait before retrying. |
| **`X-RateLimit-*`** | Headers reporting limit, remaining, and reset to the client. |
| **Fail-fast** | Reject over-limit requests immediately rather than queueing. |
| **Throttling** | Slow/delay requests instead of rejecting them. |
| **Load shedding** | Drop traffic when the *system* is overloaded, regardless of client. |
| **Clock skew** | Time differences between servers; solved by Redis `TIME` in Lua. |
| **Cost-based limiting** | Limit on weighted cost units (e.g. GraphQL complexity, LLM tokens). |
| **TTL** | Time-to-live; auto-expiry of a stored key. |
| **NAT** | Network Address Translation; many users can share one public IP. |
| **Eventual consistency** | Small, temporary inaccuracy is acceptable; enables cheap replication/caching. |

### 16.4 Common Pitfalls and FAQ

A rapid-fire list of the mistakes and questions that come up most often.

**Pitfall: per-server in-memory counters.** The single most common error. In any multi-server deployment the effective limit becomes `N × limit`. Always use shared state; treat in-process counters only as a deliberate local approximation layered *on top of* a shared limiter.

**Pitfall: the read-then-write race.** Reading a counter, deciding, then writing lets concurrent requests over-admit. Fix with an atomic `INCR` for the simple case or a **Lua script** for anything more complex. `MULTI/EXEC` does *not* fix it if you branch on a value read outside the transaction.

**Pitfall: forgetting the TTL.** Without `EXPIRE`, counters accumulate forever and you leak memory across billions of keys. Every key needs a TTL, ideally set atomically in the same Lua script that creates it.

**Pitfall: rate limiting by raw IP only.** NAT and shared IPs mean one address can represent thousands of users; a hard per-IP block can knock out an entire company or campus. Prefer authenticated identity; for IPv6 limit by `/64` subnet; use IP as a coarse layer, not the sole signal.

**Pitfall: choosing fail-closed everywhere.** If your limiter fails closed on all endpoints, a Redis outage takes your entire product down. Default to fail-open for general APIs; reserve fail-closed for security-critical paths.

**Pitfall: ignoring clock skew.** Different app servers passing their own `now` corrupt token-bucket and sliding-window math. Use `redis.call("TIME")` inside the Lua script as the single clock source.

**Pitfall: the fixed-window edge burst.** Fixed window allows up to `2× limit` around a boundary. If that matters, use sliding window counter (cheap) or sliding window log (exact).

**FAQ: "Where does the counter reset happen?"** You don't run a reset job. Either the key naturally belongs to a new time-window (fixed/sliding window use the window start in the key), or refill is computed lazily from elapsed time (token/leaky bucket). TTLs clean up stale keys.

**FAQ: "What's the difference between token bucket and leaky bucket again?"** Token bucket accumulates allowance while idle and *permits bursts*; leaky bucket forces a *constant, smooth output* and never bursts. Token bucket rewards quiet clients; leaky bucket enforces even spacing.

**FAQ: "Do you need strong consistency?"** Almost never. Rate limiting tolerates being off by a request or two, so eventual consistency (async replication, local caches, regional stores) is the right, cheaper choice. Say this explicitly — it justifies most of your latency and HA decisions.

**FAQ: "How do you handle a client with multiple limits (per-second and per-day)?"** Evaluate every applicable limit; a request must pass *all* of them (all-must-pass). Implement each layer with the algorithm that fits (token bucket for the burst layer, sliding window counter for the sustained layer, fixed window for the daily quota).

**FAQ: "What if two limits disagree — one allows, one denies?"** The most restrictive wins: if any applicable rule denies, the request is denied. That's what makes layered defense-in-depth safe.

---

## References

The synthesis in this guide draws on the following well-regarded sources on rate limiting and rate-limiter system design:

1. Hello Interview — Rate Limiter System Design: https://www.hellointerview.com/learn/system-design/problem-breakdowns/rate-limiter
2. DesignGurus / Arslan Ahmad — Grokking the System Design Interview (Designing an API Rate Limiter): https://www.designgurus.io/course/grokking-the-system-design-interview
3. Codesmith — Rate Limiting Algorithms and Concepts: https://www.codesmith.io/blog/understanding-rate-limiting
4. Mockingly — Rate Limiter System Design Interview Guide: https://www.mockingly.com/blog/rate-limiter-system-design
5. GeeksforGeeks — Rate Limiting Algorithms / Designing a Rate Limiter: https://www.geeksforgeeks.org/system-design/rate-limiting-algorithms-system-design/

> These sources broadly agree on the core algorithms and the distributed-systems concerns; where they differ (e.g. exact ops/sec figures or approximation error percentages), the numbers here are representative order-of-magnitude values meant for reasoning and interviews, not vendor-exact benchmarks.
