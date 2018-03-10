'use strict';

const router = require('express').Router();
const doSearch = require('../lib/search');

router.get('/', (req, res, next) => {
  doSearch(req.query)
  .then(mapRecs => {

    // mapRecs.forEach(rec => {

    //   // Composite attributes
    //   rec.bookpage = bookpage(rec);
    //   rec.heading = heading(rec);
    //   rec.line1 = line1(rec);
    //   rec.line2 = line2(rec);
    //   rec.line3 = line3(rec);
    //   rec.line4 = line4(rec);
    // });

    res.render('search', {
      title: 'Search Results',
      count: mapRecs.length,
      json: JSON.stringify(mapRecs, null, 2)
    });
  })
  .catch(next);
});

function bookpage(rec) {
  return `${rec.book}${rec.abbrev}${rec.page}`;
}

function heading(rec) {
  let heading = `${rec.book} ${rec.maptype}s ${rec.page}`;
  if (rec.npages > 1) {
    heading += `-${rec.page + rec.npages -1}`;
  }
  return heading;
}

function line1(rec) {
  return rec.surveyors.length ?
    `By: ${rec.surveyors.map(s => s.fullname).join(', ')}` :
    'By: (UNKNOWN)';
}

function line2(rec) {
  let line2;
  const date = rec.recdate;
  if (date) {
    line2 = `Rec: ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  } else {
    line2 = 'Rec: (UNKNOWN)';
  }
  return line2;
}

function line3(rec) {
    return rec.client ? `For: ${rec.client}` : null;
}

function line4(rec) {
    return `Desc: ${rec.description}`;
}

module.exports = router;
