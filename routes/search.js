'use strict';

const router = require('express').Router();
const searchQuery = require('../lib/search-query');
const db = require('../db');

router.get('/', (req, res, next) => {
  db.query(searchQuery(req.query))
    .then(results => {
      results.rows.forEach(item => {

        // Replace structured arrays with objects
        // item.ccs = ccs(item);
        item.surveyors = surveyors(item);

        // Composite attributes
        item.bookpage = bookpage(item);
        item.heading = heading(item);
        item.line1 = line1(item);
        item.line2 = line2(item);
        item.line3 = line3(item);
        item.line4 = line4(item);
      });

      res.render('search', {
        title: 'Search Results',
        results: results,
        json: JSON.stringify(results.rows, null, 2)
      });
    })
    .catch(next);
});

function bookpage(item) {
  return `${item.book}${item.abbrev}${item.page}`;
}

function heading(item) {
  let heading = `${item.book} ${item.maptype}s ${item.page}`;
  if (item.npages > 1) {
    heading += `-${item.page + item.npages -1}`;
  }
  return heading;
}

function line1(item) {
  return item.surveyors.length ?
    `By: ${item.surveyors.map(s => s.fullname).join(', ')}` :
    'By: (UNKNOWN)';
}

function line2(item) {
  let line2;
  const date = item.recdate;
  if (date) {
    line2 = `Rec: ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  } else {
    line2 = 'Rec: (UNKNOWN)';
  }
  return line2;
}

function line3(item) {
    return item.client ? `For: ${item.client}` : null;
}

function line4(item) {
    return `Desc: ${item.description}`;
}

function surveyors(item) {
  const surveyors = [];
  item.surveyors.forEach((surveyor) => {
    //const [firstname, secondname, thirdname, lastname, suffix, pls, rce] = surveyor;

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
  return surveyors;
}

module.exports = router;
