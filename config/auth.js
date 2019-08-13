module.exports = {
	ensureAuthenticated: (req, res, next) => {
		if (req.isAuthenticated()) {
			return next();
		}
		req.flash('warning_msg', 'Login required!');
		res.redirect('/users/login');

	},
	forwardAuthenticated: function (req, res, next) {
		if (!req.isAuthenticated()) {
			return next();
		}
		res.redirect('/dashboard');
	}
}
