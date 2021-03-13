checkJob(); //  start the loop

function checkJob() {

  var Queue = require('bull');

  var cntres = 1;

  var videoQueue = new Queue('video transcoder', 'redis://52.86.55.47:6379');

  /////////
  videoQueue.getJobCounts().then(res => console.log('All count variable is :\n', res));
  ////////

  videoQueue.count().then(function(result) {

    if (result > 1) {

      console.log("current job count is " + result);


      checkJob();

    } else {
      console.log("job Queue is now empty");

      videoQueue.close();
    }
  });

}
