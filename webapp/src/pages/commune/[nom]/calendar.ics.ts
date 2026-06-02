import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';

const BASE   = 'https://adriens.github.io/helia-etat-reseau-data';
const SOURCE = 'https://helia.nc/etat-du-reseau';

async function loadAll(): Promise<any[]> {
  const dataDir = resolve(process.cwd(), '../data/active');
  const files   = await readdir(dataDir).catch(() => [] as string[]);
  return Promise.all(files.filter(f => f.endsWith('.json')).map(async f =>
    JSON.parse(await readFile(resolve(dataDir, f), 'utf-8'))
  ));
}

function toIcalDt(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
function impactLabel(impact: string): string {
  if (impact === 'COUPURE_20_30_MIN') return 'Coupure 20–30 min';
  if (impact === 'COUPURE_30_MIN')    return 'Coupure 30 min';
  return 'Impact à déterminer';
}
function svcLabel(s: string): string {
  const MAP: Record<string, string> = {
    TELEPHONIE_FIXE:'Téléphonie fixe', TELEPHONIE_MOBILE:'Téléphonie mobile',
    INTERNET_FIXE:'Internet fixe', INTERNET_MOBILE:'Internet mobile',
    RESEAU_CUIVRE:'Réseau cuivre', FIBRE_OPTIQUE:'Fibre optique',
    LIAISONS_CELERIS_ETHERNET:'Liaisons Céléris/Ethernet',
  };
  return MAP[s] ?? s.replace(/_/g, ' ');
}
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let start = 0, first = true;
  while (start < bytes.length) {
    const limit = first ? 75 : 74;
    chunks.push((first ? '' : ' ') + new TextDecoder().decode(bytes.slice(start, start + limit)));
    start += limit; first = false;
  }
  return chunks.join('\r\n');
}

export async function getStaticPaths() {
  const all = await loadAll();
  const communes = [...new Set(all.flatMap(m => m.communes_concernees as string[]))].sort();
  return communes.map(nom => ({ params: { nom } }));
}

export async function GET({ params }: { params: { nom: string } }) {
  const { nom } = params;
  const all  = await loadAll();
  const list = all.filter(m => (m.communes_concernees as string[]).includes(nom));
  list.sort((a, b) => a.timestamp_debut.localeCompare(b.timestamp_debut));

  const now = toIcalDt(new Date().toISOString());
  const events = list.map(m => {
    const summary = `[Helia ${nom}] ${impactLabel(m.impact)} — ${m.services.map(svcLabel).join(', ')}`;
    const desc =
      `Services : ${m.services.map(svcLabel).join(', ')}\\n` +
      `Communes : ${m.communes_concernees.join(', ')}\\n` +
      `Impact : ${impactLabel(m.impact)}\\n` +
      `Source : ${SOURCE}`;
    return [
      'BEGIN:VEVENT',
      fold(`UID:helia-${m.id}@helia-etat-reseau-data`),
      fold(`DTSTAMP:${now}`),
      fold(`DTSTART:${toIcalDt(m.timestamp_debut)}`),
      fold(`DTEND:${toIcalDt(m.timestamp_fin)}`),
      fold(`SUMMARY:${summary}`),
      fold(`DESCRIPTION:${desc}`),
      fold(`URL:${BASE}/intervention/${m.id}`),
      fold(`LOCATION:${nom} — Nouvelle-Calédonie`),
      'END:VEVENT',
    ].join('\r\n');
  }).join('\r\n');

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//adriens//helia-etat-reseau-data//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold(`X-WR-CALNAME:Helia NC — ${nom}`),
    'X-WR-TIMEZONE:Pacific/Noumea',
    fold(`X-WR-CALDESC:Maintenances Helia par OPT-NC impactant ${nom}`),
    ...(events ? [events] : []),
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(cal, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
}
