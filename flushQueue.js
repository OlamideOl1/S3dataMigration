debugger;



var Queue = require('bull');

var videoQueue = new Queue('objectQueue', 'redis://54.152.26.74');

videoQueue.empty().then(res=>videoQueue.clean(1).then(res=>videoQueue.clean(1, 'failed').then(res=>videoQueue.close())));

// videoQueue.close();
