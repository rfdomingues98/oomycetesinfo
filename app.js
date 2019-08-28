const createError = require('http-errors');
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const paginate = require('express-paginate');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
const MongoStore = require('connect-mongo')(session);


const port = process.env.PORT || 3000;

dotenv.config();


// Passport config
require('./config/passport')(passport);

// db setup
mongoose.connect(
	process.env.MONGODB_URI,
	{
		useNewUrlParser: true,
		useCreateIndex: true
	},
	() => {
		console.log("Connected to MongoDB");
	},
	err => {
		console.log(err);
	}
);

const app = express();


// Router Setup
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const dashboardRouter = require('./routes/dashboard');

// App config
app.set('views', path.join(__dirname, 'views/pages'));
app.set('view engine', 'ejs');

app.use(expressLayouts);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Paginate Middleware
app.use(paginate.middleware(10, 20));

// Express Session
app.use(session({
	store: new MongoStore({ mongooseConnection: mongoose.connection }),
	secret: process.env.SESSION_SECRET,
	resave: 'true',
	saveUninitialized: 'true',
	maxAge: 24 * 60 * 60 * 1000
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Setup flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
	res.locals.success_msg = req.flash('success_msg');
	res.locals.warning_msg = req.flash('warning_msg');
	res.locals.error = req.flash('error');
	next();
});

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/dashboard', dashboardRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
	next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
});

module.exports = app;