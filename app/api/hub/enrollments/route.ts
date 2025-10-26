import { NextResponse, type NextRequest } from 'next/server';
import { assertIsAdmin } from '@/lib/auth';
import { parsePagination } from '@/lib/hub/filters';
import { getServiceClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  assertIsAdmin(request);

  const params = request.nextUrl.searchParams;
  const pagination = parsePagination(params, 20);
  const status = params.get('status');
  const courseId = params.get('course_id');
  const customerId = params.get('customer_id');

  try {
    const client = getServiceClient();
    let builder = client
      .from('kfy_enrollments')
      .select('id, customer_id, course_id, status, progress, created_at, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (status) {
      builder = builder.eq('status', status);
    }

    if (courseId) {
      builder = builder.eq('course_id', courseId);
    }

    if (customerId) {
      builder = builder.eq('customer_id', customerId);
    }

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;
    const { data, error, count } = await builder.range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      page: pagination.page,
      page_size: pagination.pageSize,
      total: count ?? (data?.length ?? 0),
      items: data ?? []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao listar matrículas.';
    return NextResponse.json({ ok: false, code: 'enrollments_failed', error: message }, { status: 500 });
  }
}
