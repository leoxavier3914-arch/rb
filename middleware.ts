import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;

  if (!user || !pass) {
    return NextResponse.next();
  }

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Basic ')) {
    return unauthorizedResponse();
  }

  const encoded = header.replace('Basic ', '');
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const [providedUser, providedPass] = decoded.split(':');

  if (providedUser !== user || providedPass !== pass) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

function unauthorizedResponse() {
  return new NextResponse('Autenticação requerida', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="RB Sigma Hub"'
    }
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
