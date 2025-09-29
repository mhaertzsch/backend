const express = require('express');
const pool = require('../db.js');
const router = require('express').Router();

router.use('/products', require('./products'));
router.use('/gacha', require('./gacha'));
router.use('/flags', require('./flags'));
router.use('/users', require('./users'));
router.use('/orders', require('./orders'));
router.use('/coupons', require('./coupons'));
router.use('/checkout', require('./checkout'));
router.use('/categories', require('./categories'));
router.use('/badges', require('./badges'));
router.use('/achievements', require('./achievements'));
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
