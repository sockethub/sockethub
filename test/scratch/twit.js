var Twit = require('twit');
    try {
      new Twit({
        consumer_key: '',
        consumer_secret: '',
        access_token: '',
        access_token_secret: ''
      });
    } catch (e) {
      console.log(e);
    }
