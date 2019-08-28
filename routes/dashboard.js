const express = require('express');
const router = express.Router();
const fs = require('fs');
const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const crypto = require('crypto');
const { Parser } = require('json2csv');

const Primer = require('../models/primers');
const Oligonucleotide = require('../models/oligonucleotides');
const Region = require('../models/regions');
const Clustal = require('../models/clustal');

const { ensureAuthenticated } = require('../config/auth');


aws.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	region: 'eu-west-3'
});

const s3 = new aws.S3();

const upload_pdf = multer({
	fileFilter: (req, file, cb) => {
		fileCheckPdf(file, cb);
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

const upload_clustal = multer({
	fileFilter: (req, file, cb) => {
		fileCheckClustal(file, cb);
	},
	storage: multerS3({
		s3: s3,
		bucket: process.env.AWS_BUCKET_NAME,
		key: (req, file, cb) => {
			cb(null, 'clustal/' + file.originalname);
		}
	}),
	limits: {
		fileSize: 10000000
	}
}).single('clustalup');

const fileCheckPdf = (file, cb) => {
	const filetypes = /pdf/;
	const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
	const mimetype = filetypes.test(file.mimetype);

	if (mimetype && extname) {
		return cb(null, true);
	} else {
		cb('File not supported! Only pdf allowed!');
	}
};

const fileCheckClustal = (file, cb) => {
	const filetypes = /html/;
	const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
	const mimetype = filetypes.test(file.mimetype);

	if (mimetype && extname) {
		return cb(null, true);
	} else {
		cb('File not supported! Only html allowed!');
	}
};

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
			for (let i = page - Math.ceil(size / 2); i <= page + Math.ceil(size / 2); i++) {
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
					if (link != undefined) {

						if (link[j] != '#!' && link[j] != undefined) {
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
					}
				} else if (radio == 'pdf') {
					if (pdf != undefined) {

						if (pdf[j] != '#!' && pdf[j] != undefined) {
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

router.get('/add_oligonucleotides', ensureAuthenticated, (req, res, next) => {
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
			title: 'Add Oligonucleotides',
			pdfList: data.Contents
		};
		res.render('./dashboard/add_oligonucleotides', ctx);
	});
});

router.post('/add_oligonucleotides', ensureAuthenticated, (req, res, next) => {
	let { name, sequence, article, link, pdf, blast, note } = req.body;
	sequence = sequence.trim();
	Oligonucleotide.find({ "sequence": sequence }, (err, result) => {
		if (err)
			return console.log(err);
		if (result.sequence == sequence) {
			req.flash('error', 'That sequence already exists in our database!');
			res.redirect('/dashboard/add_oligonucleotides');
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
					if (link != undefined) {

						if (link[j] != '#!' && link[j] != undefined) {
							if (checkDuplicate(link, link[j]) > 1) {
								req.flash('warning_msg', 'Duplicate articles are not allowed!');
								res.redirect('/dashboard/add_oligonucleotides');
							}
						}
						let objArticle = {
							'name': article[j],
							'pdf': false,
							'link': link[j]
						};
						articles.push(objArticle);
					}
				} else if (radio == 'pdf') {
					if (pdf != undefined) {

						if (pdf[j] != '#!' && pdf[j] != undefined) {
							if (checkDuplicate(pdf, pdf[j]) > 1) {
								req.flash('warning_msg', 'Duplicate articles are not allowed!');
								res.redirect('/dashboard/add_oligonucleotides');
							}
						}
						let objArticle = {
							'name': article[j],
							'pdf': true,
							'link': pdf[j]
						};
						articles.push(objArticle);
					}
				}
				if (note != undefined) {
					if (note[j])
						notes.push({ 'note': note[j] });
				} else {
					note = {};
				}
			}

			let obj = new Oligonucleotide({
				name,
				sequence,
				articles,
				blast,
				notes
			});

			obj
				.save()
				.then(() => {
					req.flash('success_msg', 'Added oligonucleotide successfully!');
					res.redirect('/dashboard/add_oligonucleotides');
				})
				.catch(err => {
					console.log(err);
				});
		}
	});
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
					if (link != undefined) {

						if (link[j] != '#!' && link[j] != undefined) {
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
					}
				} else if (radio == 'pdf') {
					if (pdf != undefined) {

						if (pdf[j] != '#!' && pdf[j] != undefined) {
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
	let pdfList = [];

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
		data: pagination(primers, 5)
	};
	res.render('./dashboard/manage_primers', ctx);
});

router.get('/manage_oligonucleotides', ensureAuthenticated, async (req, res) => {
	let pdfList = [];

	let page = req.query.page || 1;
	let perPage = req.query.perPage || 5;

	let maxPerPage = 10;
	let options = {
		page: parseInt(page, 10),
		limit: parseInt(perPage, 10) > maxPerPage ? maxPerPage : parseInt(perPage, 10),
		sort: { date: -1 }
	};

	const oligonucleotides = await Oligonucleotide.paginate({}, options);

	ctx = {
		layout: 'layout_dashboard',
		title: 'Manage Oligonucleotides',
		data: pagination(oligonucleotides, 5)
	};
	res.render('./dashboard/manage_oligonucleotides', ctx);
});

router.get('/manage_regions', ensureAuthenticated, async (req, res) => {
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
		title: 'Manage Target Regions',
		layout: 'layout_dashboard',
		data: pagination(region, 5)
	};
	res.render('./dashboard/manage_regions', ctx);
});

router.post('/upload_pdf', ensureAuthenticated, (req, res) => {
	upload_pdf(req, res, (err) => {
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

router.get('/edit/primer/:id', ensureAuthenticated, (req, res) => {
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
				title: 'Manage Primers',
				data: result[0],
				pdfList: data.Contents
			};
			res.render('./dashboard/edit_primers', ctx);
		});
	});
});

router.post('/edit/primer/:id', ensureAuthenticated, (req, res) => {
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
			if (link != undefined) {
				if (link[j] != '#!' && link[j] != undefined) {
					if (checkDuplicate(link, link[j]) > 1) {
						req.flash('warning_msg', 'Duplicate articles are not allowed!');
						res.redirect('/dashboard/edit/primer/' + req.params.id);
					}
					let objArticle = {
						'name': article[j],
						'pdf': false,
						'link': link[j]
					};
					articles.push(objArticle);
				}
			}
		} else if (radio == 'pdf') {
			if (pdf != undefined) {
				if (pdf[j] != '#!' && pdf[j] != undefined) {
					if (checkDuplicate(pdf, pdf[j]) > 1) {
						req.flash('warning_msg', 'Duplicate articles are not allowed!');
						res.redirect('/dashboard/edit/primer/' + req.params.id);
					}
				}
				let objArticle = {
					'name': article[j],
					'pdf': true,
					'link': pdf[j]
				};
				articles.push(objArticle);
			}
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
			res.redirect('/dashboard/edit/primer/' + req.params.id);
		} else {
			req.flash('success_msg', 'Primer updated successfully!');
			res.redirect('/dashboard/manage_primers');
		}
	});
});

router.get('/edit/oligonucleotide/:id', ensureAuthenticated, (req, res) => {
	Oligonucleotide.find({ _id: req.params.id }, (err, result) => {
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
				title: 'Manage Oligonucleotides',
				data: result[0],
				pdfList: data.Contents
			};
			res.render('./dashboard/edit_oligonucleotides', ctx);
		});
	});
});

router.post('/edit/oligonucleotide/:id', ensureAuthenticated, (req, res) => {
	let { name, sequence, article, link, pdf, blast, note } = req.body;
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
			if (link != undefined) {
				if (link[j] != '#!' && link[j] != undefined) {
					if (checkDuplicate(link, link[j]) > 1) {
						req.flash('warning_msg', 'Duplicate articles are not allowed!');
						res.redirect('/dashboard/edit/oligonucleotide/' + req.params.id);
					}
					let objArticle = {
						'name': article[j],
						'pdf': false,
						'link': link[j]
					};
					articles.push(objArticle);
				}
			}
		} else if (radio == 'pdf') {
			if (pdf != undefined) {
				if (pdf[j] != '#!' && pdf[j] != undefined) {
					if (checkDuplicate(pdf, pdf[j]) > 1) {
						req.flash('warning_msg', 'Duplicate articles are not allowed!');
						res.redirect('/dashboard/edit/oligonucleotide/' + req.params.id);
					}
				}
				let objArticle = {
					'name': article[j],
					'pdf': true,
					'link': pdf[j]
				};
				articles.push(objArticle);
			}
		}
		if (note != undefined) {
			if (note[j])
				notes.push({ 'note': note[j] });
		} else {
			note = {};
		}
	}

	let obj = {
		name,
		sequence,
		articles,
		blast,
		notes
	};

	Oligonucleotide.findByIdAndUpdate(req.params.id, obj, { new: true }, (err, result) => {
		if (err) {
			console.log(err);
			req.flash('warning_msg', 'Failed to update oligonucleotide!');
			res.redirect('/dashboard/edit/oligonucleotide/' + req.params.id);
		} else {
			req.flash('success_msg', 'Oligonucleotide updated successfully!');
			res.redirect('/dashboard/manage_oligonucleotides');
		}
	});
});

router.get('/edit/region/:id', ensureAuthenticated, (req, res) => {
	Region.find({ _id: req.params.id }, (err, result) => {
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
				title: 'Manage Target Regions',
				data: result[0],
				pdfList: data.Contents
			};
			res.render('./dashboard/edit_regions', ctx);
		});
	});
});

router.post('/edit/region/:id', ensureAuthenticated, (req, res) => {
	let { region, sequence, article, link, pdf, blast, unite, bold, phyto, note, primerName, primerSequence, primerBlast, primerNote, ampSequenceName, ampSequenceSequence, ampSequenceBlast, ampSequenceUnite, ampSequenceBold, ampSequencePhyto, ampSequenceNote } = req.body;

	sequence = sequence.trim();

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
			if (link != undefined) {

				if (link[j] != '#!' && link[j] != undefined) {
					if (checkDuplicate(link, link[j]) > 1) {
						req.flash('warning_msg', 'Duplicate articles are not allowed!');
						res.redirect('/dashboard/edit/region/' + req.params.id);
					}
				}
				let objArticle = {
					'name': article[j],
					'pdf': false,
					'link': link[j]
				};
				articles.push(objArticle);
			}
		} else if (radio == 'pdf') {
			if (pdf != undefined) {

				if (pdf[j] != '#!' && pdf[j] != undefined) {
					if (checkDuplicate(pdf, pdf[j]) > 1) {
						req.flash('warning_msg', 'Duplicate articles are not allowed!');
						res.redirect('/dashboard/edit/region/' + req.params.id);
					}
				}
				let objArticle = {
					'name': article[j],
					'pdf': true,
					'link': pdf[j]
				};
				articles.push(objArticle);
			}
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

	let obj = {
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
	};

	Region.findByIdAndUpdate(req.params.id, obj, { new: true }, (err, result) => {
		if (err) {
			console.log(err);
			req.flash('warning_msg', 'Failed to update target region!');
			res.redirect('/dashboard/edit/region/' + req.params.id);
		} else {
			req.flash('success_msg', 'Target region updated successfully!');
			res.redirect('/dashboard/manage_regions');
		}
	});

});

router.get('/delete/primer/:id', ensureAuthenticated, (req, res, next) => {
	Primer.findByIdAndDelete({ _id: req.params.id }, (err, result) => {
		if (err) {
			console.log(err);
			req.flash('error', 'Failed to delete primer!');
			res.redirect('/dashboard/manage_primers');
		} else {
			req.flash('success_msg', 'Primer deleted successfully!');
			res.redirect('/dashboard/manage_primers');
		}
	});
});

router.get('/delete/oligonucleotide/:id', ensureAuthenticated, (req, res, next) => {
	Oligonucleotide.findByIdAndDelete({ _id: req.params.id }, (err, result) => {
		if (err) {
			console.log(err);
			req.flash('error', 'Failed to delete oligonucleotide!');
			res.redirect('/dashboard/manage_oligonucleotides');
		} else {
			req.flash('success_msg', 'Oligonucleotide deleted successfully!');
			res.redirect('/dashboard/manage_oligonucleotides');
		}
	});
});

router.get('/delete/region/:id', ensureAuthenticated, (req, res, next) => {
	Region.findByIdAndDelete({ _id: req.params.id }, (err, result) => {
		if (err) {
			console.log(err);
			req.flash('error', 'Failed to delete region!');
			res.redirect('/dashboard/manage_regions');
		} else {
			req.flash('success_msg', 'Region deleted successfully!');
			res.redirect('/dashboard/manage_regions');
		}
	});
});

router.get('/delete/clustal/:id', ensureAuthenticated, (req, res, next) => {
	Clustal.findByIdAndDelete({ _id: req.params.id }, (err, result) => {
		if (err) {
			console.log(err);
			req.flash('error', 'Failed to delete clustal!');
			res.redirect('/dashboard/manage_clustal');
		} else {
			req.flash('success_msg', 'Clustal deleted successfully!');
			res.redirect('/dashboard/manage_clustal');
		}
	});
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
				title: 'Manage Primers',
				layout: 'layout_dashboard',
				data: result
			};
			res.render('./dashboard/manage_primers', ctx);
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
				title: 'Manage Primers',
				layout: 'layout_dashboard',
				data: result
			};
			res.render('./dashboard/manage_primers', ctx);
		});
	}
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
				title: 'Manage Oligonucleotides',
				layout: 'layout_dashboard',
				data: result
			};
			res.render('./dashboard/manage_oligonucleotides', ctx);
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
				title: 'Manage Oligonucleotides',
				layout: 'layout_dashboard',
				data: result
			};
			res.render('./dashboard/manage_oligonucleotides', ctx);
		});
	}
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
				title: 'Manage Target Regions',
				layout: 'layout_dashboard',
				data: result
			};
			res.render('./dashboard/manage_regions', ctx);
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
				title: 'Manage Target Regions',
				layout: 'layout_dashboard',
				data: result
			};
			res.render('./dashboard/manage_regions', ctx);
		});
	}
});

router.post('/upload_clustal', ensureAuthenticated, (req, res) => {
	upload_clustal(req, res, (err) => {
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

router.get('/manage_clustal', ensureAuthenticated, async (req, res) => {
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
		layout: 'layout_dashboard',
		title: 'CLUSTAL Data',
		data: clustal
	};
	res.render('./dashboard/manage_clustal', ctx);
});

router.get('/add_clustal', ensureAuthenticated, (req, res) => {
	let params = {
		Bucket: process.env.AWS_BUCKET_NAME,
		Prefix: 'clustal/'
	};
	s3.listObjectsV2(params, (err, data) => {
		if (err)
			return console.log(err);
		data.Contents.shift();
		let ctx = {
			layout: 'layout_dashboard',
			title: 'Insert CLUSTAL',
			fileList: data.Contents
		};
		res.render('./dashboard/add_clustal', ctx);
	});
});

router.post('/add_clustal', ensureAuthenticated, (req, res) => {
	const { clustalName, clustalFile, note } = req.body;
	if (!clustalName) {
		req.flash('warning_msg', 'CLUSTAL name not filled!');
		res.redirect('./dashboard/add_clustal');
	} else {
		let obj = new Clustal({
			'file.name': clustalName,
			'file.link': clustalFile,
			note
		});

		obj
			.save()
			.then(() => {
				req.flash('success_msg', 'Added CLUSTAL successfully!');
				res.redirect('/dashboard/add_clustal');
			})
			.catch(err => {
				console.log(err);
			});
	}
});

router.get('/edit/clustal/:id', ensureAuthenticated, (req, res) => {
	Clustal.findById(req.params.id, (err, result) => {
		if (err)
			return console.log(err);

		let params = {
			Bucket: process.env.AWS_BUCKET_NAME,
			Prefix: 'clustal/'
		};
		s3.listObjectsV2(params, (err, data) => {
			if (err)
				return console.log(err);
			data.Contents.shift();
			let ctx = {
				layout: 'layout_dashboard',
				title: 'CLUSTAL Data',
				fileList: data.Contents,
				data: result
			};
			res.render('./dashboard/edit_clustal', ctx);
		});
	});
});

router.post('/edit/clustal/:id', ensureAuthenticated, (req, res) => {
	const { clustalName, clustalFile, note } = req.body;
	if (!clustalName) {
		req.flash('warning_msg', 'CLUSTAL name not filled!');
		res.redirect('./dashboard/add_clustal');
	} else {
		let obj = {
			'file.name': clustalName,
			'file.link': clustalFile,
			note
		};

		Clustal.findByIdAndUpdate(req.params.id, obj, { new: true }, (err, result) => {
			if (err) {
				console.log(err);
				req.flash('warning_msg', 'Failed to update CLUSTAL!');
				res.redirect('/dashboard/edit/clustal/' + req.params.id);
			} else {
				req.flash('success_msg', 'CLUSTAL updated successfully!');
				res.redirect('/dashboard/manage_clustal');
			}
		});
	}
});

router.get('/export/csv/:type', ensureAuthenticated, (req, res) => {
	if (req.params.type == 'primers') {
		Primer.find().lean().exec((err, data) => {
			if (err)
				return console.log(err);
			const fields = ['primer', 'sequence', 'articles.0.name', 'articles.1.name', 'articles.2.name', 'articles.3.name', 'articles.4.name', 'blast', 'notes.0.note', 'notes.1.note', 'notes.2.note', 'notes.3.note', 'notes.4.note'];
			const opts = { fields, delimiter: ';', excelStrings: true };
			try {
				const parser = new Parser(opts);
				const csv = parser.parse(data);
				let fileName = 'primers-' + Date.now() + '.csv';
				fs.writeFile(fileName, csv, (err) => {
					if (err)
						return console.log(err);
					res.download(fileName, (err) => {
						if (err)
							return console.log(err);

						fs.unlink(fileName, (err) => {
							if (err)
								return console.log(err);
						});
					});
				});
			} catch (e) {
				console.log(e);
			}
		});
	} else if (req.params.type == 'oligonucleotides') {
		Oligonucleotide.find().lean().exec((err, data) => {
			if (err)
				return console.log(err);
			const fields = ['name', 'sequence', 'articles.0.name', 'articles.1.name', 'articles.2.name', 'articles.3.name', 'articles.4.name', 'blast', 'notes.0.note', 'notes.1.note', 'notes.2.note', 'notes.3.note', 'notes.4.note'];
			const opts = { fields, delimiter: ';', excelStrings: true };
			try {
				const parser = new Parser(opts);
				const csv = parser.parse(data);
				let fileName = 'oligonucleotides-' + Date.now() + '.csv';
				fs.writeFile(fileName, csv, (err) => {
					if (err)
						return console.log(err);
					res.download(fileName, (err) => {
						if (err)
							return console.log(err);

						fs.unlink(fileName, (err) => {
							if (err)
								return console.log(err);
						});
					});
				});
			} catch (e) {
				console.log(e);
			}
		});
	} else if (req.params.type == 'regions') {
		Region.find().lean().exec((err, data) => {
			if (err)
				return console.log(err);
			const fields = ['region', 'sequence', 'articles.0.name', 'articles.1.name', 'articles.2.name', 'articles.3.name', 'articles.4.name', 'blast', 'unite', 'bold', 'phyto', 'notes.0.note', 'notes.1.note', 'notes.2.note', 'notes.3.note', 'notes.4.note', 'primers.0.primer', 'primers.0.sequence', 'primers.0.blast', 'primers.0.notes', 'primers.1.primer', 'primers.1.sequence', 'primers.1.blast', 'primers.1.notes', 'primers.2.primer', 'primers.2.sequence', 'primers.2.blast', 'primers.2.notes', 'primers.3.primer', 'primers.3.sequence', 'primers.3.blast', 'primers.3.notes', 'primers.4.primer', 'primers.4.sequence', 'primers.4.blast', 'primers.4.notes', 'amp_sequences.0.name', 'amp_sequence.0.sequence', 'amp_sequence.0.blast', 'amp_sequence.0.unite', 'amp_sequence.0.boldsystems', 'amp_sequence.0.phytophthoradb', 'amp_sequence.0.notes', 'amp_sequences.1.name', 'amp_sequence.1.sequence', 'amp_sequence.1.blast', 'amp_sequence.1.unite', 'amp_sequence.1.boldsystems', 'amp_sequence.1.phytophthoradb', 'amp_sequence.1.notes', 'amp_sequences.2.name', 'amp_sequence.2.sequence', 'amp_sequence.2.blast', 'amp_sequence.2.unite', 'amp_sequence.2.boldsystems', 'amp_sequence.2.phytophthoradb', 'amp_sequence.2.notes', 'amp_sequences.3.name', 'amp_sequence.3.sequence', 'amp_sequence.3.blast', 'amp_sequence.3.unite', 'amp_sequence.3.boldsystems', 'amp_sequence.3.phytophthoradb', 'amp_sequence.3.notes', 'amp_sequences.4.name', 'amp_sequence.4.sequence', 'amp_sequence.4.blast', 'amp_sequence.4.unite', 'amp_sequence.4.boldsystems', 'amp_sequence.4.phytophthoradb', 'amp_sequence.4.notes'];
			const opts = { fields, delimiter: ';', excelStrings: true };
			try {
				const parser = new Parser(opts);
				const csv = parser.parse(data);
				let fileName = 'regions-' + Date.now() + '.csv';
				fs.writeFile(fileName, csv, (err) => {
					if (err)
						return console.log(err);
					res.download(fileName, (err) => {
						if (err)
							return console.log(err);

						fs.unlink(fileName, (err) => {
							if (err)
								return console.log(err);
						});
					});
				});
			} catch (e) {
				console.log(e);
			}
		});
	} else {
		req.flash('error', 'Failed to export to csv!');
		res.redirect('/dashboard');
	}
});

router.get('/export/json/:type', ensureAuthenticated, (req, res) => {
	if (req.params.type == 'primers') {
		Primer.find().lean().exec((err, data) => {
			if (err)
				return console.log(err);
			try {
				let fileName = 'primers-' + Date.now() + '.json';
				fs.writeFile(fileName, JSON.stringify(data), (err) => {
					if (err)
						return console.log(err);
					res.download(fileName, (err) => {
						if (err)
							return console.log(err);
						fs.unlink(fileName, (err) => {
							if (err)
								return console.log(err);
						});
					});
				});
			} catch (e) {
				console.log(e);
			}
		});
	} else if (req.params.type == 'oligonucleotides') {
		Oligonucleotide.find().lean().exec((err, data) => {
			if (err)
				return console.log(err);
			try {
				let fileName = 'oligonucleotides-' + Date.now() + '.json';
				fs.writeFile(fileName, JSON.stringify(data), (err) => {
					if (err)
						return console.log(err);
					res.download(fileName, (err) => {
						if (err)
							return console.log(err);
						fs.unlink(fileName, (err) => {
							if (err)
								return console.log(err);
						});
					});
				});
			} catch (e) {
				console.log(e);
			}
		});
	} else if (req.params.type == 'regions') {
		Region.find().lean().exec((err, data) => {
			if (err)
				return console.log(err);
			try {
				let fileName = 'regions-' + Date.now() + '.json';
				fs.writeFile(fileName, JSON.stringify(data), (err) => {
					if (err)
						return console.log(err);
					res.download(fileName, (err) => {
						if (err)
							return console.log(err);
						fs.unlink(fileName, (err) => {
							if (err)
								return console.log(err);
						});
					});
				});
			} catch (e) {
				console.log(e);
			}
		});
	} else {
		req.flash('error', 'Failed to export to json!');
		res.redirect('/dashboard');
	}
});

module.exports = router;