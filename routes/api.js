'use strict';

const router = require('express').Router();

const doSearch = require('../lib/search');

router.get('/search', (req, res, next) => {
  doSearch(req.query)
    .then(results => {
      res.render('search', {
        title: 'Search Results',
        results: results,
        json: JSON.stringify(results.rows, null, 2)
      });
    })
    .catch(next);
});

module.exports = router;
