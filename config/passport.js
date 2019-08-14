const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/user');

module.exports = (passport) => {
	passport.use(
		new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
			//Match user
			User.findOne({
				email: email
			}).then(user => {
				if (!user) {
					return done(null, false, { message: 'That email is not registered!' });
				}

				//Match password
				bcrypt.compare(password, user.password, (err, isMatch) => {
					if (err)
						return res.status(400).send(err);
					if (isMatch) {
						return done(null, user);
					} else {
						return done(null, false, { message: 'Wrong password!' });
					}
				});
			});
		})
	);

	passport.serializeUser((user, done) => {
		done(null, user.id);
	});

	passport.deserializeUser((id, done) => {
		User.findById(id, (err, user) => {
			done(err, user);
		});
	});
};