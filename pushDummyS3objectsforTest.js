//this code will write dummy s3 objects to S3 for testing.

//set variabele to hold number of dummy objects to be uploaded.
var numberOfObjectsToUpload = 30000;

//set bucket name to upload dummy objects to;
var bucketName = "legacybucket77";

//set content for dummy object to be uploaded.
var objectBody = "this is a test content for objects to be uploaded";
// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});

// Create S3 service object
s3 = new AWS.S3({region: 'us-east-1'});

// call S3 to retrieve upload file to specified bucket
var uploadParams = {Bucket: bucketName, Key: '', Body: objectBody, ACL: "private"};
// var file = process.argv[3];

/// add debugger line to debug process
debugger;
// Configure the file stream and obtain the upload parameters

// var fs = require('fs');
// var fileStream = fs.createReadStream(file);
// fileStream.on('error', function(err) {
//   console.log('File Error', err);
// });


var path = require('path');

for (var i = 0; i < numberOfObjectsToUpload; i++) {


uploadParams.Key = "image/avatar"+i+".txt";

// call S3 to retrieve upload file to specified bucket
s3.upload (uploadParams, function (err, data) {
  if (err) {
    console.log("Error", err);
  } if (data) {
    console.log("Upload Success "+uploadParams.Key+" to "+bucketName, data.Location);
  }
});


// var params = {
//  Body: objectBody,
//  Bucket: bucketName,
//  Key: "HappyFace.txt",
// };
// s3.putObject(params, function(err, data) {
//   if (err) console.log(err, err.stack); // an error occurred
//   else     console.log(data);           // successful response
//
// });



/* The following example list objects in a bucket. */

 // var params = {
 //  Bucket: bucketName,
 // };
 // s3.listObjects(params, function(err, data) {
 //   if (err) console.log(err, err.stack); // an error occurred
 //   else     console.log(data);           // successful response
 //
 // });

}
