# VoiceCue: pitch deck (10 slides)

## Slide 1. Title
**VoiceCue**
Ads players actually want, shown only with their consent.
Contextual, on-device, in-world advertising for open-world games.

## Slide 2. The problem
- Players ignore or block in-game ads because they are random and intrusive.
- Studios leave revenue on the table: free-to-play monetisation depends on irrelevant banners.
- Brands pay for reach in games but cannot measure intent.
- Result: low CPMs, bad player experience, no trust.

## Slide 3. The insight
- Open-world games are full of intent signals: players talk, plan and ask for things.
- Reading that intent could double ad relevance, but secretly listening is unacceptable, legally and ethically.
- The winning product is the one players switch on themselves.

## Slide 4. The solution
VoiceCue is a B2B SDK and marketplace.
- Player opts in (off by default, 18+).
- Speech is turned into a coarse interest tag on the device. Audio and text never leave it.
- A matching sponsored poster appears in the game world a few minutes later, clearly labelled.
- The player gets a reward and full control.

## Slide 5. How it works (demo flow)
1. Player toggles "Smart suggestions" on. A mic indicator is always visible.
2. Player says "I'm starving, I want pizza".
3. On the device this becomes `food.fast_food`. No words are sent.
4. The auction picks the best approved campaign.
5. Minutes later a "Sponsored" poster appears on a wall, with a coupon.
6. "Why am I seeing this?" and "Delete my data" are one tap away.

## Slide 6. Trust and safety by design
- On-device processing, no raw audio or transcripts on servers.
- Only the player's own mic, never other players.
- Sensitive categories hard-blocked: health, politics, religion, sexuality, gambling, alcohol, finance, minors.
- Interest signals expire in 10 minutes. Frequency caps apply.
- Three-layer moderation: automatic rules, AI classifier, human review. The studio has the final say.
- Partners see aggregates only (k-anonymity, k >= 50).

## Slide 7. Architecture
Game SDK (Unity/Unreal) -> On-device intent extractor -> Privacy gateway (consent, TTL, blocked categories) -> Ad decision engine (match, second-price auction, caps, delay) -> Slot renderer in game.
Side services: Creative and slot service, Moderation pipeline, Partner dashboard, Studio console, Analytics and billing.

## Slide 8. Business model
- Marketplace take rate: 30% of ad spend; the studio keeps 70%.
- Studio SaaS tiers: Indie free (up to 100k MAU), Studio $2k/month, Enterprise custom (SLA, private moderation).
- Brands pay CPM for awareness, CPA for coupon redemptions, and a premium for verified-safe placements.
- A share of spend funds player rewards, which lifts opt-in.
- Key KPI: opt-in rate. Target 25% of active players.
- Illustrative economics: 1M MAU x 25% opt-in x 10 impressions per day x $8 CPM = about $20k/day gross; the platform earns about $6k/day.

## Slide 9. Market and go-to-market
- Market: in-game advertising is a multi-billion-dollar segment growing at double digits.
- Competitors (Anzu, Bidstack, Playwire and similar) place static or programmatic ads without player-consented intent.
- Our edge: privacy-first intent data, studio-controlled moderation, player rewards.
- Go-to-market: pilots with indie open-world and sandbox studios, then mid-size studios, then publishers. Brand partners come from food delivery, retail and entertainment.

## Slide 10. Roadmap and ask
- Now: working prototype (consent, intent, auction, moderation, partner dashboard).
- 3 months: Unity SDK, on-device speech model, 2 pilot studios.
- 9 months: brand self-serve, compliance review (GDPR, COPPA, CCPA), Unreal SDK.
- Ask: pilot studios and seed funding.
- Close: "Relevant ads, earned by trust."
