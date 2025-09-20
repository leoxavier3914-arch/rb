'use client';

function normalizePgTimestamp(value?: string | null): string | null {
  if (!value) return null;
  let s = String(value).trim();

  // "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS"
  s = s.replace(' ', 'T');

  // micros → millis (3 dígitos)
  s = s.replace(/(\.\d{3})\d+/, '$1');

  // Normaliza timezone final: +HH, +HHMM, +HH:MM, Z, ou vazio
  const tzMatch = s.match(/([+\-]\d{2})(?::?(\d{2}))?$/);
  if (tzMatch) {
    const sign = tzMatch[1][0];
    const hh = tzMatch[1].slice(1);
    const mm = tzMatch[2] ?? '00';
    if (hh === '00' && mm === '00') {
      s = s.replace(/([+\-]\d{2})(?::?(\d{2}))?$/, 'Z'); // +00 / +0000 / +00:00 → Z
    } else {
      s = s.replace(/([+\-]\d{2})(?::?(\d{2}))?$/, `${sign}${hh}:${mm}`); // força +HH:MM
    }
  } else if (!/[Zz]$/.test(s)) {
    s += 'Z'; // sem offset → assume UTC
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function LocalTime({ value }: { value?: string | null }) {
  const iso = normalizePgTimestamp(value);
  if (!iso) return <>—</>;

  const d = new Date(iso);
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d); // usa fuso do dispositivo

  return <time dateTime={iso}>{formatted}</time>;
}
