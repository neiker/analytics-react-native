import mockAxios from 'jest-mock-axios';

/* eslint-env jest */

import assert from 'assert';
import Analytics from '.';

const { version } = require('../package.json');

const MAX_VALID_INTEGER = 500;

let analytics;
function noop() {}

const id = 'id';
const context = {
  library: {
    name: 'analytics-react-native',
    version,
  },
};

/**
 * Create a queue with `messages`.
 *
 * @param {Analytics} a
 * @param {Array} messages
 * @return {Array}
 */

function enqueue(a, messages) {
  analytics.queue = messages.map(msg => ({
    message: msg,
    callback: noop,
  }));
}

/**
 * Assert an error with `message` is thrown.
 *
 * @param {String} message
 * @return {Function}
 */

function error(message) {
  return err => err.message === message;
}

describe('Analytics', () => {
  beforeEach(() => {
    analytics = new Analytics('key', {
      host: 'http://localhost:4063',
      flushAt: MAX_VALID_INTEGER,
      flushAfter: MAX_VALID_INTEGER,
    });
  });

  afterEach(() => {
    mockAxios.reset();
  });

  test('should expose a constructor', () => {
    assert.equal('function', typeof Analytics);
  });

  test('should require a write key', () => {
    assert.throws(() => new Analytics(), error('You must pass your Segment project\'s write key.'));
  });

  test('should create a queue', () => {
    assert.deepEqual(analytics.queue, []);
  });

  test('should set default options', () => {
    const analytics2 = new Analytics('key');
    assert.equal(analytics2.writeKey, 'key');
    assert.equal(analytics2.host, 'https://api.segment.io');
    assert.equal(analytics2.flushAt, 20);
    assert.equal(analytics2.flushAfter, 10000);
  });

  test('should take options', () => {
    const analytics2 = new Analytics('key', {
      host: 'a',
      flushAt: 1,
      flushAfter: 2,
    });
    assert.equal(analytics2.host, 'a');
    assert.equal(analytics2.flushAt, 1);
    assert.equal(analytics2.flushAfter, 2);
  });

  test('should keep the flushAt option above zero', () => {
    const analytics2 = new Analytics('key', { flushAt: 0 });
    assert.equal(analytics2.flushAt, 1);
  });

  describe('#enqueue', () => {
    test('should add a message to the queue', () => {
      const date = new Date();
      analytics.enqueue('screen', { timestamp: date, userId: '1' }, noop);

      const msg = analytics.queue[0].message;
      const { callback } = analytics.queue[0];

      assert.equal(callback, noop);
      assert.equal(msg.type, 'screen');
      assert.deepEqual(msg.timestamp, date);
      assert.deepEqual(msg.context, context);
      assert(msg.messageId);
    });

    test('should not modify the original message', () => {
      const message = { event: 'test', userId: '1' };
      analytics.enqueue('screen', message, noop);
      assert(!{}.hasOwnProperty.call(message, 'timestamp'));
    });

    test('should flush the queue if it hits the max length', (done) => {
      analytics.flushAt = 1;
      analytics.flushAfter = null;
      analytics.flush = done;
      analytics.enqueue('screen', { userId: '1' });
    });

    test('should flush after a period of time', (done) => {
      analytics.flushAt = MAX_VALID_INTEGER;
      analytics.flushAfter = 1;
      analytics.flush = done;
      analytics.enqueue('screen', { userId: '1' });
    });

    test('should reset an existing timer', (done) => {
      let i = 0;
      analytics.flushAt = MAX_VALID_INTEGER;
      analytics.flushAfter = 1;
      analytics.flush = () => { i += 1; };
      analytics.enqueue('screen', { userId: '1' });
      analytics.enqueue('screen', { userId: '1' });
      setTimeout(() => {
        assert.equal(1, i);
        done();
      }, 1);
    });

    test('should extend the given context', () => {
      analytics.enqueue('screen', { event: 'test', userId: '1', context: { name: 'travis' } }, noop);
      assert.deepEqual(analytics.queue[0].message.context, {
        library: {
          name: 'analytics-react-native',
          version,
        },
        name: 'travis',
      });
    });

    test('should add a message id', () => {
      analytics.enqueue('screen', { event: 'test', userId: '1' }, noop);

      const msg = analytics.queue[0].message;
      assert(msg.messageId);
      assert(/react-native-[a-zA-Z0-9]{32}/.test(msg.messageId));
    });

    test('shouldn\'t change the message id', () => {
      analytics.enqueue('screen', { messageId: '123', event: 'test', userId: '1' }, noop);

      const msg = analytics.queue[0].message;

      assert(msg.messageId);
      assert(msg.messageId === '123');
    });
  });

  describe('#flush', () => {
    test('should not fail when no items are in the queue', (done) => {
      analytics.flush(done);
    });

    test('should send a batch of items', (done) => {
      analytics.flushAt = 2;
      enqueue(analytics, [1, 2, 3]);

      analytics.flush((err, data) => {
        if (err) {
          return done(err);
        }

        assert.deepEqual(data.batch, [1, 2]);
        assert(data.timestamp instanceof Date);
        assert(data.sentAt instanceof Date);

        return done();
      });

      mockAxios.mockResponse({});
    });

    test('should callback with an HTTP error', (done) => {
      enqueue(analytics, ['error']);

      analytics.flush((err) => {
        assert(err);
        assert.equal(err.statusText, 'Bad Request');
        done();
      });

      mockAxios.mockError({ status: 404, statusText: 'Bad Request' });
    });
  });

  describe('#identify', () => {
    test('should enqueue a message', () => {
      const date = new Date();
      analytics.identify({ userId: 'id', timestamp: date, messageId: id });
      assert.deepEqual(analytics.queue[0].message, {
        type: 'identify',
        userId: 'id',
        timestamp: date,
        context,
        messageId: id,
      });
    });

    test('should validate a message', () => {
      assert.throws(() => {
        analytics.identify();
      }, error('You must pass a message object.'));
    });

    test('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.identify({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });
  });

  describe('#group', () => {
    test('should enqueue a message', () => {
      const date = new Date();
      analytics.group({
        groupId: 'group', userId: 'user', timestamp: date, messageId: id,
      });
      assert.deepEqual(analytics.queue[0].message, {
        type: 'group',
        userId: 'user',
        groupId: 'group',
        timestamp: date,
        context,
        messageId: id,
      });
    });

    test('should validate a message', () => {
      assert.throws(() => {
        analytics.group();
      }, error('You must pass a message object.'));
    });

    test('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.group({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });

    test('should require a groupId', () => {
      assert.throws(() => {
        analytics.group({ userId: 'id' });
      }, error('You must pass a `groupId`.'));
    });
  });

  describe('#track', () => {
    test('should enqueue a message', () => {
      const date = new Date();
      analytics.track({
        userId: 'id', event: 'event', timestamp: date, messageId: id,
      });
      assert.deepEqual(analytics.queue[0].message, {
        type: 'track',
        event: 'event',
        userId: 'id',
        timestamp: date,
        context,
        messageId: id,
      });
    });

    test('should handle a user ids given as a number', () => {
      const date = new Date();
      analytics.track({
        userId: 1, event: 'jumped the shark', timestamp: date, messageId: id,
      });
      assert.deepEqual(analytics.queue[0].message, {
        userId: 1,
        event: 'jumped the shark',
        type: 'track',
        timestamp: date,
        context,
        messageId: id,
      });
    });

    test('should validate a message', () => {
      assert.throws(() => {
        analytics.track();
      }, error('You must pass a message object.'));
    });

    test('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.track({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });

    test('should require an event', () => {
      assert.throws(() => {
        analytics.track({ userId: 'id' });
      }, error('You must pass an `event`.'));
    });
  });

  describe('#page', () => {
    test('should enqueue a message', () => {
      const date = new Date();
      analytics.page({ userId: 'id', timestamp: date, messageId: id });
      assert.deepEqual(analytics.queue[0].message, {
        type: 'page',
        userId: 'id',
        timestamp: date,
        context,
        messageId: id,
      });
    });

    test('should validate a message', () => {
      assert.throws(() => {
        analytics.page();
      }, error('You must pass a message object.'));
    });

    test('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.page({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });
  });

  describe('#screen', () => {
    test('should enqueue a message', () => {
      const date = new Date();
      analytics.screen({ userId: 'id', timestamp: date, messageId: id });
      assert.deepEqual(analytics.queue[0].message, {
        type: 'screen',
        userId: 'id',
        timestamp: date,
        context,
        messageId: id,
      });
    });

    test('should validate a message', () => {
      assert.throws(() => {
        analytics.screen();
      }, error('You must pass a message object.'));
    });

    test('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.screen({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });
  });

  describe('#alias', () => {
    test('should enqueue a message', () => {
      const date = new Date();
      analytics.alias({
        previousId: 'previous', userId: 'id', timestamp: date, messageId: id,
      });
      assert.deepEqual(analytics.queue[0].message, {
        type: 'alias',
        previousId: 'previous',
        userId: 'id',
        timestamp: date,
        context,
        messageId: id,
      });
    });

    test('should validate a message', () => {
      assert.throws(() => {
        analytics.alias();
      }, error('You must pass a message object.'));
    });

    test('should require a userId', () => {
      assert.throws(() => {
        analytics.alias({});
      }, error('You must pass a `userId`.'));
    });

    test('should require a previousId', () => {
      assert.throws(() => {
        analytics.alias({ userId: 'id' });
      }, error('You must pass a `previousId`.'));
    });
  });
});
