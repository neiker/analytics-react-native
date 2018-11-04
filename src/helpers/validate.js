import typeOf from 'type-of';
import assert from './assert';

/**
 * Validation rules.
 */

const rules = [
  {
    name: 'anonymousId',
    types: ['string', 'number'],
  },
  {
    name: 'category',
    types: 'string',
  },
  {
    name: 'context',
    types: 'object',
  },
  {
    name: 'event',
    types: 'string',
  },
  {
    name: 'groupId',
    types: ['string', 'number'],
  },
  {
    name: 'integrations',
    types: 'object',
  },
  {
    name: 'name',
    types: 'string',
  },
  {
    name: 'previousId',
    types: ['string', 'number'],
  },
  {
    name: 'timestamp',
    types: 'date',
  },
  {
    name: 'userId',
    types: ['string', 'number'],
  },
];

const asserts = {
  identify: (message) => {
    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );
  },
  group: (message) => {
    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );
    assert(
      message.groupId,
      'You must pass a `groupId`.',
    );
  },
  track: (message) => {
    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );
    assert(
      message.event,
      'You must pass an `event`.',
    );
  },
  page: (message) => {
    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );
  },
  screen: (message) => {
    assert(
      message.anonymousId || message.userId,
      'You must pass either an `anonymousId` or a `userId`.',
    );
  },
  alias: (message) => {
    assert(
      message.userId,
      'You must pass a `userId`.',
    );
    assert(
      message.previousId,
      'You must pass a `previousId`.',
    );
  },
};

/**
 * Validate an options `obj`.
 *
 * @param {Object} obj
 */

function validate(message, type) {
  assert(
    typeOf(message) === 'object',
    'You must pass a message object.',
  );

  rules.forEach((rule) => {
    if (message[rule.name]) {
      const types = [].concat(rule.types);

      assert(
        types.some(t => typeOf(message[rule.name]) === t),
        `"${rule.name}" must be ${types.join(' or ')}.`,
      );
    }
  });

  if (asserts[type]) {
    asserts[type](message);
  } else {
    throw new TypeError('Invalid event type');
  }
}

export default (message, type) => {
  try {
    validate(message, type);
  } catch (e) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    throw e;
  }
};
