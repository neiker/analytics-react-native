[![Build Status](https://travis-ci.org/neiker/analytics-universal.svg)](https://travis-ci.org/neiker/analytics-universal) [![Code Climate](https://codeclimate.com/github/neiker/analytics-universal/badges/gpa.svg)](https://codeclimate.com/github/neiker/analytics-universal)
[![codecov.io](http://codecov.io/github/neiker/analytics-universal/coverage.svg?branch=master)](http://codecov.io/github/neiker/analytics-universal?branch=master)

![dependencies](https://david-dm.org/neiker/analytics-universal.svg)

A universal javascript client for [Segment](https://segment.com).

This library is based on [analytics-node](https://github.com/segmentio/analytics-node) and have the same API, but is re writed to also work in browsers (via webpack or browserify) server side, React Native and NativeScript. You only need to include [fetch](https://github.com/github/fetch) for browsers (check [here](http://caniuse.com/#feat=fetch) if you really need it) or [node-fetch](https://github.com/bitinn/node-fetch) for nodejs or io.js.

## Installation

```bash
npm install analytics-universal
```

## Usage

```javascript
import Analytics from 'analytics-universal';

const analytics = new Analytics(YOUR_WRITE_KEY);

analytics.identify({
  userId: user.id,
  traits: {
    name: 'John',
    lastname: 'Doe',
    email: 'user@domain.com',
    plan: 'Enterprise',
  }
});

analytics.track({
  userId: user.id,
  event: 'Item Purchased',
  properties: {
    revenue: 39.95,
    shippingMethod: '2-day'
  }
});
```

### Configuration
The second argument to the Analytics constructor is an optional object to configure the module.

```javascript
const analytics = new Analytics(YOUR_WRITE_KEY, {
  host: 'http://localhost/', // Host where reports will be send. Useful for debug.
  flushAt: 20, // The number of messages to enqueue before flushing.
  flushAfter: 10000 // The number of milliseconds to wait before flushing the queue automatically.
});
```

## Documentation

Documentation is available at [https://segment.com/libraries/node](https://segment.com/libraries/node).

## Differences from analytics-node

### Screen method
In addition to methods available in [analytics-node](https://github.com/segmentio/analytics-node), documented above, screen method is available. The screen method lets you you record whenever a user sees a screen of your mobile app, along with optional extra information about the page being viewed.

You’ll want to record a screen event an event whenever the user opens a screen in your app. This could be a view, fragment, dialog or activity depending on your app.

You can call it using exactly the same params as [page method](https://segment.com/docs/sources/server/node/#page).

```javascript
analytics.screen({
  userId: 'john_doe',
  name: 'products_list',
  properties: {
    order: 'ASC',
    page: 2,
    // And any other data about this screen
  }
});
```
