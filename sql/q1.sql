SELECT map.id, map.client
FROM hummaps.map
JOIN hummaps.maptype ON map.maptype_id = maptype.id
WHERE
maptype.abbrev = 'PM' AND
map.client ~* '\(PM\d+\)' AND
regexp_replace(map.client, '.*\((?:PM(\d+))\).*', '\1')::int BETWEEN 1520 AND 1530
ORDER BY map.book, map.page
;