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

function fmtNC(iso: string): string {
  return new Date(iso).toLocaleString('fr-NC', {
    timeZone: 'Pacific/Noumea', weekday: 'long', day: '2-digit',
    month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
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
function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  const items = list.map(m => {
    const title    = `${impactLabel(m.impact)} — ${m.services.map(svcLabel).join(', ')}`;
    const desc     = escape(
      `Du ${fmtNC(m.timestamp_debut)} au ${fmtNC(m.timestamp_fin)}.\n` +
      `Communes : ${m.communes_concernees.join(', ')}.\n` +
      `Services : ${m.services.map(svcLabel).join(', ')}.\n` +
      `Source : ${SOURCE}`
    );
    return `
    <item>
      <title>${escape(title)}</title>
      <link>${BASE}/intervention/${m.id}</link>
      <guid isPermaLink="false">helia-${m.id}-${nom}</guid>
      <pubDate>${new Date(m.scraped_at).toUTCString()}</pubDate>
      <description>${desc}</description>
      <category>${escape(impactLabel(m.impact))}</category>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Helia NC — ${escape(nom)}</title>
    <link>${BASE}/commune/${encodeURIComponent(nom)}/</link>
    <atom:link href="${BASE}/commune/${encodeURIComponent(nom)}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Maintenances Helia par OPT-NC impactant ${escape(nom)}, Nouvelle-Calédonie.</description>
    <language>fr-NC</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
