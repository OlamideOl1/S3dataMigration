debugger;

var Queue = require('bull');

const videoQueue = new Queue('video transcodingf', 'redis://52.86.55.47:6379');

// var videoQueue = new Queue('video transcoding', 'redis://52.86.55.47:6379');

const job = videoQueue.add({video: 'http://example.com/video1.mov'}, { removeOnComplete: true });

// return;
videoQueue.close();
