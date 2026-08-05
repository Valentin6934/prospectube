# YouTube search operations

## Configuration diagnostic

Run `npm run youtube:check` in the environment whose `YOUTUBE_API_KEY` must be checked.
The command uses one low-cost `videos.list` request and never prints the key or a URL containing it.
Variables already present in the process take priority over local env files.

On a Google error, compare `consumerProjectNumber` with the numeric project identifier shown in
Google Cloud Console under **IAM & Admin > Settings**. Google normally does not return the project
identity for a successful API-key request. In that case, verify the key from **APIs & Services >
Credentials** in the expected project, without copying or logging its value.

An optional `YOUTUBE_EXPECTED_PROJECT_NUMBER` can be configured in Preview. When Google exposes a
consumer number in an error, ProspectTube reports a safe server-side `YOUTUBE_PROJECT_MISMATCH` if
it differs. This variable contains a project number, not a secret.

Server-side YouTube API keys must not use HTTP referrer restrictions. Use an API restriction limited
to YouTube Data API v3. IP restrictions are generally unsuitable for dynamic Vercel egress IPs.

## Request cost

For one uncached product search, ProspectTube performs:

- one `search.list` request of type `video`, followed by at most one deterministic variant when
  fewer than 10 subscriber-range candidates are available (100 units per request);
- one `channels.list` request per batch of up to 50 unique channel IDs;
- one `videos.list` request per batch of up to 50 discovered video IDs;
- no per-channel network request, transcription, comment crawl or unbounded pagination.

There is no automatic retry or pagination. A zero-result search stops after the second bounded
variant at the latest and releases the product quota reservation. Client reloads do not automatically
trigger searches.

## Shared cache and product limits

Discovery catalogs V6 are cached in PostgreSQL/Neon for 48 hours. The canonical key includes the
algorithm version, normalized niche, language, selected sub-niches and custom keyword. Subscriber
bounds and advanced filters are applied locally and do not change the discovery key.

- Free: three successful product searches for the lifetime of the account.
- Pro: five successful product searches per UTC day.
- A cache hit consumes one product search but no Google API quota.
- A Google/configuration failure releases the pending product quota reservation.
- Existing free accounts use the greater successful count represented by Search history or SearchUsage,
  capped at three, so failed and empty attempts do not consume quota.

`SearchUsage` reserves quota atomically and `SearchLock` prevents concurrent searches for one user or
one cache key across Vercel instances. Expired locks are cleaned before acquisition.
