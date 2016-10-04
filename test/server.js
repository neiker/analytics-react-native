/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */

const express = require('express');
const bodyParser = require('body-parser');

const PORT = 4063;

/**
 * Fixture.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {Funtion} next
 */

function fixture(req, res) {
  const batch = req.body.batch;

  if (batch[0] === 'error') {
    return res.status(400).json({ error: { message: 'error' } });
  }

  return res.json({});
}

/**
 * App.
 */

export default function server() {
  return new Promise((resolve) => {
    express()
      .use(bodyParser.json())
      .post('/v1/batch', fixture)
      .listen(PORT, resolve);
  });
}
