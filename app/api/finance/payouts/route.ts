import { handleCreatePayoutRequest } from './handler';

export const dynamic = 'force-dynamic';

export function POST(request: Request) {
  return handleCreatePayoutRequest(request);
}
