# VoiceCue architecture

## Data flow
```
Player mic -> [Game SDK: on-device intent extractor] -> {category, confidence, anon session}
          -> Privacy Gateway (consent, age gate, blocked categories, TTL 10 min)
          -> Ad Decision Engine (category match, second-price auction, frequency cap, delay)
          -> Slot Renderer in game (poster/billboard/sign, labelled "Sponsored")
```

## Components
| Component | Role |
|---|---|
| Game SDK | Consent UI, mic indicator, on-device speech-to-intent, slot rendering |
| Privacy Gateway | Accepts only signed coarse tags; drops anything sensitive or unconsented; enforces TTL |
| Ad Decision Engine | Match by category, second-price auction, budget and frequency caps, delivery delay |
| Creative and Slot service | Studio defines slot sizes; partners upload creatives that must match exactly |
| Moderation | Layer 1 rules, layer 2 AI classifier hook, layer 3 human review queue (studio) |
| Partner Dashboard | Slot specs, uploads, bids, budgets, aggregate reports |
| Studio Console | Blocked categories, strictness, review queue, revenue share |
| Analytics and Billing | Impressions, clicks, spend, payouts; k-anonymity on all breakdowns |

## Privacy guarantees
- Raw audio and transcripts never leave the device.
- Server stores only category, confidence and timestamp per anonymous session, for at most the TTL.
- Players can see why an ad was shown and delete their profile.
- Partners receive aggregates only.

## Scaling notes
Stateless decision engine behind a load balancer, Redis for signal TTL and frequency caps, Postgres for campaigns and creatives, object storage and CDN for creatives, async queue for moderation.
