export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COURT_WARMUP_URL =
  'https://www.courtauction.go.kr/pgj/index.on?w2xPath=/pgj/ui/pgj100/PGJ151F00.xml&pgjId=151F00';

export async function GET(): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(COURT_WARMUP_URL, {
      redirect: 'manual',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    return Response.json({
      ok: response.ok,
      status: response.status,
      redirected: response.redirected,
      location: response.headers.get('location'),
      contentType: response.headers.get('content-type'),
    });
  } catch (error) {
    const err = error as Error & { cause?: { code?: string; message?: string } };
    return Response.json(
      {
        ok: false,
        error: err.name,
        message: err.message,
        causeCode: err.cause?.code ?? null,
        causeMessage: err.cause?.message ?? null,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
