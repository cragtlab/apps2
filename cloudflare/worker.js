export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'GET') {
      const targetUrl = url.searchParams.get('url');
      const scrape = url.searchParams.get('scrape') === 'true';
      if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }
      return await fetchAndProxy(targetUrl, scrape);
    }

    if (request.method === 'POST') {
      try {
        const { urls, scrape } = await request.json();
        if (!Array.isArray(urls)) {
          return new Response('Invalid urls array', { status: 400 });
        }

        const results = await Promise.all(
          urls.map(async (u) => {
            try {
              const response = await fetchWithTimeout(u);
              const contentType = response.headers.get('Content-Type') || '';
              let text = await response.text();

              if (scrape || contentType.includes('text/html')) {
                const links = extractLinks(text, u);
                return { url: u, status: response.status, body: JSON.stringify(links), isJSON: true };
              }

              return { url: u, status: response.status, body: text };
            } catch (err) {
              return { url: u, status: 500, error: err.message };
            }
          })
        );

        return new Response(JSON.stringify(results), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (err) {
        return new Response('Invalid JSON body', { status: 400 });
      }
    }

    return new Response('Method not allowed', { status: 405 });
  },
};

function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gis;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();

    if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
      try {
        href = new URL(href, baseUrl).href;
        links.push({ title: text || href, link: href });
      } catch (e) {}
    }
  }
  return links;
}

async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function fetchAndProxy(url, scrape) {
  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get('Content-Type') || '';
    const text = await response.text();

    if (scrape || contentType.includes('text/html')) {
      const links = extractLinks(text, url);
      return new Response(JSON.stringify(links), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(text, {
      headers: {
        'Content-Type': contentType || 'application/xml',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('Failed to fetch: ' + err.message, {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}
