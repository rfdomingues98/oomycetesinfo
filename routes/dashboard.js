const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const Primer = require('../models/primers');

var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, './articles');
	},
	filename: function (req, file, cb) {
		cb(null, file.originalname);
	}
});

var upload = multer({
	fileFilter: (req, file, cb) => {
		if (file.mimetype != 'application/pdf') {
			req.fileValidationError = 'File upload supports pdf files only!';
			return cb(null, false, new Error('Filetype not supported!'));
		}
		cb(null, true);

	},
	storage: storage,
	limits: {
		fileSize: 10 * 1024 * 1024
	}
}
).single('pdfup');


const { ensureAuthenticated } = require('../config/auth');


router.get('/', ensureAuthenticated, (req, res) => {
	res.render('./dashboard/dashboard',
		{
			layout: 'layout_dashboard',
			title: 'Dashboard'
		}
	);
});

router.get('/add_primers', ensureAuthenticated, (req, res, next) => {
	const pdfDir = './articles/';
	let pdfList = [];
	fs.readdirSync(pdfDir).forEach(file => {
		pdfList.push(file);
	});
	res.render('./dashboard/add_primers',
		{
			layout: 'layout_dashboard',
			title: 'Add Primers',
			'pdfList': pdfList.sort()
		}
	);
});

router.post('/add_primers', ensureAuthenticated, (req, res, next) => {
	let { primer, sequence, article, link, pdf, blast, note } = req.body;
	let articles = [];
	let notes = [];
	for (let i = 0; i < link.length; i++) {
		if (link[i] == '')
			link[i] = '#!';
	}
	for (let i = 0; i < pdf.length; i++) {
		if (pdf[i] == '')
			pdf[i] = '#!';
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
	console.log(article);
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
		if (note[j])
			notes.push({ 'note': note[j] });
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
	res.render('./dashboard/add_regions',
		{
			layout: 'layout_dashboard',
			title: 'Add Conserved Regions'
		}
	);
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
			title: 'Manage Conserved Regions'
		}
	);
});

router.post('/uploadpdf', ensureAuthenticated, (req, res) => {
	upload(req, res, (err) => {
		if (req.fileValidationError) {
			req.flash('error', req.fileValidationError);
			res.redirect('/dashboard/add_primers');
		} else if (err) {
			res.status(500);
			if (err.code == 'LIMIT_FILE_SIZE') {
				req.flash('error', 'File should be max. 10mb!');
				res.redirect('/dashboard/add_primers');
			}
		} else {
			if (!req.file || req.file == undefined) {
				req.flash('error', 'File not found!');
				res.redirect('/dashboard/add_primers');
			} else {
				res.status(200);
				req.flash('success_msg', 'File uploaded successfully!');
				res.redirect('/dashboard/add_primers');
			}
		}
	});
});

router.post('/delete/:id', ensureAuthenticated, (req, res, next) => {
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
		next();
	});
});

module.exports = router;