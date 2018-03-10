'use strict';

const db = require('../db');

const doSearch = async params => {

  const condTerms = [];
  const queryValues = [];
  const addParam = val => {
    queryValues.push(val);
    return '$' + queryValues.length;
  };

  // Search for map ids
  const reMapId = /^(\d+)(?:-(\d+))?$/;
  (params.id || '').split(',').forEach(id => {
    const m = id.match(reMapId);
    if (m && m[2]) {
      condTerms.push(`(map.id BETWEEN ${addParam(+m[1])} AND ${addParam(+m[2])})`);
    } else if (m) {
      condTerms.push(`(map.id = ${addParam(+m[1])})`);
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
          `(map.book = ${addParam(+book)})`,
          `(maptype.abbrev = ${addParam(maptype)})`,
          `(map.page + map.npages > ${addParam(+page)})`,
          `(map.page <= ${addParam(last ? +last : +page)})`
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
            `(regexp_replace(map.client, '.*\\((?:${maptype}(\\d+))\\).*', '\\1')::int BETWEEN ${addParam(+first)} AND ${addParam(+last)})`
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

  if (condTerms.length == 0) {
    return [];
  }

  const query = {
    text: queryText.replace('(FALSE)', condTerms.join(' OR\n    ')),
    values: queryValues,
  };

  // OFFSET and LIMIT
  if (params.offset && params.offset.match(/^\d+$/)) {
    query.text = query.text.replace('OFFSET 0', `OFFSET ${params.offset}`);
  }
  if (params.limit && params.limit.match(/^\d+$/) && 0 <= +params.limit < MAX_RESULTS) {
    query.text = query.text.replace(`LIMIT ${MAX_RESULTS}`, `LIMIT ${params.limit}`);
  }

  console.log(query.text);
  console.log(query.values);

  const results = await db.query(query);

  // Replace structured arrays with objects
  results.rows.forEach(rec => {

    const surveyors = [];
    rec.surveyors.forEach((surveyor) => {
      // [firstname, secondname, thirdname, lastname, suffix, pls, rce]
      
      let fullname = surveyor.slice(0,1);
      surveyor.slice(1,3).forEach(name => {if (name) fullname.push(name.slice(0,1));});
      surveyor.slice(3,5).forEach(name => {if (name) fullname.push(name);});
      fullname = fullname.join(' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

      let licenses = [];
      const [pls, rce] = surveyor.slice(5,7);
      if (pls) licenses.push('LS' + pls);
      if (rce) licenses.push('RCE' + rce);
      if (licenses.length) fullname += ` (${licenses.join(', ')})`;

      surveyors.push({
        fullname: fullname,
        firstname: surveyor[0],
        lastname: surveyor[3],
      });
    });
    rec.surveyors = surveyors;

    const ccs = [];
    rec.ccs.forEach(cc => {
      // [doc_number, [imagefile, ...]]

      const [doc_number, ...imagefiles] = cc;
      ccs.push({
        doc_number: doc_number,
        imagefiles: imagefiles
      });
    });
    rec.ccs = ccs;
  });
  
  return results.rows;
};

const MAX_RESULTS = 200;

// Get map records.
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
  WHERE
    (FALSE)
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
      CASE WHEN count(b.imagefile) > 0
        THEN b.doc_number || array_agg(b.imagefile)
        ELSE ARRAY[b.doc_number]
      END AS cc
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
OFFSET 0
LIMIT ${MAX_RESULTS}
`;

module.exports = doSearch;
