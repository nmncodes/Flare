export const dynamic = 'force-dynamic';

const checks = [
  {
    id: 'f1db',
    name: 'F1DB snapshot',
    url: 'https://api.github.com/repos/f1db/f1db/releases/latest',
    headers: { 'User-Agent': 'flare-f1-compare' }
  },
  {
    id: 'jolpica',
    name: 'Jolpica F1',
    url: 'https://api.jolpi.ca/ergast/f1/drivers/hamilton/results.json?limit=1'
  },
  {
    id: 'openf1',
    name: 'OpenF1',
    url: 'https://api.openf1.org/v1/sessions?year=2023&meeting_key=1140'
  }
];

async function checkSource(source) {
  try {
    const response = await fetch(source.url, {
      headers: source.headers,
      signal: AbortSignal.timeout(5000),
      cache: 'no-store'
    });
    return { id: source.id, name: source.name, available: response.ok };
  } catch {
    // The comparison itself remains usable from its local, versioned snapshot
    // when an upstream free provider is temporarily unavailable.
    return { id: source.id, name: source.name, available: false };
  }
}

export async function GET() {
  const sources = await Promise.all(checks.map(checkSource));
  return Response.json({
    sources,
    checkedAt: new Date().toISOString()
  });
}
