import duckdb
import json
from pathlib import Path

def build_db(data_dir: Path, db_path: Path):
    # Connect to DuckDB
    con = duckdb.connect(str(db_path))

    # Install and load spatial extension
    con.execute("INSTALL spatial;")
    con.execute("LOAD spatial;")
    con.execute("SET geometry_always_xy = true;")

    # Clean up existing tables if any
    con.execute("DROP TABLE IF EXISTS maintenance_geopoints")
    con.execute("DROP TABLE IF EXISTS maintenance_provinces")
    con.execute("DROP TABLE IF EXISTS maintenance_services")
    con.execute("DROP TABLE IF EXISTS maintenance_communes")
    con.execute("DROP TABLE IF EXISTS maintenances")

    # List all JSON files
    json_files = list(data_dir.glob("active/*.json")) + list(data_dir.glob("archive/**/*.json"))
    
    if not json_files:
        print("No JSON files found.")
        return

    # Load all JSONs into a temporary table to use DuckDB's JSON capabilities
    # We use a list of paths for read_json_auto
    paths = [str(f) for f in json_files]
    
    # Create the main table with schema and check constraint
    con.execute("""
        CREATE TABLE maintenances (
            id VARCHAR,
            scraped_at TIMESTAMP,
            source_url VARCHAR,
            timestamp_debut TIMESTAMP,
            timestamp_fin TIMESTAMP,
            duree_fenetre_minutes INTEGER,
            duree_coupure_min_minutes INTEGER,
            duree_coupure_max_minutes INTEGER,
            impact VARCHAR,
            nb_communes_concernees INTEGER,
            est_toute_nc BOOLEAN,
            scraped_at_local TIMESTAMP,
            centroide_lat DOUBLE,
            centroide_lon DOUBLE,
            geom GEOMETRY,
            est_active BOOLEAN,
            statut VARCHAR CHECK (statut IN ('ACTIVE', 'ARCHIVE')),
            periode_jour_nuit VARCHAR,
            jour_semaine VARCHAR,
            mois VARCHAR
        )
    """)

    con.execute(f"""
        INSERT INTO maintenances 
        SELECT 
            id,
            scraped_at::TIMESTAMP as scraped_at,
            source_url,
            timestamp_debut::TIMESTAMP as timestamp_debut,
            timestamp_fin::TIMESTAMP as timestamp_fin,
            duree_fenetre_minutes,
            duree_coupure_min_minutes,
            duree_coupure_max_minutes,
            impact,
            nb_communes_concernees,
            est_toute_nc,
            scraped_at_local::TIMESTAMP as scraped_at_local,
            centroide.lat as centroide_lat,
            centroide.lon as centroide_lon,
            ST_Point(centroide.lon, centroide.lat) as geom,
            -- Status active/archive
            contains(filename, '/active/') as est_active,
            CASE 
                WHEN contains(filename, '/active/') THEN 'ACTIVE'
                ELSE 'ARCHIVE'
            END as statut,
            -- Champs calculés pour faciliter les analyses
            CASE 
                WHEN hour(timestamp_debut::TIMESTAMP) BETWEEN 6 AND 18 THEN 'JOUR (06h-18h)'
                ELSE 'NUIT (18h-06h)'
            END as periode_jour_nuit,
            dayname(timestamp_debut::TIMESTAMP) as jour_semaine,
            monthname(timestamp_debut::TIMESTAMP) as mois
        FROM read_json_auto({paths}, filename=true)
    """)

    # Create communes table
    con.execute(f"""
        CREATE TABLE maintenance_communes AS
        SELECT 
            id as maintenance_id,
            unnest(communes_concernees) as commune
        FROM read_json_auto({paths})
    """)

    # Create services table
    con.execute(f"""
        CREATE TABLE maintenance_services AS
        SELECT 
            id as maintenance_id,
            unnest(services) as service
        FROM read_json_auto({paths})
    """)

    # Create provinces table
    con.execute(f"""
        CREATE TABLE maintenance_provinces AS
        SELECT 
            id as maintenance_id,
            unnest(provinces_concernees) as province
        FROM read_json_auto({paths})
    """)

    # Create geopoints table
    con.execute(f"""
        CREATE TABLE maintenance_geopoints AS
        SELECT 
            id as maintenance_id,
            unnest(communes_geopoints).commune as commune,
            unnest(communes_geopoints).lat as lat,
            unnest(communes_geopoints).lon as lon,
            ST_Point(unnest(communes_geopoints).lon, unnest(communes_geopoints).lat) as geom
        FROM read_json_auto({paths})
    """)

    print(f"Database built at {db_path}")
    print(f"Maintenances: {con.execute('SELECT count(*) FROM maintenances').fetchone()[0]}")
    con.close()

if __name__ == "__main__":
    data_dir = Path("data")
    db_path = data_dir / "helia.duckdb"
    build_db(data_dir, db_path)
