const express = require('express');
const paginate = require('express-paginate');
const router = express.Router();
const fs = require('fs');
const mongoose = require('mongoose');
const aws = require('aws-sdk');

const Primer = require('../models/primers');
const Oligonucleotide = require('../models/oligonucleotides');
const Region = require('../models/regions');
const Clustal = require('../models/clustal');

aws.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: 'eu-west-3'
});

const s3 = new aws.S3();

const pagination = (paginate, size) => {
	let { page, totalPages } = paginate;
	let pagesArray = [];

	if (totalPages > size) {
		if (page - Math.ceil(size / 2) < 1) {

			for (let i = 1; i <= size; i++) {
				if (pagesArray.length >= size) {
					pagesArray.shift();
					pagesArray.push(i);
				} else {
					pagesArray.push(i);
				}
			}
		} else if (page + Math.ceil(size / 2) > totalPages) {
			for (let i = totalPages - size; i <= totalPages; i++) {
				if (pagesArray.length >= size) {
					pagesArray.shift();
					pagesArray.push(i);
				} else {
					pagesArray.push(i);
				}
			}
		} else {
			for (let i = page - Math.ceil(size / 2); i < page + Math.ceil(size / 2); i++) {
				if (pagesArray.length >= size) {
					pagesArray.shift();
					pagesArray.push(i);
				} else {
					pagesArray.push(i);
				}
			}
		}
	} else {
		for (let i = 1; i <= totalPages; i++) {
			pagesArray.push(i);
		}
	}
	paginate.pagesArray = pagesArray;
	return paginate;
};

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
		data: pagination(primers, 5)
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
	let file = s3
		.getObject(params)
		.on('error', (err) => {
			console.log(err);
		})
		.on('httpData', (chunk) => {
			file.write(chunk);
		})
		.on('httpDone', () => {
			file.end();
		})
		.createReadStream();
	file.pipe(res);
});

router.get('/download/clustal/:id', (req, res) => {
	let key = 'clustal/' + req.params.id;

	let params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Key: key
	};

	res.attachment(key);
	let file = s3
		.getObject(params)
		.on('error', (err) => {
			console.log(err);
		})
		.on('httpData', (chunk) => {
			file.write(chunk);
		})
		.on('httpDone', () => {
			file.end();
		})
		.createReadStream();
	file.pipe(res);
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

router.get('/oligonucleotides', async (req, res) => {
	let page = req.query.page || 1;
	let perPage = req.query.perPage || 10;

	let maxPerPage = 10;
	let options = {
		page: parseInt(page, 10),
		limit: parseInt(perPage, 10) > maxPerPage ? maxPerPage : parseInt(perPage, 10),
		sort: { date: -1 }
	};

	const oligonucleotides = await Oligonucleotide.paginate({}, options);
	ctx = {
		title: 'Oligonucleotides Info',
		data: pagination(oligonucleotides, 5)
	};
	res.render('oligonucleotides', ctx);
});

router.post('/oligonucleotides/search', (req, res) => {
	let { searchFor, search } = req.body;
	let result = {};
	let data;
	if (searchFor == 'name') {
		Oligonucleotide.find({ name: search }, (err, data) => {
			if (err)
				return console.log(err);
			if (typeof (data) == 'string') {
				result.docs = [data];
			} else {
				result.docs = data;
			}
			let ctx = {
				title: 'Oligonucleotides Info',
				data: result
			};
			res.render('oligonucleotides', ctx);
		});
	} else {
		Oligonucleotide.find({ sequence: search }, (err, data) => {
			if (err)
				return console.log(err);
			if (typeof (data) == 'string') {
				result.docs = [data];
			} else {
				result.docs = data;
			}
			let ctx = {
				title: 'Oligonucleotides Info',
				data: result
			};
			res.render('oligonucleotides', ctx);
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
		data: pagination(region, 5)
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
		data: pagination(clustal, 5)
	};
	res.render('clustal', ctx);
});

module.exports = router;