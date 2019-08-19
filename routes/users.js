const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const { forwardAuthenticated } = require('../config/auth');

const User = require('../models/user');

router.get('/register', forwardAuthenticated, (req, res, next) => {

	res.render('register', { title: 'Sign-up' });
});

router.post('/register', (req, res, next) => {
	const { firstName, lastName, email, password, password2, code } = req.body;

	if (!firstName || !lastName || !email || !password || !password2 || !code) {
		req.flash('warning_msg', 'All fields should be filled!');
		res.redirect('./register');
	} else if (password !== password2) {
		req.flash('warning_msg', 'Passwords don\'t match!');
		res.redirect('./register');
	} else if (password.length < 8 || !/\d/.test(password)) {
		req.flash('warning_msg', 'Password should have at least 8 characters & 1 digit!');
		res.redirect('./register');
	} else {
		User.findOne({ email: email })
			.then(user => {
				if (user) {
					req.flash('warning_msg', 'E-mail already exists!');
					res.redirect('./register');
				} else {
					if (code != process.env.REGISTER_CODE) {
						req.flash('warning_msg', 'Register Code invalid');
						res.redirect('./register');
					} else {

						const userData = new User({
							firstName,
							lastName,
							email,
							password,
						});

						bcrypt.genSalt(10, (err, salt) => {
							bcrypt.hash(userData.password, salt, (err, hash) => {
								if (err)
									return res.status(400).send(err);
								userData.password = hash;
								userData
									.save()
									.then(user => {
										req.flash('success_msg', 'Account created successfully!');
										res.redirect('./login');
									}).catch(err => console.log(err));
							});
						});
					}
				}
			});
	}
});

router.get('/login', forwardAuthenticated, (req, res, next) => {
	res.render('login', { title: 'Sign-in' });
});

router.post('/login', (req, res, next) => {
	passport.authenticate('local', {
		successRedirect: '/dashboard',
		failureRedirect: './login',
		failureFlash: true
	})(req, res, next);
});

router.get('/logout', (req, res) => {
	req.logout();
	req.flash('success_msg', 'Successfully logged out!');
	res.redirect('./login');
});

module.exports = router;