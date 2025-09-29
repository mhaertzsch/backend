const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const indexRouter = require('./routes/index');
const initDb = require('./initDb');

const app = express();

app.use(logger('dev'));
app.use(express.json());

app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.use('/api', indexRouter);

// führt beim Start das Datenbank Initialisierungs-Skript aus
initDb();
module.exports = app;
