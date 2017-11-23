import base64 from 'base-64';

import assert from './helpers/assert';
import validate from './helpers/validate';
import fetchRetry from './helpers/fetch-retry';
import uid from './helpers/uid';
import parseResponse from './helpers/parse-response';

// TODO move this to /test
const { Platform } = process.env.NODE_ENV === 'test' ? { Platform: { OS: 'react-native' } } : require('react-native');

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
   * @param {String} writeKey (optional - won't send if not set)
   * @param {Object} options (optional)
   *   @property {Number} flushAt (default: 20)
   *   @property {Number} flushAfter (default: 10000)
   *   @property {String} host (default: 'https://api.segment.io')
   *   @property {Function | Object} enrich
   */

  constructor(
    writeKey,
    {
      host = Analytics.DEFAULT_HOST,
      flushAt = Analytics.DEFAULT_FLUSH_AT,
      flushAfter = Analytics.DEFAULT_FLUSH_AFTER,
      enrich = {},
    } = {},
  ) {
    this.queue = [];

    this.writeKey = writeKey;

    this.host = host;
    this.flushAt = Math.max(flushAt, 1);
    this.flushAfter = flushAfter;
    this.enrich = enrich;
  }
  /**
   * Send an identify `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Promise} resolves to Analytics
   */

  identify(message, fn) {
    return this.enqueue('identify', message, fn)
      .then(() => this);
  }

  /**
   * Send a group `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Promise} resolves to Analytics
   */

  group(message, fn) {
    return Promise.resolve(message)
      .then(() => {
        assert(
          message.groupId,
          'You must pass a `groupId`.',
        );
      })
      .then(() => this.enqueue('group', message, fn))
      .then(() => this);
  }

  /**
   * Send a track `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Promise} resolves to Analytics
   */

  track(message, fn) {
    return Promise.resolve(message)
      .then(() => {
        assert(
          message.event,
          'You must pass a `event`.',
        );
      })
      .then(() => this.enqueue('track', message, fn))
      .then(() => this);
  }

  /**
   * Send a page `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Promise} resolves to Analytics
   */

  page(message, fn) {
    return this.enqueue('page', message, fn)
      .then(() => this);
  }

  /**
   * Send a screen `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Promise} resolves to Analytics
   */

  screen(message, fn) {
    return this.enqueue('screen', message, fn)
      .then(() => this);
  }

  /**
   * Send an alias `message`.
   *
   * @param {Object} message
   * @param {Function} fn (optional)
   * @return {Promise} resolves to Analytics
   */

  alias(message, fn) {
    return Promise.resolve(message)
      .then(() => {
        assert(
          message.userId,
          'You must pass a `userId`.',
        );
        assert(
          message.previousId,
          'You must pass a `previousId`.',
        );
      })
      .then(() => this.enqueue('alias', message, fn))
      .then(() => this);
  }

  /**
   * Flush the current queue and callback `fn(err, batch)`.
   *
   * @param {Function} callback (optional)
   * @return {Boolean}
   */

  flush(callback = noop) {
    if (!this.queue.length || !this.writeKey) {
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
   * @param {Object} msg
   * @param {Function} fn (optional)
   * @return {Promise}
   * @api private
   */

  enqueue(messageType, msg, fn = noop) {
    validate(msg);
    const message = { ...msg };

    const enricher = this.enrich instanceof Function ? this.enrich() : this.enrich;

    return Promise.resolve(enricher)
      .then((extraProperties) => {
        Object.assign(message, extraProperties);
      })
      .then(() => {
        assert(
          message.anonymousId || message.userId,
          'You must pass either an `anonymousId` or a `userId`.',
        );

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
      });
  }
}
