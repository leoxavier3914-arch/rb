import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';

const TABLE_NAME = 'email_integration_settings';
const ROW_ID = 'default';

type EmailSettingsRow = {
  automatic_email_enabled: boolean | null;
  manual_email_enabled: boolean | null;
  smart_delay_enabled: boolean | null;
};

const DEFAULT_SETTINGS = {
  automaticEmailEnabled: true,
  manualEmailEnabled: true,
  smartDelayEnabled: false,
};

const mapRowToPayload = (row: EmailSettingsRow | null) => ({
  automaticEmailEnabled: row?.automatic_email_enabled ?? DEFAULT_SETTINGS.automaticEmailEnabled,
  manualEmailEnabled: row?.manual_email_enabled ?? DEFAULT_SETTINGS.manualEmailEnabled,
  smartDelayEnabled: row?.smart_delay_enabled ?? DEFAULT_SETTINGS.smartDelayEnabled,
});

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('automatic_email_enabled, manual_email_enabled, smart_delay_enabled')
      .eq('id', ROW_ID)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[email-settings] erro ao buscar configuração remota', error);
      return NextResponse.json({ error: 'failed_to_load_settings' }, { status: 500 });
    }

    if (!data) {
      const { error: insertError } = await supabase.from(TABLE_NAME).upsert({ id: ROW_ID });
      if (insertError) {
        console.warn('[email-settings] erro ao inicializar configuração remota', insertError);
        return NextResponse.json({ error: 'failed_to_load_settings' }, { status: 500 });
      }
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json(mapRowToPayload(data));
  } catch (error) {
    console.error('[email-settings] falha inesperada ao carregar', error);
    return NextResponse.json({ error: 'failed_to_load_settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: Partial<{
    automaticEmailEnabled: unknown;
    manualEmailEnabled: unknown;
    smartDelayEnabled: unknown;
  }> = {};

  try {
    payload = (await request.json()) as typeof payload;
  } catch (error) {
    console.warn('[email-settings] payload inválido', error);
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const normalizeBoolean = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback;

  const normalized = {
    automaticEmailEnabled: normalizeBoolean(payload.automaticEmailEnabled, DEFAULT_SETTINGS.automaticEmailEnabled),
    manualEmailEnabled: normalizeBoolean(payload.manualEmailEnabled, DEFAULT_SETTINGS.manualEmailEnabled),
    smartDelayEnabled: normalizeBoolean(payload.smartDelayEnabled, DEFAULT_SETTINGS.smartDelayEnabled),
  };

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from(TABLE_NAME).upsert({
      id: ROW_ID,
      automatic_email_enabled: normalized.automaticEmailEnabled,
      manual_email_enabled: normalized.manualEmailEnabled,
      smart_delay_enabled: normalized.smartDelayEnabled,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[email-settings] erro ao salvar configuração', error);
      return NextResponse.json({ error: 'failed_to_save_settings' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings: normalized });
  } catch (error) {
    console.error('[email-settings] falha inesperada ao salvar', error);
    return NextResponse.json({ error: 'failed_to_save_settings' }, { status: 500 });
  }
}
