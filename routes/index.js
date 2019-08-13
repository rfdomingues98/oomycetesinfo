const express = require('express');
const paginate = require('express-paginate');
const router = express.Router();
const fs = require('fs');
const mongoose = require('mongoose');

const Primer = require('../models/primers');

router.get('/', (req, res) => {
	ctx = {
		title: 'Oomycetes Info'
	};
	res.render('index', ctx);
});

router.get('/primers', (req, res, next) => {

	const Primers = new Primer();

	Primers.find({ primer: 'Test primer 1' }).then(console.log('Success!'));

	let itemCount = Object.keys(data).length,
		itemsPerPage = 10,
		pageCount = Math.ceil(itemCount / itemsPerPage);
	ctx = {
		title: 'Primers Info',
		//data: data,
		//! Fix get data from db
	};
	res.render('primers', ctx);
});
router.get('/file', (req, res) => {
	let filepath = `/../articles/${req.query.id}`;
	fs.readFile(__dirname + filepath, (err, data) => {
		if (err) throw err;
		res.contentType("application/pdf");
		res.send(data);
	});
});

module.exports = router;