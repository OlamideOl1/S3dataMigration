var Queue = require('bull');

const videoQueue = new Queue('video transcoder', 'redis://52.86.55.47:6379');

// var videoQueue = new Queue('video transcoding', 'redis://52.86.55.47:6379');

// var fs = require('fs');
var AWS = require('aws-sdk');
var s3bucket = "legacybucket77";
var objectPrefix = "image"
var allKeys = [];

var params = {
  Bucket: s3bucket,
  Prefix: objectPrefix
  /* required */
};

s3 = new AWS.S3({
  region: 'us-east-1'
});

////////////////////////////////////////

s3.listObjectsV2(params, function(err, data) {
  if (err) {
    console.log(err, err.stack); // an error occurred
  } else {
    allKeys = allKeys.concat(data.Contents);
    if (data.IsTruncated) {

      listAllKeys(data.NextContinuationToken);

    } else {

      addObjestsInQueue(allKeys);

    }
  }
});



function listAllKeys(token) {

  if (token) {
    params.ContinuationToken = token;
  }
  s3.listObjectsV2(params, function(err, data) {

    allKeys = allKeys.concat(data.Contents);

    if (data.IsTruncated) {
      listAllKeys(data.NextContinuationToken);
    } else {

      addObjestsInQueue(allKeys);

    }

  });
}

function addObjestsInQueue(inArray) {
  
  let isProcessEnding = false

  for (var cnt = 0; cnt < inArray.length; cnt++) {
    // console.log("each key value is " + inArray[cnt].Key);
    const job = videoQueue.add({
      bucketObjects: inArray[cnt].Key
    }, {
      removeOnComplete: true
    }).catch(error => console.log(error.message));

  }

  videoQueue.close();



  process.on('SIGINT', () => {
    if (!isProcessEnding) {
      isProcessEnding = true
      setTimeout(() => {
        Promise.all([
          videoQueue.close(),
        ]).then(() => {
          console.log('Successfully shut down all queue, because of sigint. Bye!')
          process.exit(0)
        })
      }, 1000)
    }
  })

  process.on('SIGTERM', () => {
    if (!isProcessEnding) {
      isProcessEnding = true
      setTimeout(
        () =>
        Promise.all([
          videoQueue.close(),
        ]).then(() => {
          console.log(
            'Successfully shut down all queue, because of sigterm. Bye!'
          )
          process.exit(0)
        }),
        1000
      )
    }
  })
}
