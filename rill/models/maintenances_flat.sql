SELECT 
    m.*,
    CASE 
        WHEN hour(m.timestamp_debut) BETWEEN 6 AND 18 THEN 'JOUR (06h-18h)'
        ELSE 'NUIT (18h-06h)'
    END as periode_jour_nuit,
    c.commune,
    s.service,
    g.lat,
    g.lon
FROM maintenances m
LEFT JOIN maintenance_communes c ON m.id = c.maintenance_id
LEFT JOIN maintenance_services s ON m.id = s.maintenance_id
LEFT JOIN maintenance_geopoints g ON m.id = g.maintenance_id AND c.commune = g.commune
