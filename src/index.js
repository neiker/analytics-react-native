import assert from 'assert';
import base64 from 'base-64';

import validate from './helpers/validate';
import fetchRetry from './helpers/fetch-retry';
import uid from './helpers/uid';
import parseResponse from './helpers/parse-response';

const VERSION = require('../package.json').version;

const noop = () => {};

/**
 * Expose an `Analytics` client.
 */
export default class Analytics {
  static DEFAULT_HOST = 'https://api.segment.io';
  static DEFAULT_FLUSH_AT = 20;
  static DEFAULT_FLUSH_AFTER = 10000;

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
   * @param {Function} fn (optional)
   * @return {Analytics}
   */

  identify(message, fn) {
    validate(message);

    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );

    this.enqueue('identify', message, fn);

    return this;
  }

  /**
   * Send a group `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Analytics}
   */

  group(message, fn) {
    validate(message);

    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );
    assert(
      message.groupId,
      'You must pass a `groupId`.',
    );

    this.enqueue('group', message, fn);
    return this;
  }

  /**
   * Send a track `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Analytics}
   */

  track(message, fn) {
    validate(message);

    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );
    assert(
      message.event,
      'You must pass an `event`.',
    );

    this.enqueue('track', message, fn);
    return this;
  }

  /**
   * Send a page `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Analytics}
   */

  page(message, fn) {
    validate(message);

    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );

    this.enqueue('page', message, fn);
    return this;
  }

  /**
   * Send a screen `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Analytics}
   */

  screen(message, fn) {
    validate(message);

    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );

    this.enqueue('screen', message, fn);
    return this;
  }

  /**
   * Send an alias `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Analytics}
   */

  alias(message, fn) {
    validate(message);

    assert(
      message.userId,
      'You must pass a `userId`.',
    );
    assert(
      message.previousId,
      'You must pass a `previousId`.',
    );

    this.enqueue('alias', message, fn);

    return this;
  }

  /**
   * Flush the current queue and callback `fn(err, batch)`.
   *
   * @param {Function} fn (optional)
   * @return {Analytics}
   */

  flush(callback = noop) {
    if (!this.queue.length) {
      return setImmediate(callback);
    }

    const items = this.queue.splice(0, this.flushAt);

    const fns = items.map(item => item.callback);
    fns.push(callback);

    const batch = items.map(item => item.message);

    const data = {
      batch,
      timestamp: new Date(),
      sentAt: new Date(),
    };

    fetchRetry(
      `${this.host}/v1/batch`,
      {
        body: JSON.stringify(data),
        method: 'post',
        headers: {
          Authorization: `Basic ${base64.encode(this.writeKey)}`,
          'Content-Type': 'application/json; charset=utf-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        retries: 5,
      },
    )
    .then(parseResponse)
    .then(() => {
      fns.forEach((fn) => {
        fn(undefined, data);
      });
    })
    .catch((error) => {
      fns.forEach((fn) => {
        fn(error);
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
   * @param {Functino} fn (optional)
   * @api private
   */

  enqueue(messageType, msg, fn = noop) {
    const message = { ...msg };

    message.type = messageType;
    message.context = message.context ? { ...message.context } : {};
    message.context.library = {
      name: 'analytics-react-native',
      version: VERSION,
    };

    if (!message.timestamp) {
      message.timestamp = new Date();
    }

    if (!message.messageId) {
      message.messageId = `react-native-${uid(32)}`;
    }

    this.queue.push({
      message,
      callback: fn,
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
