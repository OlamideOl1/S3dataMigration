debugger;


var Queue = require('bull');

// const Redis = require('ioredis')
//
// const redis = new Redis({
//   port: 6379,
//   host: '52.86.55.47'
// })

// const videoQueue = new Queue('video transcoder', 'redis://52.86.55.47:6379');

const videoQueue = new Queue('video transcoder', {
  redis: {
    port: 6379,
    host: "52.86.55.47",
    // maxRetriesPerRequest: null,
    // enableReadyCheck: false,
    enableOfflineQueue: false
  }
});

// var videoQueue = new Queue('video transcoding', 'redis://52.86.55.47:6379');

const job = videoQueue.add({video: 'http://example.com/video1.mov'}, { removeOnComplete: true }).catch(error => console.log(error.message));



// return;
videoQueue.close();

// videoQueue.on('error', this.emit.bind(this, 'error'));

// redis.on('error', error => console.log('error'))
//
// } catch (err) {
//         console.log(err);
//         return null;
//     }
