debugger;



var Queue = require('bull');

var videoQueue = new Queue('video transcoder', 'redis://52.86.55.47:6379');

videoQueue.empty();
