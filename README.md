[![Build Status](https://travis-ci.org/neiker/analytics-react-native.svg)](https://travis-ci.org/neiker/analytics-react-native) [![Code Climate](https://codeclimate.com/github/neiker/analytics-react-native/badges/gpa.svg)](https://codeclimate.com/github/neiker/analytics-react-native)
[![codecov.io](http://codecov.io/github/neiker/analytics-react-native/coverage.svg?branch=master)](http://codecov.io/github/neiker/analytics-react-native?branch=master)

![dependencies](https://david-dm.org/neiker/analytics-react-native.svg)

A React Native client for [Segment](https://segment.com). The hassle-free way to integrate analytics into any application.

This library is based on its node counterpart, [analytics-node](https://github.com/segmentio/analytics-node). Despite being designed to run on react-native, it will also work in browsers (via webpack or browserify) and even in nodejs. You only need to include [fetch](https://github.com/github/fetch) for browsers or [node-fetch](https://github.com/bitinn/node-fetch) for nodejs or io.js.

## Installation

[![Greenkeeper badge](https://badges.greenkeeper.io/neiker/analytics-react-native.svg)](https://greenkeeper.io/)

```bash
npm install analytics-react-native
```

## Usage

```javascript
import Analytics from 'analytics-react-native';

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
