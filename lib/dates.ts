// lib/dates.ts

/* ========= Normalização UTC do timestamp do Postgres =========
   Aceita:
   - "YYYY-MM-DD HH:MM:SS.mmmmmm+00"
   - "YYYY-MM-DD HH:MM:SS.mmm+0000"
   - "YYYY-MM-DD HH:MM:SS.mmm+00:00"
   - "YYYY-MM-DD HH:MM:SSZ"
   - sem offset → assume UTC
*/
export function parsePgTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  let s = String(value).trim();

  // 1) ISO-like
  s = s.replace(' ', 'T');

  // 2) micros → millis (3 dígitos)
  s = s.replace(/(\.\d{3})\d+/, '$1');

  // 3) normaliza timezone final
  const tz = s.match(/([+\-]\d{2})(?::?(\d{2}))?$/);
  if (tz) {
    const sign = tz[1][0];
    const hh = tz[1].slice(1);
    const mm = tz[2] ?? '00';
    if (hh === '00' && mm === '00') {
      s = s.replace(/([+\-]\d{2})(?::?(\d{2}))?$/, 'Z'); // +00 / +0000 / +00:00 → Z
    } else {
      s = s.replace(/([+\-]\d{2})(?::?(\d{2}))?$/, `${sign}${hh}:${mm}`); // força +HH:MM
    }
  } else if (!/[Zz]$/.test(s)) {
    s += 'Z'; // sem offset → assume UTC
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Formata SEMPRE no fuso de São Paulo (consistente p/ todos os devices)
export function formatSaoPaulo(value: string | null) {
  const d = parsePgTimestamp(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}
