const express = require('express');
const paginate = require('express-paginate');
const router = express.Router();
const fs = require('fs');
const mongoose = require('mongoose');

const Primer = require('../models/primers');

router.get('/', (req, res) => {
	let perPage = 10;
	ctx = {
		title: 'Oomycetes Info',
		perPage
	};
	res.render('index', ctx);
});

router.get('/primers', async (req, res, next) => {
	let page = req.query.page || 1;
	let perPage = req.query.perPage || 5;

	let maxPerPage = 10;
	let options = {
		page: parseInt(page, 10),
		limit: parseInt(perPage, 10) > maxPerPage ? maxPerPage : parseInt(perPage, 10),
		sort: { date: -1 }
	};

	const primers = await Primer.paginate({}, options);
	ctx = {
		title: 'Primers Info',
		data: primers
	};
	res.render('primers', ctx);
});
router.get('/file', (req, res) => {
	let filepath = `/../articles/${req.query.id}`;
	fs.readFile(__dirname + filepath, (err, data) => {
		if (err) {
			return res.status(404).send('File not found!');
		}
		res.contentType("application/pdf");
		res.send(data);
	});
});

module.exports = router;