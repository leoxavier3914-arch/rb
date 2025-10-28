import { describe, expect, it } from 'vitest';
import { resolveApiUrl, resolveTokenUrl } from '@/lib/kiwify/baseUrl';

describe('resolveApiUrl', () => {
  it('usa base padrão quando não informado', () => {
    expect(resolveApiUrl(undefined, '/sales')).toBe('https://public-api.kiwify.com/v1/sales');
  });

  it('aplica versão quando base não possui sufixo', () => {
    expect(resolveApiUrl('https://public-api.kiwify.com', '/sales')).toBe('https://public-api.kiwify.com/v1/sales');
  });

  it('não duplica versão quando base já possui', () => {
    expect(resolveApiUrl('https://public-api.kiwify.com/v1/', '/sales')).toBe('https://public-api.kiwify.com/v1/sales');
  });

  it('mantém caminhos que já iniciam com versão', () => {
    expect(resolveApiUrl('https://public-api.kiwify.com', '/v1/sales')).toBe('https://public-api.kiwify.com/v1/sales');
  });

  it('remove versão duplicada quando caminho e base combinam', () => {
    expect(resolveApiUrl('https://public-api.kiwify.com/v1', '/v1/sales')).toBe('https://public-api.kiwify.com/v1/sales');
  });
});

describe('resolveTokenUrl', () => {
  it('usa rota oficial documentada', () => {
    expect(resolveTokenUrl('https://public-api.kiwify.com')).toBe('https://public-api.kiwify.com/v1/oauth/token');
  });
});
