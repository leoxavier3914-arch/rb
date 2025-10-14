type EmailJsConfig = {
  serviceId: string;
  templateId: string;
  publicKey: string;
};

export class EmailJsApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`EmailJS request failed with status ${status}`);
    this.name = 'EmailJsApiError';
    this.status = status;
    this.body = body;
  }
}

export const EMAILJS_ENDPOINT = 'https://api.emailjs.com/api/v1.0/email/send';

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

type EmailJsTemplateParams = Record<string, string | null>;

export async function sendEmailJsTemplate(params: {
  serviceId: string;
  templateId: string;
  publicKey: string;
  templateParams: EmailJsTemplateParams;
}): Promise<void> {
  const { serviceId, templateId, publicKey, templateParams } = params;

  const response = await fetch(EMAILJS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: templateParams,
    }),
  });

  if (!response.ok) {
    let message = '';
    try {
      message = await response.text();
    } catch {
      message = '';
    }
    throw new EmailJsApiError(response.status, message);
  }
}
