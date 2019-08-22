const express = require('express');
const router = express.Router();
const fs = require('fs');
const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const crypto = require('crypto');

const Primer = require('../models/primers');
const Region = require('../models/regions');

const { ensureAuthenticated } = require('../config/auth');


aws.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: 'eu-west-3'
});

const s3 = new aws.S3();

const upload = multer({
	fileFilter: (req, file, cb) => {
		fileCheck(file, cb);
	},
	storage: multerS3({
		s3: s3,
		bucket: process.env.AWS_BUCKET_NAME,
		key: (req, file, cb) => {
			cb(null, 'articles/' + file.originalname);
		}
	}),
	limits: {
		fileSize: 10000000
	}
}).single('pdfup');

const fileCheck = (file, cb) => {
	const filetypes = /pdf/;
	const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
	const mimetype = filetypes.test(file.mimetype);

	if (mimetype && extname) {
		return cb(null, true);
	} else {
		cb('File not supported! Only pdf allowed!');
	}
};

router.get('/', ensureAuthenticated, (req, res) => {
	res.render('./dashboard/dashboard',
		{
			layout: 'layout_dashboard',
			title: 'Dashboard'
		}
	);
});

router.get('/add_primers', ensureAuthenticated, (req, res, next) => {
	let params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Prefix: 'articles/'
	};
	s3.listObjectsV2(params, (err, data) => {
		if (err)
			return console.log(err);
		data.Contents.shift();
		let ctx = {
			layout: 'layout_dashboard',
			title: 'Add Primers',
			pdfList: data.Contents
		};
		res.render('./dashboard/add_primers', ctx);
	});
});

router.post('/add_primers', ensureAuthenticated, (req, res, next) => {
	let { primer, sequence, article, link, pdf, blast, note } = req.body;
	sequence = sequence.trim();
	Primer.find({ "sequence": sequence }, (err, result) => {
		if (err)
			return console.log(err);
		if (result.sequence == sequence) {
			req.flash('error', 'That sequence already exists in our database!');
			res.redirect('/dashboard/add_primers');
		} else {
			let articles = [];
			let notes = [];
			if (article != undefined) {
				if (link != undefined) {
					for (let i = 0; i < link.length; i++) {
						if (link[i] == '')
							link[i] = '#!';
					}
				}
				if (pdf != undefined) {
					for (let i = 0; i < pdf.length; i++) {
						if (pdf[i] == '')
							pdf[i] = '#!';
					}
				}
			} else {
				article = {};
			}

			if (typeof (article) == "string") {
				article = [article];
			}
			if (typeof (link) == "string") {
				link = [link];
			}
			if (typeof (pdf) == "string") {
				pdf = [pdf];
			}
			if (typeof (note) == "string") {
				note = [note];
			}

			const checkDuplicate = (arr, duplicate) => {
				return arr.filter(item => item == duplicate).length;
			};
			for (let j = 0; j < 5; j++) {
				let radio = req.body['customRadio' + (j + 1)];
				if (article[j] == '' && ((link[j] != '' && link[j] != '#!') || (pdf[j] != '' && pdf[j] != '#!'))) {
					article[j] = "Link";
				}
				if (radio == 'link') {
					if (link[j] != '#!') {
						if (checkDuplicate(link, link[j]) > 1) {
							req.flash('warning_msg', 'Duplicate articles are not allowed!');
							res.redirect('/dashboard/add_primers');
						}
					}
					let objArticle = {
						'name': article[j],
						'pdf': false,
						'link': link[j]
					};
					articles.push(objArticle);
				} else if (radio == 'pdf') {
					if (pdf[j] != '#!') {
						if (checkDuplicate(pdf, pdf[j]) > 1) {
							req.flash('warning_msg', 'Duplicate articles are not allowed!');
							res.redirect('/dashboard/add_primers');
						}
					}
					let objArticle = {
						'name': article[j],
						'pdf': true,
						'link': pdf[j]
					};
					articles.push(objArticle);
				}
				if (note != undefined) {
					if (note[j])
						notes.push({ 'note': note[j] });
				} else {
					note = {};
				}
			}

			let obj = new Primer({
				primer,
				sequence,
				articles,
				blast,
				notes
			});

			obj
				.save()
				.then(() => {
					req.flash('success_msg', 'Added primer successfully!');
					res.redirect('/dashboard/add_primers');
				})
				.catch(err => {
					console.log(err);
				});
		}
	});
});

router.get('/add_oligonucleotides', ensureAuthenticated, (req, res) => {
	res.render('./dashboard/add_oligonucleotides',
		{
			layout: 'layout_dashboard',
			title: 'Add Oligonucleotides'
		}
	);
});

router.get('/add_regions', ensureAuthenticated, (req, res) => {
	let params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Prefix: 'articles/'
	};
	s3.listObjectsV2(params, (err, data) => {
		if (err)
			return console.log(err);
		data.Contents.shift();
		let ctx = {
			layout: 'layout_dashboard',
			title: 'Add Target Regions',
			pdfList: data.Contents
		};
		res.render('./dashboard/add_regions', ctx);
	});
});

router.post('/add_regions', ensureAuthenticated, (req, res) => {
	let { region, sequence, article, link, pdf, blast, unite, bold, phyto, note, primerName, primerSequence, primerBlast, primerNote, ampSequenceName, ampSequenceSequence, ampSequenceBlast, ampSequenceUnite, ampSequenceBold, ampSequencePhyto, ampSequenceNote } = req.body;

	sequence = sequence.trim();

	Region.find({ "sequence": sequence }, (err, result) => {
		if (err)
			return console.log(err);
		if (result.sequence == sequence) {
			req.flash('error', 'That sequence already exists in our database!');
			res.redirect('/dashboard/add_regions');
		} else {
			let articles = [];
			let notes = [];
			let primers = [];
			let amp_sequences = [];

			if (article != undefined) {
				if (link != undefined) {
					for (let i = 0; i < link.length; i++) {
						if (link[i] == '')
							link[i] = '#!';
					}
				}
				if (pdf != undefined) {
					for (let i = 0; i < pdf.length; i++) {
						if (pdf[i] == '')
							pdf[i] = '#!';
					}
				}
			} else {
				article = {};
			}

			if (typeof (article) == "string") {
				article = [article];
			}
			if (typeof (link) == "string") {
				link = [link];
			}
			if (typeof (pdf) == "string") {
				pdf = [pdf];
			}
			if (typeof (note) == "string") {
				note = [note];
			}
			if (typeof (primerName) == "string") {
				primerName = [primerName];
			}
			if (typeof (primerSequence) == "string") {
				primerSequence = [primerSequence];
			}
			if (typeof (primerNote) == "string") {
				primerNote = [primerNote];
			}
			if (typeof (ampSequenceName) == "string") {
				ampSequenceName = [ampSequenceName];
			}
			if (typeof (ampSequenceSequence) == "string") {
				ampSequenceSequence = [ampSequenceSequence];
			}
			if (typeof (ampSequenceBlast) == "string") {
				ampSequenceBlast = [ampSequenceBlast];
			}
			if (typeof (ampSequenceUnite) == "string") {
				ampSequenceUnite = [ampSequenceUnite];
			}
			if (typeof (ampSequenceBold) == "string") {
				ampSequenceBold = [ampSequenceBold];
			}
			if (typeof (ampSequencePhyto) == "string") {
				ampSequencePhyto = [ampSequencePhyto];
			}
			if (typeof (ampSequenceNote) == "string") {
				ampSequenceNote = [ampSequenceNote];
			}

			const checkDuplicate = (arr, duplicate) => {
				return arr.filter(item => item == duplicate).length;
			};
			for (let j = 0; j < 5; j++) {
				let radio = req.body['customRadio' + (j + 1)];
				if (article[j] == '' && ((link[j] != '' && link[j] != '#!') || (pdf[j] != '' && pdf[j] != '#!'))) {
					article[j] = "Link";
				}
				if (radio == 'link') {
					if (link[j] != '#!') {
						if (checkDuplicate(link, link[j]) > 1) {
							req.flash('warning_msg', 'Duplicate articles are not allowed!');
							res.redirect('/dashboard/add_primers');
						}
					}
					let objArticle = {
						'name': article[j],
						'pdf': false,
						'link': link[j]
					};
					articles.push(objArticle);
				} else if (radio == 'pdf') {
					if (pdf[j] != '#!') {
						if (checkDuplicate(pdf, pdf[j]) > 1) {
							req.flash('warning_msg', 'Duplicate articles are not allowed!');
							res.redirect('/dashboard/add_primers');
						}
					}
					let objArticle = {
						'name': article[j],
						'pdf': true,
						'link': pdf[j]
					};
					articles.push(objArticle);
				}

				if (note != undefined) {
					if (note[j])
						notes.push({ 'note': note[j] });
				} else {
					note = {};
				}

				if (primerSequence != undefined) {
					if (primerSequence[j] != undefined) {
						primerSequence[j] = primerSequence[j].trim();
					}
					let objPrimer = {
						primer: primerName[j],
						sequence: primerSequence[j],
						blast: primerBlast[j],
						notes: primerNote[j]
					};
					if (primerName[j] && primerSequence[j])
						primers.push(objPrimer);
				}
				if (ampSequenceSequence != undefined) {
					if (ampSequenceSequence[j] != undefined) {
						ampSequenceSequence[j] = ampSequenceSequence[j].trim();
					}
					let objAmpSequence = {
						name: ampSequenceName[j],
						sequence: ampSequenceSequence[j],
						blast: ampSequenceBlast[j],
						unite: ampSequenceUnite[j],
						boldsystems: ampSequenceBold[j],
						phytophthoradb: ampSequencePhyto[j],
						notes: ampSequenceNote[j]
					};
					if (ampSequenceName[j] && ampSequenceSequence[j])
						amp_sequences.push(objAmpSequence);
				}
			}

			let obj = new Region({
				region,
				sequence,
				articles,
				blast,
				unite,
				bold,
				phyto,
				notes,
				primers,
				amp_sequences
			});

			obj
				.save()
				.then(() => {
					req.flash('success_msg', 'Added region successfully!');
					res.redirect('/dashboard/add_regions');
				})
				.catch(err => {
					console.log(err);
				});
		}
	});
});

router.get('/manage_primers', ensureAuthenticated, async (req, res) => {
	const pdfDir = './articles/';
	let pdfList = [];
	fs.readdirSync(pdfDir).forEach(file => {
		pdfList.push(file);
	});

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
		layout: 'layout_dashboard',
		title: 'Manage Primers',
		data: primers,
		pdfList: pdfList.sort()
	};
	res.render('./dashboard/manage_primers', ctx);
});

router.get('/manage_oligonucleotides', ensureAuthenticated, (req, res) => {
	res.render('./dashboard/manage_oligonucleotides',
		{
			layout: 'layout_dashboard',
			title: 'Manage Oligonucleotides'
		}
	);
});

router.get('/manage_regions', ensureAuthenticated, (req, res) => {
	res.render('./dashboard/manage_regions',
		{
			layout: 'layout_dashboard',
			title: 'Manage Target Regions'
		}
	);
});

router.post('/uploadpdf', ensureAuthenticated, (req, res) => {
	upload(req, res, (err) => {
		if (err) {
			req.flash('error', err.message);
			res.redirect('/dashboard');
		} else {
			if (req.file == undefined) {
				req.flash('error', 'No file selected!');
				res.redirect('/dashboard');
			} else {
				req.flash('success_msg', 'File uploaded successfully!');
				res.redirect('/dashboard');
			}
		}
	});
});

router.get('/edit/:id', ensureAuthenticated, (req, res) => {
	Primer.find({ _id: req.params.id }, (err, result) => {
		if (err) {
			return res.send('Page not found!');
		}

		let params = {
			Bucket: process.env.AWS_BUCKET_NAME,
			Prefix: 'articles/'
		};
		s3.listObjectsV2(params, (err, data) => {
			if (err)
				return console.log(err);
			data.Contents.shift();
			let ctx = {
				layout: 'layout_dashboard',
				title: 'Add Primers',
				data: result[0],
				pdfList: data.Contents
			};
			res.render('./dashboard/edit_primers', ctx);
		});
	});
});

router.post('/edit/:id', ensureAuthenticated, (req, res) => {
	let { primer, sequence, article, link, pdf, blast, note } = req.body;
	let articles = [];
	let notes = [];
	if (article != undefined) {
		if (link != undefined) {
			for (let i = 0; i < link.length; i++) {
				if (link[i] == '')
					link[i] = '#!';
			}
		}
		if (pdf != undefined) {
			for (let i = 0; i < pdf.length; i++) {
				if (pdf[i] == '')
					pdf[i] = '#!';
			}
		}
	} else {
		article = {};
	}


	if (typeof (article) == "string") {
		article = [article];
	}
	if (typeof (link) == "string") {
		link = [link];
	}
	if (typeof (pdf) == "string") {
		pdf = [pdf];
	}
	if (typeof (note) == "string") {
		note = [note];
	}

	const checkDuplicate = (arr, duplicate) => {
		return arr.filter(item => item == duplicate).length;
	};
	for (let j = 0; j < 5; j++) {
		let radio = req.body['customRadio' + (j + 1)];
		if (article[j] == '' && ((link[j] != '' && link[j] != '#!') || (pdf[j] != '' && pdf[j] != '#!'))) {
			article[j] = "Link";
		}
		if (radio == 'link') {
			if (link[j] != '#!') {
				if (checkDuplicate(link, link[j]) > 1) {
					req.flash('warning_msg', 'Duplicate articles are not allowed!');
					res.redirect('/dashboard/edit/' + req.params.id);
				}
			}
			let objArticle = {
				'name': article[j],
				'pdf': false,
				'link': link[j]
			};
			articles.push(objArticle);
		} else if (radio == 'pdf') {
			if (pdf[j] != '#!') {
				if (checkDuplicate(pdf, pdf[j]) > 1) {
					req.flash('warning_msg', 'Duplicate articles are not allowed!');
					res.redirect('/dashboard/edit/' + req.params.id);
				}
			}
			let objArticle = {
				'name': article[j],
				'pdf': true,
				'link': pdf[j]
			};
			articles.push(objArticle);
		}
		if (note != undefined) {
			if (note[j])
				notes.push({ 'note': note[j] });
		} else {
			note = {};
		}
	}

	let obj = {
		primer,
		sequence,
		articles,
		blast,
		notes
	};

	Primer.findByIdAndUpdate(req.params.id, obj, { new: true }, (err, result) => {
		if (err) {
			console.log(err);
			req.flash('warning_msg', 'Failed to update primer!');
			res.redirect('/dashboard/edit/' + req.params.id);
		} else {
			console.log(result);
			req.flash('success_msg', 'Primer updated successfully!');
			res.redirect('/dashboard/manage_primers');
		}
	});
});

router.get('/delete/:id', ensureAuthenticated, (req, res, next) => {
	Primer.findByIdAndDelete({ _id: req.params.id }, (err, result) => {
		if (err) {
			console.log(err);
			req.flash('error', 'Failed to delete primer!');
			res.redirect('/dashboard/manage_primers');
		} else {
			console.log(result);
			req.flash('success_msg', 'Primer deleted successfully!');
			res.redirect('/dashboard/manage_primers');
		}
	});
});

module.exports = router;