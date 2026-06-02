import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';

const BASE = 'https://adriens.github.io/helia-etat-reseau-data';
const SOURCE = 'https://helia.nc/etat-du-reseau';

function fmtNC(iso: string): string {
  return new Date(iso).toLocaleString('fr-NC', {
    timeZone: 'Pacific/Noumea',
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function impactLabel(impact: string): string {
  if (impact === 'COUPURE_20_30_MIN') return 'Coupure 20–30 min';
  if (impact === 'COUPURE_30_MIN')    return 'Coupure 30 min';
  return 'Impact à déterminer';
}

function svcLabel(s: string): string {
  const MAP: Record<string, string> = {
    TELEPHONIE_FIXE:           'Téléphonie fixe',
    TELEPHONIE_MOBILE:         'Téléphonie mobile',
    INTERNET_FIXE:             'Internet fixe',
    INTERNET_MOBILE:           'Internet mobile',
    RESEAU_CUIVRE:             'Réseau cuivre',
    FIBRE_OPTIQUE:             'Fibre optique',
    LIAISONS_CELERIS_ETHERNET: 'Liaisons Céléris/Ethernet',
  };
  return MAP[s] ?? s.replace(/_/g, ' ');
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET() {
  const dataDir = resolve(process.cwd(), '../data/active');
  const files   = await readdir(dataDir).catch(() => [] as string[]);
  const maintenances: any[] = await Promise.all(
    files
      .filter(f => f.endsWith('.json'))
      .map(async f => JSON.parse(await readFile(resolve(dataDir, f), 'utf-8')))
  );
  maintenances.sort((a, b) => a.timestamp_debut.localeCompare(b.timestamp_debut));

  const items = maintenances.map(m => {
    const communes   = m.est_toute_nc ? ['Toute la Nouvelle-Calédonie'] : m.communes_concernees;
    const title      = `${impactLabel(m.impact)} — ${communes.slice(0, 3).join(', ')}${communes.length > 3 ? ` +${communes.length - 3}` : ''}`;
    const debut      = fmtNC(m.timestamp_debut);
    const fin        = fmtNC(m.timestamp_fin);
    const services   = m.services.map(svcLabel).join(', ');
    const provinces  = m.provinces_concernees.join(', ');
    const pubDate    = new Date(m.scraped_at).toUTCString();
    const link       = `${BASE}/#${m.id}`;

    const description = escape(
      `Du ${debut} au ${fin}.\n` +
      `Communes : ${communes.join(', ')}.\n` +
      `Services impactés : ${services}.\n` +
      `Provinces : ${provinces}.\n` +
      `Impact : ${impactLabel(m.impact)}.\n` +
      `Source : ${SOURCE}`
    );

    return `
    <item>
      <title>${escape(title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">helia-maintenance-${m.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <category>${escape(impactLabel(m.impact))}</category>
      ${m.provinces_concernees.map((p: string) => `<category>${escape(p)}</category>`).join('\n      ')}
    </item>`;
  }).join('\n');

  const builtAt = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Helia NC — Maintenances réseau</title>
    <link>${BASE}/</link>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml"/>
    <description>Maintenances programmées sur le réseau Helia by OPT-NC en Nouvelle-Calédonie.</description>
    <language>fr-NC</language>
    <lastBuildDate>${builtAt}</lastBuildDate>
    <ttl>60</ttl>
    <image>
      <url>${BASE}/favicon.svg</url>
      <title>Helia NC</title>
      <link>${BASE}/</link>
    </image>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
