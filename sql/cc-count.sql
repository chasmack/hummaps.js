WITH q1 AS (
  SELECT ('   ' || year::text) AS year, count(cc.id) AS count
  FROM (SELECT generate_series(1990, 2018) AS year) q
  LEFT JOIN hummaps.cc
  ON doc_number ~ ('^' || year::text)
  GROUP BY year
  ORDER BY year DESC
)
SELECT year "   Year", count "Count" FROM q1
UNION ALL
SELECT 'AVERAGE'::text, (sum(q1.count) / count(q1.count))::decimal(6,1)
FROM q1
;
