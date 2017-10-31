import assert from 'assert';
import Analytics from '../src';
import createServer from './server';

const { version } = require('../package.json');

let analytics;
const noop = function noop() {};

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
  before((done) => {
    createServer().then(done);
  });

  beforeEach(() => {
    analytics = new Analytics('key', {
      host: 'http://localhost:4063',
      flushAt: Infinity,
      flushAfter: Infinity,
    });
  });

  it('should expose a constructor', () => {
    assert.equal('function', typeof Analytics);
  });

  it('should require a write key', () => {
    assert.throws(() => new Analytics(), error('You must pass your Segment project\'s write key.'));
  });

  it('should create a queue', () => {
    assert.deepEqual(analytics.queue, []);
  });

  it('should set default options', () => {
    const analytics2 = new Analytics('key');
    assert.equal(analytics2.writeKey, 'key');
    assert.equal(analytics2.host, 'https://api.segment.io');
    assert.equal(analytics2.flushAt, 20);
    assert.equal(analytics2.flushAfter, 10000);
  });

  it('should take options', () => {
    const myEnricher = function enricher(message) { return { ...message }; };
    const analytics2 = new Analytics('key', {
      host: 'a',
      flushAt: 1,
      flushAfter: 2,
      enrich: myEnricher,
    });
    assert.equal(analytics2.host, 'a');
    assert.equal(analytics2.flushAt, 1);
    assert.equal(analytics2.flushAfter, 2);
    assert.equal(analytics2.enrich, myEnricher);
  });

  it('should keep the flushAt option above zero', () => {
    const analytics2 = new Analytics('key', { flushAt: 0 });
    assert.equal(analytics2.flushAt, 1);
  });

  describe('#enqueue', () => {
    it('should add a message to the queue', () => {
      const date = new Date();
      analytics.enqueue('type', { timestamp: date }, noop);

      const msg = analytics.queue[0].message;
      const { callback } = analytics.queue[0];

      assert.equal(callback, noop);
      assert.equal(msg.type, 'type');
      assert.deepEqual(msg.timestamp, date);
      assert.deepEqual(msg.context, context);
      assert(msg.messageId);
    });

    it('should not modify the original message', () => {
      const message = { event: 'test' };
      analytics.enqueue('type', message, noop);
      assert(!{}.hasOwnProperty.call(message, 'timestamp'));
    });

    it('should flush the queue if it hits the max length', (done) => {
      analytics.flushAt = 1;
      analytics.flushAfter = null;
      analytics.flush = done;
      analytics.enqueue('type', {});
    });

    it('should flush after a period of time', (done) => {
      analytics.flushAt = Infinity;
      analytics.flushAfter = 1;
      analytics.flush = done;
      analytics.enqueue('type', {});
    });

    it('should reset an existing timer', (done) => {
      let i = 0;
      analytics.flushAt = Infinity;
      analytics.flushAfter = 1;
      analytics.flush = () => { i += 1; };
      analytics.enqueue('type', {});
      analytics.enqueue('type', {});
      setTimeout(() => {
        assert.equal(1, i);
        done();
      }, 1);
    });

    it('should extend the given context', () => {
      analytics.enqueue('type', { event: 'test', context: { name: 'travis' } }, noop);
      assert.deepEqual(analytics.queue[0].message.context, {
        library: {
          name: 'analytics-react-native',
          version,
        },
        name: 'travis',
      });
    });

    it('should add a message id', () => {
      analytics.enqueue('type', { event: 'test' }, noop);

      const msg = analytics.queue[0].message;
      assert(msg.messageId);
      assert(/react-native-[a-zA-Z0-9]{32}/.test(msg.messageId));
    });

    it('shouldn\'t change the message id', () => {
      analytics.enqueue('type', { messageId: '123', event: 'test' }, noop);

      const msg = analytics.queue[0].message;

      assert(msg.messageId);
      assert(msg.messageId === '123');
    });

    it('should enrich the message if defined', () => {
      const analytics3 = new Analytics('key', {
        host: 'http://localhost:4063',
        flushAt: Infinity,
        flushAfter: Infinity,
        enrich: (message) => {
          const enrichedMessage = { ...message };
          enrichedMessage.userId = 'ABCD';
          return enrichedMessage;
        },
      });
      analytics3.enqueue('type', { messageId: '123', event: 'test' }, noop);
      const msg = analytics3.queue[0].message;
      assert(msg.messageId);
      assert(msg.messageId === '123');
      assert(msg.userId === 'ABCD');
    });
  });

  describe('#flush', () => {
    it('should not fail when no items are in the queue', (done) => {
      analytics.flush(done);
    });

    it('should send a batch of items', (done) => {
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
    });

    it('should callback with an HTTP error', (done) => {
      enqueue(analytics, ['error']);

      analytics.flush((err) => {
        assert(err);
        assert.equal(err.message, 'Bad Request');
        done();
      });
    });
  });

  describe('#identify', () => {
    it('should enqueue a message', () => {
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

    it('should validate a message', () => {
      assert.throws(analytics.identify, error('You must pass a message object.'));
    });

    it('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.identify({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });
  });

  describe('#group', () => {
    it('should enqueue a message', () => {
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

    it('should validate a message', () => {
      assert.throws(analytics.group, error('You must pass a message object.'));
    });

    it('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.group({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });

    it('should require a groupId', () => {
      assert.throws(() => {
        analytics.group({ userId: 'id' });
      }, error('You must pass a `groupId`.'));
    });
  });

  describe('#track', () => {
    it('should enqueue a message', () => {
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

    it('should handle a user ids given as a number', () => {
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

    it('should validate a message', () => {
      assert.throws(analytics.track, error('You must pass a message object.'));
    });

    it('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.track({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });

    it('should require an event', () => {
      assert.throws(() => {
        analytics.track({ userId: 'id' });
      }, error('You must pass an `event`.'));
    });
  });

  describe('#page', () => {
    it('should enqueue a message', () => {
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

    it('should validate a message', () => {
      assert.throws(analytics.page, error('You must pass a message object.'));
    });

    it('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.page({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });
  });

  describe('#screen', () => {
    it('should enqueue a message', () => {
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

    it('should validate a message', () => {
      assert.throws(analytics.screen, error('You must pass a message object.'));
    });

    it('should require a userId or anonymousId', () => {
      assert.throws(() => {
        analytics.screen({});
      }, error('You must pass either an `anonymousId` or a `userId`.'));
    });
  });

  describe('#alias', () => {
    it('should enqueue a message', () => {
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

    it('should validate a message', () => {
      assert.throws(analytics.alias, error('You must pass a message object.'));
    });

    it('should require a userId', () => {
      assert.throws(() => {
        analytics.alias({});
      }, error('You must pass a `userId`.'));
    });

    it('should require a previousId', () => {
      assert.throws(() => {
        analytics.alias({ userId: 'id' });
      }, error('You must pass a `previousId`.'));
    });
  });
});
