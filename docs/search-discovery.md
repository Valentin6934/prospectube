# YouTube discovery policy

ProspectTube builds a targeted catalog for each normalized niche, language, sub-niche and optional keyword. Subscriber bounds are applied locally and do not change the catalog key.

## Query hierarchy

Each configured target exposes strict, format and fallback terms. A new catalog starts with the strict query. The format query runs when fewer than 20 valid channels remain. A fallback query runs only when fewer than 10 remain after two calls. Search never uses more than three `search.list` calls and never paginates or retries automatically.

Fallback queries may omit the language term. Language and subscriber bounds are still enforced locally after channel and video enrichment. Strict and nearby sub-niche matches remain separate.

## Variant yield

For each variant, the catalog JSON stores its hashed identifier, breadth, aggregate counts, last use, use count and deterministic yield:

`(strict + 0.4 * nearby + 0.1 * unique channels) * (0.5 + 0.5 * unique channel rate)`

The unique-channel factor penalizes duplicate-heavy video results. Enrichments prefer productive variants, then select a complementary breadth. An untested alternative receives a small exploration priority over a known zero-yield alternative.

## Coverage

Catalog coverage is the fraction of known catalog channels that appeared in saved search results:

`channels shown at least once / total channels known`

This global aggregate is distinct from user novelty. User novelty compares eligible catalog channels with IDs in that user's saved `Search.results`. No other user's identity or detailed history is returned.

A poor catalog, fewer than ten new prospects, or coverage of at least 80% can allow enrichment only after 12 hours. The shared lock prevents concurrent enrichment. The normal catalog TTL remains 48 hours.

## Google cost and limits

- Easy discovery: one `search.list`.
- Fewer than 20 valid results: up to two calls.
- Fewer than 10 after two calls: up to three calls.
- Cache hit: no Google call.
- `channels.list` and `videos.list` are batched by 50.

YouTube ranking can still return several videos from the same creator, so three calls do not guarantee 150 unique channels or 20 final prospects.
