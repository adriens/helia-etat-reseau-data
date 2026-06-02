# helia-etat-reseau-data

Données scrapées des maintenances programmées publiées sur [helia.nc/etat-du-reseau](https://helia.nc/etat-du-reseau) (OPT-NC).

Mis à jour automatiquement **toutes les heures** via GitHub Actions.

## Structure

```
data/
  active/           # maintenances actuellement visibles sur le site
    <id>.json
  archive/
    2026/           # maintenances disparues du site, classées par année de début
      <id>.json
```

Chaque fichier est nommé par l'identifiant stable de la maintenance (`id` SHA256 tronqué à 8 caractères), calculé à partir de la date de début, date de fin, services et communes concernées.

## Format JSON

```json
{
  "id": "a6cec665",
  "scraped_at": "2026-06-02T07:00:00Z",
  "source_url": "https://helia.nc/etat-du-reseau",
  "timestamp_debut": "2026-06-02T23:00:00+11:00",
  "timestamp_fin": "2026-06-03T05:00:00+11:00",
  "duree_fenetre_minutes": 360,
  "duree_coupure_min_minutes": 20,
  "duree_coupure_max_minutes": 30,
  "communes_concernees": ["HOUAILOU", "POINDIMIE"],
  "services": ["TELEPHONIE_FIXE", "INTERNET_FIXE"],
  "impact": "COUPURE_20_30_MIN",
  "nb_communes_concernees": 2,
  "est_toute_nc": false,
  "provinces_concernees": ["PROVINCE_NORD"]
}
```

## Scraper

Le scraper est disponible sur PyPI : [helia-etat-reseaux](https://pypi.org/project/helia-etat-reseaux/)

```bash
pip install helia-etat-reseaux
```

## Licence

[LGPL-3.0-or-later](LICENSE)
