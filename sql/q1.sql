-- WITH q1 AS (
--     SELECT map.id
--     FROM hummaps.map
--     JOIN hummaps.maptype ON map.maptype_id = maptype.id
--     JOIN hummaps.cc ON cc.map_id = map.id
--     GROUP BY map.id
--     -- HAVING count(cc.id) > 1

-- ), q2 AS (
--     SELECT map.id
--     FROM hummaps.map
--     JOIN hummaps.maptype ON map.maptype_id = maptype.id
--     JOIN hummaps.cc ON cc.map_id = map.id
--     LEFT JOIN hummaps.cc_image ON cc_image.cc_id = cc.id
--     WHERE cc_image.id IS NULL
-- )

-- SELECT id
-- FROM q1
-- JOIN q2 USING (id)
-- ORDER BY id DESC
-- ;

SELECT id FROM hummaps.map WHERE description IS NULL;