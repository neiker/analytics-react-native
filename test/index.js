import assert from 'assert';
import Analytics from '../src';
import createServer from './server';

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { version } = require('../package.json');

const expect = chai.expect;
chai.use(chaiAsPromised);

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
      enrich: {},
    });
  });

  it('should expose a constructor', () => {
    assert.equal('function', typeof Analytics);
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
    const myEnricher = {};
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
    it('should validate a message', () => {
      assert.throws(() => {
        analytics.enqueue('type', null);
      }, error('You must pass a message object.'));
    });

    it('should require a userId or anonymousId', () => {
      expect(analytics.enqueue('type', {}))
        .to.be.rejectedWith('You must pass either an `anonymousId` or a `userId`.');
    });

    it('should add a message to the queue', (done) => {
      const date = new Date();
      analytics.enqueue('type', { timestamp: date, userId: 1 }, noop)
        .then(() => {
          const msg = analytics.queue[0].message;
          const { callback } = analytics.queue[0];
          assert.equal(callback, noop);
          assert.equal(msg.type, 'type');
          assert.deepEqual(msg.timestamp, date);
          assert.deepEqual(msg.userId, 1);
          assert.deepEqual(msg.context, context);
          assert(msg.messageId);
        })
        .then(() => done(), done);
    });

    it('should not modify the original message', (done) => {
      const message = { event: 'test', userId: 1 };
      analytics.enqueue('type', message, noop)
        .then(() => {
          assert(!{}.hasOwnProperty.call(message, 'timestamp'));
        })
        .then(() => done(), done);
    });

    it('should flush the queue if it hits the max length', (done) => {
      analytics.flushAt = 1;
      analytics.flushAfter = null;
      analytics.flush = done;
      analytics.enqueue('type', { userId: 1 });
    });

    it('should flush after a period of time', (done) => {
      analytics.flushAt = Infinity;
      analytics.flushAfter = 1;
      analytics.flush = done;
      analytics.enqueue('type', { userId: 1 });
    });

    it('should reset an existing timer', (done) => {
      let i = 0;
      analytics.flushAt = Infinity;
      analytics.flushAfter = 1;
      analytics.flush = () => { i += 1; };
      analytics.enqueue('type', { userId: 1 })
        .then(analytics.enqueue('type', { userId: 1 }))
        .then(() => {
          setTimeout(() => {
            assert.equal(1, i);
            done();
          }, 1);
        });
    });

    it('should extend the given context', (done) => {
      analytics.enqueue('type', { event: 'test', context: { name: 'travis' }, userId: 1 }, noop)
        .then(() => {
          assert.deepEqual(analytics.queue[0].message.context, {
            library: {
              name: 'analytics-react-native',
              version,
            },
            name: 'travis',
          });
        })
        .then(() => done(), done);
    });

    it('should add a message id', (done) => {
      analytics.enqueue('type', { event: 'test', userId: 1 }, noop)
        .then(() => {
          const msg = analytics.queue[0].message;
          assert(msg.messageId);
          assert(/react-native-[a-zA-Z0-9]{32}/.test(msg.messageId));
        })
        .then(() => done(), done);
    });

    it('shouldn\'t change the message id', (done) => {
      analytics.enqueue('type', { messageId: '123', event: 'test', userId: 1 }, noop)
        .then(() => {
          const msg = analytics.queue[0].message;
          assert(msg.messageId);
          assert(msg.messageId === '123');
        })
        .then(() => done(), done);
    });

    it('should enrich the message if defined with a promise', (done) => {
      let count = 0
      const analytics3 = new Analytics('key', {
        host: 'http://localhost:4063',
        flushAt: Infinity,
        flushAfter: Infinity,
        enrich: () => new Promise((resolve) => {
          const enrichedMessage = { };
          return Promise.resolve({})
            .then(() => {
              count += 1;
              enrichedMessage.userId = count;
            })
            .finally(() => resolve(enrichedMessage));
        }),
      });
      analytics3.enqueue('type', { messageId: '123', event: 'test' }, noop)
        .then(() => {
          const msg = analytics3.queue[0].message;
          assert(msg.messageId);
          assert(msg.messageId === '123');
          assert(msg.userId === 1);
        })
        .then(() => analytics3.enqueue('type', { messageId: '456', event: 'test' }, noop))
        .then(() => {
          const msg = analytics3.queue[1].message;
          assert(msg.messageId);
          assert(msg.messageId === '456');
          assert(msg.userId === 2);
        })
        .then(() => done(), done);
    });

    it('should enrich the message if defined with a object', (done) => {
      const analytics4 = new Analytics('key', {
        host: 'http://localhost:4063',
        flushAt: Infinity,
        flushAfter: Infinity,
        enrich: {
          userId: 'ABCD',
        },
      });
      analytics4.enqueue('type', { messageId: '123', event: 'test' }, noop)
        .then(() => {
          const msg = analytics4.queue[0].message;
          assert(msg.messageId);
          assert(msg.messageId === '123');
          assert(msg.userId === 'ABCD');
        }).then(() => done(), done);
    });
  });

  describe('#flush', () => {
    it('should not fail when no items are in the queue', (done) => {
      analytics.flush(done);
    });

    it('should not fail when no writeKey is set', (done) => {
      const noWritekeyAnalytics = new Analytics(null, {
        host: 'http://localhost:4063',
        flushAt: Infinity,
        flushAfter: Infinity,
        enrich: {},
      })
      analytics.flushAt = 2;
      enqueue(noWritekeyAnalytics, [1, 2, 3]);
      noWritekeyAnalytics.flush(done);
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
    it('should enqueue a message', (done) => {
      const date = new Date();
      analytics.identify({ userId: 'id', timestamp: date, messageId: id })
        .then(() => {
          assert.deepEqual(analytics.queue[0].message, {
            type: 'identify',
            userId: 'id',
            timestamp: date,
            context,
            messageId: id,
          });
        })
        .then(() => done(), done);
    });
  });

  describe('#group', () => {
    it('should enqueue a message', (done) => {
      const date = new Date();
      analytics.group({
        groupId: 'group', userId: 'user', timestamp: date, messageId: id,
      }).then(() => {
        assert.deepEqual(analytics.queue[0].message, {
          type: 'group',
          userId: 'user',
          groupId: 'group',
          timestamp: date,
          context,
          messageId: id,
        });
      }).then(() => done(), done);
    });

    it('should require a groupId', () => {
      expect(analytics.group({ userId: 'id' }))
        .to.be.rejectedWith('You must pass a `groupId`.');
    });
  });

  describe('#track', () => {
    it('should enqueue a message', (done) => {
      const date = new Date();
      analytics.track({
        userId: 'id', event: 'event', timestamp: date, messageId: id,
      }).then(() => {
        assert.deepEqual(analytics.queue[0].message, {
          type: 'track',
          event: 'event',
          userId: 'id',
          timestamp: date,
          context,
          messageId: id,
        });
      }).then(() => done(), done);
    });

    it('should handle a user ids given as a number', (done) => {
      const date = new Date();
      analytics.track({
        userId: 1, event: 'jumped the shark', timestamp: date, messageId: id,
      }).then(() => {
        assert.deepEqual(analytics.queue[0].message, {
          userId: 1,
          event: 'jumped the shark',
          type: 'track',
          timestamp: date,
          context,
          messageId: id,
        });
      }).then(() => done(), done);
    });

    it('should require an event', () => {
      expect(analytics.track({ userId: 'id' }))
        .to.be.rejectedWith('You must pass a `event`.');
    });
  });

  describe('#page', () => {
    it('should enqueue a message', (done) => {
      const date = new Date();
      analytics.page({ userId: 'id', timestamp: date, messageId: id })
        .then(() => {
          assert.deepEqual(analytics.queue[0].message, {
            type: 'page',
            userId: 'id',
            timestamp: date,
            context,
            messageId: id,
          });
        }).then(() => done(), done);
    });
  });

  describe('#screen', () => {
    it('should enqueue a message', (done) => {
      const date = new Date();
      analytics.screen({ userId: 'id', timestamp: date, messageId: id })
        .then(() => {
          assert.deepEqual(analytics.queue[0].message, {
            type: 'screen',
            userId: 'id',
            timestamp: date,
            context,
            messageId: id,
          });
        }).then(() => done(), done);
    });
  });

  describe('#alias', () => {
    it('should enqueue a message', (done) => {
      const date = new Date();
      analytics.alias({
        previousId: 'previous', userId: 'id', timestamp: date, messageId: id,
      }).then(() => {
        assert.deepEqual(analytics.queue[0].message, {
          type: 'alias',
          previousId: 'previous',
          userId: 'id',
          timestamp: date,
          context,
          messageId: id,
        });
      }).then(() => done(), done);
    });

    it('should require a userId', () => {
      expect(analytics.alias({}))
        .to.be.rejectedWith('You must pass a `userId`.');
    });

    it('should require a previousId', () => {
      expect(analytics.alias({ userId: 'id' }))
        .to.be.rejectedWith('You must pass a `previousId`.');
    });
  });
});
