const express = require('express');
const paginate = require('express-paginate');
const router = express.Router();
const fs = require('fs');
const mongoose = require('mongoose');
const aws = require('aws-sdk');

const Primer = require('../models/primers');
const Region = require('../models/regions');
const Clustal = require('../models/clustal');

aws.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: 'eu-west-3'
});

const s3 = new aws.S3();

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
	let perPage = req.query.perPage || 10;

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

router.get('/download/article/:id', (req, res) => {
	let key = 'articles/' + req.params.id;

	let params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: key
	};

	res.attachment(key);
	let fs = s3.getObject(params, (err, data) => {
		if (err)
			return console.log(err, err.stack);
	}).createReadStream();
	fs.pipe(res);
});

router.get('/download/clustal/:id', (req, res) => {
	let key = 'clustal/' + req.params.id;

	let params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: key
	};

	res.attachment(key);
	let fs = s3.getObject(params, (err, data) => {
		if (err)
			return console.log(err, err.stack);
	}).createReadStream();
	fs.pipe(res);
});

router.post('/primers/search', (req, res) => {
	let { searchFor, search } = req.body;
	let result = {};
	let data;
	if (searchFor == 'primer') {
		Primer.find({ primer: search }, (err, data) => {
			if (err)
				return console.log(err);
			if (typeof (data) == 'string') {
				result.docs = [data];
			} else {
				result.docs = data;
			}
			let ctx = {
				title: 'Primers Info',
				data: result
			};
			res.render('primers', ctx);
		});
	} else {
		Primer.find({ sequence: search }, (err, data) => {
			if (err)
				return console.log(err);
			if (typeof (data) == 'string') {
				result.docs = [data];
			} else {
				result.docs = data;
			}
			let ctx = {
				title: 'Primers Info',
				data: result
			};
			res.render('primers', ctx);
		});
	}
});

router.get('/regions', async (req, res) => {
	let page = req.query.page || 1;
	let perPage = req.query.perPage || 10;

	let maxPerPage = 10;
	let options = {
		page: parseInt(page, 10),
		limit: parseInt(perPage, 10) > maxPerPage ? maxPerPage : parseInt(perPage, 10),
		sort: { date: -1 }
	};

	const region = await Region.paginate({}, options);
	let ctx = {
		title: 'Target Regions Info',
		data: region
	};
	res.render('regions', ctx);
});

router.post('/regions/search', (req, res) => {
	let { searchFor, search } = req.body;
	let result = {};
	let data;
	if (searchFor == 'region') {
		Region.find({ region: search }, (err, data) => {
			if (err)
				return console.log(err);
			if (typeof (data) == 'string') {
				result.docs = [data];
			} else {
				result.docs = data;
			}
			let ctx = {
				title: 'Target Regions Info',
				data: result
			};
			res.render('regions', ctx);
		});
	} else {
		Region.find({ sequence: search }, (err, data) => {
			if (err)
				return console.log(err);
			if (typeof (data) == 'string') {
				result.docs = [data];
			} else {
				result.docs = data;
			}
			let ctx = {
				title: 'Target Regions Info',
				data: result
			};
			res.render('regions', ctx);
		});
	}
});

router.post('/getRegion/:id', (req, res) => {
	Region.findOne({ _id: req.params.id }, (err, data) => {
		if (err)
			return console.log(err);
		res.json(data);
	});
});

router.get('/clustal', async (req, res) => {
	let clustalList = [];

	let page = req.query.page || 1;
	let perPage = req.query.perPage || 5;

	let maxPerPage = 10;
	let options = {
		page: parseInt(page, 10),
		limit: parseInt(perPage, 10) > maxPerPage ? maxPerPage : parseInt(perPage, 10),
		sort: { date: -1 }
	};

	const clustal = await Clustal.paginate({}, options);

	let ctx = {
		layout: 'layout',
		title: 'CLUSTAL Data',
		data: clustal
	};
	res.render('clustal', ctx);
});

module.exports = router;