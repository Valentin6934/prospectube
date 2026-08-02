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

- one `search.list` request (100 YouTube quota units / one Search Query metric);
- one `channels.list` request per batch of up to 50 unique channel IDs (1 unit each);
- no `videos.list` request in the product flow;
- up to one public `/about` HTML fetch per candidate needing contact enrichment. These HTML requests
  do not consume YouTube Data API units but remain network requests.

There is no automatic retry or pagination. A zero-result search stops after `search.list`. Client
reloads do not automatically trigger searches.

## Shared cache and product limits

Search results are cached in PostgreSQL/Neon for 48 hours. The canonical key includes the algorithm
version, normalized niche and language, and normalized subscriber bounds. Cache entries contain only
public channel result data and are shared between users.

- Free: one successful product search for the lifetime of the account.
- Pro: five successful product searches per UTC day.
- A cache hit consumes one product search but no Google API quota.
- A Google/configuration failure releases the pending product quota reservation.
- Existing free accounts with at least one Search history row are considered to have used their free search.

`SearchUsage` reserves quota atomically and `SearchLock` prevents concurrent searches for one user or
one cache key across Vercel instances. Expired locks are cleaned before acquisition.
