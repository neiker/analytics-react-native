import base64 from 'base-64';

import axios from 'axios';
import axiosRetry from 'axios-retry';

import assert from './helpers/assert';
import validate from './helpers/validate';
import uid from './helpers/uid';

axiosRetry(axios, { retries: 3 });

// TODO move this to /test
const { Platform } = process.env.NODE_ENV === 'test'
  ? { Platform: { OS: 'react-native' } }
  // eslint-disable-next-line import/no-unresolved
  : require('react-native');

const VERSION = require('../package.json').version;

const noop = () => {};

/**
 * Expose an `Analytics` client.
 */
export default class Analytics {
  /**
   * Initialize a new `Analytics` with your Segment project's `writeKey` and an
   * optional dictionary of `options`.
   *
   * @param {String} writeKey
   * @param {Object} options (optional)
   *   @property {Number} flushAt (default: 20)
   *   @property {Number} flushAfter (default: 10000)
   *   @property {String} host (default: 'https://api.segment.io')
   */

  constructor(
    writeKey,
    {
      host = Analytics.DEFAULT_HOST,
      flushAt = Analytics.DEFAULT_FLUSH_AT,
      flushAfter = Analytics.DEFAULT_FLUSH_AFTER,
    } = {},
  ) {
    assert(
      writeKey,
      'You must pass your Segment project\'s write key.',
    );

    this.queue = [];

    this.writeKey = writeKey;

    this.host = host;
    this.flushAt = Math.max(flushAt, 1);
    this.flushAfter = flushAfter;
  }

  /**
   * Send an identify `message`.
   *
   * @param {Object} message
   * @param {Function} callback (optional)
   * @return {Analytics}
   */

  identify(message, callback) {
    this.enqueue('identify', message, callback);

    return this;
  }

  /**
   * Send a group `message`.
   *
   * @param {Object} message
   * @param {Function} callback (optional)
   * @return {Analytics}
   */

  group(message, callback) {
    this.enqueue('group', message, callback);

    return this;
  }

  /**
   * Send a track `message`.
   *
   * @param {Object} message
   * @param {Function} callback (optional)
   * @return {Analytics}
   */

  track(message, callback) {
    this.enqueue('track', message, callback);

    return this;
  }

  /**
   * Send a page `message`.
   *
   * @param {Object} message
   * @param {Function} callback (optional)
   * @return {Analytics}
   */

  page(message, callback) {
    this.enqueue('page', message, callback);

    return this;
  }

  /**
   * Send a screen `message`.
   *
   * @param {Object} message
   * @param {Function} callback (optional)
   * @return {Analytics}
   */

  screen(message, callback) {
    this.enqueue('screen', message, callback);

    return this;
  }

  /**
   * Send an alias `message`.
   *
   * @param {Object} message
   * @param {Function} callback (optional)
   * @return {Analytics}
   */

  alias(message, callback) {
    this.enqueue('alias', message, callback);

    return this;
  }

  /**
   * Flush the current queue and callback `callback(err, batch)`.
   *
   * @param {Function} callback (optional)
   * @return {Analytics}
   */

  flush(flushCallback = noop) {
    if (!this.queue.length) {
      return setImmediate(flushCallback);
    }

    const queuedItems = this.queue.splice(0, this.flushAt);

    const callbacks = queuedItems.map(item => item.callback);
    callbacks.push(flushCallback);

    const data = {
      batch: queuedItems.map(item => item.message),
      timestamp: new Date(),
      sentAt: new Date(),
    };

    axios(
      `${this.host}/v1/batch`,
      {
        data,
        method: 'post',
        headers: {
          Authorization: `Basic ${base64.encode(this.writeKey)}`,
          'Content-Type': 'application/json; charset=utf-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
    )
      .then(() => {
        callbacks.forEach((callback) => {
          callback(undefined, data);
        });
      })
      .catch((error) => {
        callbacks.forEach((callback) => {
          callback(error);
        });
      });

    return true;
  }

  /**
   * Add a `message` of type `type` to the queue and check whether it should be
   * flushed.
   *
   * @param {String} messageType
   * @param {Object} message
   * @param {Functino} callback (optional)
   * @api private
   */

  enqueue(messageType, msg, callback = noop) {
    validate(msg, messageType);

    const message = { ...msg };

    message.type = messageType;
    message.context = message.context ? { ...message.context } : {};
    message.context.library = {
      name: `analytics-${Platform.OS}`,
      version: VERSION,
    };

    if (!message.timestamp) {
      message.timestamp = new Date();
    }

    if (!message.messageId) {
      message.messageId = `${Platform.OS}-${uid(32)}`;
    }

    this.queue.push({
      message,
      callback,
    });

    if (this.queue.length >= this.flushAt) {
      this.flush();
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (this.flushAfter) {
      this.timer = setTimeout(() => this.flush(), this.flushAfter);
    }
  }
}

Analytics.DEFAULT_HOST = 'https://api.segment.io';

Analytics.DEFAULT_FLUSH_AT = 20;

Analytics.DEFAULT_FLUSH_AFTER = 10000;
