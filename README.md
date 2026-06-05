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

## Base de données DuckDB

Les données peuvent être chargées dans une base DuckDB pour faciliter les analyses SQL :

```bash
uv run scripts/build_db.py
```

Cela génère un fichier `data/helia.duckdb` avec les tables suivantes :
- `maintenances` : informations principales
- `maintenance_communes` : lien entre maintenances et communes
- `maintenance_services` : lien entre maintenances et services
- `maintenance_provinces` : lien entre maintenances et provinces
- `maintenance_geopoints` : coordonnées géographiques des communes impactées (colonne `geom` de type `GEOMETRY`)

Exemple de requête spatiale (maintenances à moins de 50km de Nouméa) :

```sql
LOAD spatial;
SET geometry_always_xy = true;
SELECT 
    COUNT(DISTINCT maintenance_id) 
FROM maintenance_geopoints 
WHERE ST_Distance_Spheroid(geom, ST_Point(166.45, -22.25)) <= 50000;
```

## Tableau de bord Rill

Un projet Rill est disponible dans le dossier `rill/` pour visualiser les données de manière interactive.

Pour lancer le tableau de bord localement :
1. Installez Rill : `curl -sSf https://rilldata.com/install.sh | sh` (si pas déjà fait)
2. Lancez Rill : `cd rill && rill start`

## Tableau de bord interactif

Un tableau de bord cartographique est disponible sur GitHub Pages.

### Raccourcis clavier

| Touche | Action |
|--------|--------|
| `S` | Lancer / arrêter le tour automatique des maintenances |
| `Espace` | Pause / reprendre le tour |
| `F` | Basculer en plein écran (masque le menu latéral) |
| `Echap` | Fermer le panneau de détail / arrêter le tour |

## Scraper

Le scraper est disponible sur PyPI : [helia-etat-reseaux](https://pypi.org/project/helia-etat-reseaux/)

```bash
pip install helia-etat-reseaux
```

## Licence

[LGPL-3.0-or-later](LICENSE)
