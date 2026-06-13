# Gym occupancy API contract

The scraper depends on an **undocumented third-party endpoint** on the Sputnik
Climbing site (powered by Deporsite). This file records what we know, so it can
be diagnosed and repaired when it changes. There is no official spec — everything
here was reverse-engineered. The authoritative implementation is
`src/index.ts` (request flow) and `src/transform.ts` (response mapping).

## Why this is fragile

- No auth login, but requires a **CSRF token + session cookie** scraped fresh
  from the public gym page on every run.
- **Datacenter IPs are blocked.** GitHub Actions, AWS, and Claude workers all get
  blocked by the origin. The scraper runs from a residential connection (a
  Raspberry Pi). If requests suddenly start failing from a new host, suspect IP
  blocking first.
- Spanish field names that we map to English on ingest — a server-side rename
  would silently break the mapping.

## Request flow (two steps)

### 1. Fetch CSRF token + cookie

```
GET https://sputnikclimbing.deporsite.net/aforo-guindalera
```

Sent with browser-like headers (`User-Agent`, `Accept`, `Accept-Language`, etc.
— see `BROWSER_HEADERS` in `src/index.ts`; these matter for not being blocked).

From the response:
- **CSRF token** — parsed from the HTML meta tag: `csrf-token" content="([^"]+)"`.
- **Session cookie** — collected from `Set-Cookie` headers, reduced to
  `name=value` pairs joined by `; `.

### 2. Fetch occupancy

```
POST https://sputnikclimbing.deporsite.net/ajax/TInnova_v2/Listado_OcupacionAforo/llamadaAjax/obtenerOcupacion
```

Required headers (beyond the browser set):

| Header              | Value                                    |
| ------------------- | ---------------------------------------- |
| `Content-Type`      | `application/x-www-form-urlencoded`      |
| `X-CSRF-TOKEN`      | token from step 1                        |
| `X-Requested-With`  | `XMLHttpRequest`                         |
| `Referer`           | the gym page URL                         |
| `Cookie`            | cookie from step 1                       |
| `Sec-Fetch-Site`    | `same-origin`                            |

No request body is sent — the endpoint returns occupancy for **all venues** at once.

## Response shape

A JSON array. Each element (`ApiVenue`) → mapped to a `Reading`:

| API field (Spanish) | Type   | → DB column   | Meaning                          |
| ------------------- | ------ | ------------- | -------------------------------- |
| `IdRecinto`         | number | `venue_id`    | Stable venue identifier          |
| `Recinto`           | string | `venue_name`  | Venue display name               |
| `Ocupacion`         | number | `occupancy`   | Current head count               |
| `Entradas`          | number | `entries`     | Cumulative entries today         |
| `Salidas`           | number | `exits`       | Cumulative exits today           |
| `Aforo`             | number | `capacity`    | Max capacity                     |

Mapping rules (`toReadings()` in `src/transform.ts`):
- Venues with `Aforo <= 0` are **filtered out** (not real climbing venues).
- A fresh UUID v4 (`id`) is generated per venue per reading.
- The same ISO-8601 UTC `timestamp` is stamped on every row in a batch.

Expect roughly **6–7 venues** per response (e.g. Alcobendas, Las Rozas, Berango,
Legazpi, Chamberí, Guindalera). `entries`/`exits` are cumulative daily counters
that reset each day — derive deltas in queries, don't assume monotonic growth
across day boundaries.

## When it breaks — checklist

1. **HTTP 403 / blocked** → likely IP blocking. Confirm the scraper is on the Pi /
   residential IP, not a datacenter.
2. **"CSRF token not found in page"** → the meta-tag format changed; update the
   regex in `fetchCsrfToken()`.
3. **Occupancy API returns non-200** → cookie/CSRF handshake changed, or the
   endpoint path moved. Re-inspect the page's network calls in a browser.
4. **Rows inserted but fields are null/garbage** → the Spanish field names were
   renamed server-side; update the `ApiVenue` interface and `toReadings()`, and
   the test in `__tests__/transform.test.ts`.
