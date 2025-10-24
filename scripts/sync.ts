const baseUrl = process.env.SYNC_BASE_URL ?? "http://localhost:3000";

async function triggerSync(full: boolean, from?: string, to?: string) {
  const url = new URL("/api/kfy/sync", baseUrl);
  if (full) {
    url.searchParams.set("full", "true");
  } else if (from && to) {
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-admin-role": "true",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sync falhou: ${response.status} ${text}`);
  }

  const body = await response.json();
  console.log("Resumo:", body.summary);
}

const args = process.argv.slice(2);
const full = args.includes("--full");
const fromArg = args.find((arg) => arg.startsWith("--from="))?.split("=")[1];
const toArg = args.find((arg) => arg.startsWith("--to="))?.split("=")[1];

triggerSync(full, fromArg, toArg).catch((error) => {
  console.error(error);
  process.exit(1);
});
