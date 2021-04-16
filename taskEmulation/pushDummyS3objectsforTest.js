//this code will write dummy s3 objects to S3 for testing.

//set variabele to hold number of dummy objects to be uploaded.
var numberOfObjectsToUpload = 100;

//set bucket name to upload dummy objects to;
var bucketName = "legacybucket77";

//set content for dummy object to be uploaded.
var objectBody = "this is a test content for objects to be uploaded";

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region

// Create S3 service object
s3 = new AWS.S3({
  region: 'us-east-1'
});

// call S3 to retrieve upload file to specified bucket
var uploadParams = {
  Bucket: bucketName,
  Key: '',
  Body: objectBody,
  ACL: "private"
};

// start upload to  specified bucket
for (var i = 0; i < numberOfObjectsToUpload; i++) {

  uploadParams.Key = "image/avatar" + i + ".jpg";
  s3.upload(uploadParams, function(err, data) {
    if (err) {
      console.log("Error", err);
    }
    if (data) {
      console.log("Upload Success " + uploadParams.Key + " to " + bucketName, data.Location);
    }
  });

}
