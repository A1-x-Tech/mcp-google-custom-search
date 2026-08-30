import { ConfigError, CredentialsError, loadConfig } from "./config.js";
import { GoogleCustomSearchClient } from "./client.js";

/**
 * Live READ-ONLY smoke check (opt-in: it needs real credentials in the
 * environment and burns exactly one unit of the daily quota). Runs one
 * 1-result web search — query from argv or GOOGLE_CUSTOM_SEARCH_SMOKE_QUERY,
 * defaulting to "model context protocol" — and prints a compact summary.
 * The Custom Search API is read-only, so the check creates no resources and
 * therefore needs no cleanup, on success or on failure.
 */
async function main(): Promise<void> {
  const client = new GoogleCustomSearchClient(loadConfig());
  const query = process.argv[2] ?? process.env.GOOGLE_CUSTOM_SEARCH_SMOKE_QUERY ?? "model context protocol";
  const result = await client.search({ query, num: 1 });
  console.log(
    JSON.stringify(
      {
        query: result.query,
        total_results: result.total_results,
        first_result: result.items[0] ? { title: result.items[0].title, url: result.items[0].url } : null,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  // Missing or malformed credentials are a user error, not a bug: no stack.
  const userError = err instanceof ConfigError || err instanceof CredentialsError;
  console.error("smoke failed:", userError ? err.message : err);
  process.exit(1);
});
