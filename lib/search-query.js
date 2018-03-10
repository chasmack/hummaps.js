'use strict';

// Main search query.
// Substitute your WHERE conditions for the placeholder "(TRUE)".
// The q1 CTE does the selection of target maps.
// The *_agg CTEs aggregate many-to-one fields into arrays.
// The coalesce functions in the final query convert NULLs to empty arrays.

const queryText = `
WITH q1 AS (
  SELECT DISTINCT map.id,
    map.book, map.page, map.npages,
    map.recdate, map.client, map.description,
    maptype.maptype, maptype.abbrev
  FROM map
  JOIN hummaps.maptype ON map.maptype_id = maptype.id
  JOIN hummaps.trs ON trs.map_id = map.id
  LEFT JOIN hummaps.signed_by ON signed_by.map_id = map.id
  LEFT JOIN hummaps.surveyor ON signed_by.surveyor_id = surveyor.id
  WHERE (TRUE)
),
surveyor_agg AS (
  SELECT a.id, array_agg(surveyor) AS surveyors
  FROM (
    SELECT q1.id,
    ARRAY[s.firstname, s.secondname, s.thirdname, s.lastname, s.suffix, s.pls, s.rce] AS surveyor
    FROM q1
    JOIN hummaps.signed_by ON signed_by.map_id = q1.id
    JOIN hummaps.surveyor AS s ON signed_by.surveyor_id = s.id
    ORDER BY s.lastname, s.firstname
  ) AS a
  GROUP BY a.id
),
mapimage_agg AS (
  SELECT a.id, array_agg(a.imagefile) AS imagefiles
  FROM (
    SELECT q1.id, map_image.imagefile
    FROM q1
    JOIN hummaps.map_image ON map_image.map_id = q1.id
    ORDER BY map_image.imagefile ASC
  ) AS a
  GROUP BY a.id
),
cc_agg AS (
  SELECT a.id, array_agg(a.cc) AS ccs
  FROM (
    SELECT id,
      json_build_object(
        'doc_number', doc_number,
        'imagefiles', CASE WHEN count(imagefile) > 0 THEN array_agg(imagefile) ELSE '{}' END
      ) AS cc
    FROM (
      SELECT q1.id, cc.doc_number, cc_image.imagefile
      FROM q1
      JOIN hummaps.cc ON cc.map_id = q1.id
      LEFT JOIN hummaps.cc_image on cc_image.cc_id = cc.id
      ORDER BY cc.doc_number, cc_image.imagefile
    ) AS b
    GROUP BY b.id, b.doc_number
  ) AS a
  GROUP BY a.id
)
SELECT q1.id, maptype, book, abbrev, page, npages,
  recdate, client, description, pdf.pdffile,
  coalesce(surveyor_agg.surveyors, '{}') AS surveyors,
  coalesce(mapimage_agg.imagefiles, '{}') AS imagefiles,
  coalesce(cc_agg.ccs, '{}') AS ccs
FROM q1
LEFT JOIN surveyor_agg ON surveyor_agg.id = q1.id
LEFT JOIN mapimage_agg ON mapimage_agg.id = q1.id
LEFT JOIN cc_agg ON cc_agg.id = q1.id
LEFT JOIN hummaps.pdf ON pdf.map_id = q1.id
ORDER BY abbrev, book DESC, page ASC
`;

const searchQuery = params => {

  const q = {
    text: '',
    values: [],
    addParam: function(val) {
      this.values.push(val);
      return '$' + this.values.length;
    }
  };
  const condTerms = [];

  // Search for map ids
  const reMapId = /^(\d+)(?:-(\d+))?$/;
  (params.id || '').split(',').forEach(id => {
    const m = id.match(reMapId);
    if (m && m[2]) {
      condTerms.push(`(map.id BETWEEN ${q.addParam(+m[1])} AND ${q.addParam(+m[2])})`);
    } else if (m) {
      condTerms.push(`(map.id = ${q.addParam(+m[1])})`);
    }
  });

  // Search for map book/page, etc.
  if (params.map) {
    const reBookPage = /^(\d+)(CR|HM|MM|PM|RM|RS|UR)(\d+)(?:-(\d+))?$/;
    const rePmTract = /^(PM|TR)(\d+)(?:-(\d+))?$/;
    const maps = params.map.toUpperCase().split(',');
    for (let i = 0, m = null; i < maps.length; i++) {
      m = maps[i].match(reBookPage);
      if (m) {
        const [book, maptype, page, last] = m.slice(1);
        condTerms.push([
          `(map.book = ${q.addParam(+book)})`,
          `(maptype.abbrev = ${q.addParam(maptype)})`,
          `(map.page + map.npages > ${q.addParam(+page)})`,
          `(map.page <= ${q.addParam(last ? +last : +page)})`
        ].join(' AND '));
        continue;
      }
      m = maps[i].match(rePmTract);
      if (m) {
        console.log(m);
        const [term, maptype, first, last] = m;
        if (last) {
          condTerms.push([
            `(maptype.abbrev = '${maptype=='TR'?'RM':'PM'}')`,
            `(map.client ~ '\\(${maptype}\\d+\\)')`,
            `(regexp_replace(map.client, '.*\\((?:${maptype}(\\d+))\\).*', '\\1')::int BETWEEN ${q.addParam(+first)} AND ${q.addParam(+last)})`
          ].join(' AND '));
        } else {
          condTerms.push([
            `(maptype.abbrev = '${maptype=='TR'?'RM':'PM'}')`,
            `(map.client ~ '\\(${term}\\)')`
          ].join(' AND ')); 
        }
        continue;
      }
    }
  }

  if (params.q) {
    console.log(params.q);
  }
  if (params.surveyor) {
    condTerms.push(`surveyor.fullname ~* ${q.addParam(params.surveyor)}`);
  }
  if (condTerms.length) {
    q.text = queryText.replace('(TRUE)', condTerms.join(' OR\n'));
  }

  // OFFSET and LIMIT
  const MAX_RESULTS = 200;
  if (q.text) {
    if (params.offset && params.offset.match(/^\d+$/)) {
      q.text += `OFFSET ${params.offset}\n`;
    }
    if (params.limit && params.limit.match(/^\d+$/) && 0 <= +params.limit < MAX_RESULTS) {
      q.text += `LIMIT ${params.limit}\n`;
    } else {
      q.text += `LIMIT ${MAX_RESULTS}\n`;
    }
  }
  console.log(q.text);
  console.log(q.values);

  return q;
};

module.exports = searchQuery;
