var Queue = require('bull');
var async = require('async');
var AWS = require('aws-sdk');



const videoQueue = new Queue('video transcoder', 'redis://52.86.55.47:6379');

// var videoQueue = new Queue('video transcoding', 'redis://52.86.55.47:6379');

// var fs = require('fs');


var numberOfAsyncThreads = 5;

var s3bucket = "legacybucket77";
var objectPrefix = "image"
var allKeys = [];

var token = "";

var params = {
  Bucket: s3bucket,
  Prefix: objectPrefix
  /* required */
};

s3 = new AWS.S3({
  region: 'us-east-1'
});

listAllBucketKeys(token);


function listAllBucketKeys(token) {

  try {

    if (token) {
      params.ContinuationToken = token;
    }
    s3.listObjectsV2(params, function(err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
      } else {

        if (data.Contents.length) {

          async.eachLimit(data.Contents, numberOfAsyncThreads, async function(eachArray) {

            addObjestsInQueue(eachArray);

          });

          if (data.IsTruncated) {

            listAllBucketKeys(data.NextContinuationToken);

          }else {
            // videoQueue.close();
          }

        }
      }
    });

  } catch (e) {

    console.log("caught exception " + e);

  }
}

function addObjestsInQueue(inBucketObject) {

    const job = videoQueue.add({
      bucketObjects: inBucketObject.Key
    }, {
      removeOnComplete: true
    }).catch(error => console.log(error.message));




  // process.on('SIGINT', () => {
  //   if (!isProcessEnding) {
  //     isProcessEnding = true
  //     setTimeout(() => {
  //       Promise.all([
  //         videoQueue.close(),
  //       ]).then(() => {
  //         console.log('Successfully shut down all queue, because of sigint. Bye!')
  //         process.exit(0)
  //       })
  //     }, 1000)
  //   }
  // })
  //
  // process.on('SIGTERM', () => {
  //   if (!isProcessEnding) {
  //     isProcessEnding = true
  //     setTimeout(
  //       () =>
  //       Promise.all([
  //         videoQueue.close(),
  //       ]).then(() => {
  //         console.log(
  //           'Successfully shut down all queue, because of sigterm. Bye!'
  //         )
  //         process.exit(0)
  //       }),
  //       1000
  //     )
  //   }
  // })
}
