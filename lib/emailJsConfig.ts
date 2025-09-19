type EmailJsConfig = {
  serviceId: string;
  templateId: string;
  publicKey: string;
};

function ensureEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return undefined;
}

function getFirstAvailable(name: string, fallbacks: string[]): string {
  const candidates = [name, ...fallbacks];
  for (const candidate of candidates) {
    const value = ensureEnv(candidate);
    if (value) {
      return value;
    }
  }

  throw new Error(`Variável de ambiente ${candidates.join(' / ')} não configurada.`);
}

export function getEmailJsConfig(): EmailJsConfig {
  return {
    serviceId: getFirstAvailable('EMAILJS_SERVICE_ID', ['NEXT_PUBLIC_EMAILJS_SERVICE_ID']),
    templateId: getFirstAvailable('EMAILJS_TEMPLATE_ID', ['NEXT_PUBLIC_EMAILJS_TEMPLATE_ID']),
    publicKey: getFirstAvailable('EMAILJS_PUBLIC_KEY', ['NEXT_PUBLIC_EMAILJS_PUBLIC_KEY']),
  };
}
