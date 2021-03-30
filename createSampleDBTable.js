var numberOfObjectsToUpload = 100;

var bucketName = "legacybucket77";

const mariadb = require('mariadb');

var pool = mariadb.createPool({
  host: "54.152.26.74",
  user: "root",
  password: 'Ab@123456',
  database: "userImageData",
  connectionLimit: 10
});
var tableName = "ImageData";
var tableColumnName = "Imagepath";

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({
  region: 'us-east-1'
});

// Create S3 service object
s3 = new AWS.S3({
  region: 'us-east-1'
});

// var file = process.argv[3];

var path = require('path');

var pushList = [];

for (var i = 0; i < numberOfObjectsToUpload; i++) {

  pushList.push("image/avatar" + i + ".txt");

}

var objectUpdateQuery = "INSERT INTO " + tableName + "(" + tableColumnName + ") VALUES (?)";

pool.query("CREATE TABLE IF NOT EXISTS " + tableName + " (ID int NOT NULL AUTO_INCREMENT , " + tableColumnName + " VARCHAR(255) , PRIMARY KEY (ID))")
  .then(res => {
    return pool.batch(objectUpdateQuery, pushList);
  })
  .then(res => {
    console.log("completed");
    pool.end();
  })
  .catch(err => console.log("error occured " + err.message))

// insertTableData(pushList);
