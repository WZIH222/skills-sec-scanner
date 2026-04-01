/**
 * Sensitive Data Exposure Sample 1: Hardcoded AWS Access Key ID
 *
 * This demonstrates exposure of AWS credentials through hardcoded values.
 * AWS Access Key IDs follow the pattern: AKIA[0-9A-Z]{16}
 *
 * CVSS: 9.8 (Critical)
 * CWE-798
 */

const AWS = require('aws-sdk');

// VULNERABLE: Hardcoded AWS credentials
const AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
const AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

function uploadToS3(bucket, key, data) {
  return s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: data
  }).promise();
}

// Another vulnerable pattern
const dynamoConfig = {
  accessKeyId: 'AKIAI44QH8DHBEXAMPLE',
  secretAccessKey: 'je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY',
  region: 'us-west-2'
};

module.exports = { uploadToS3, s3, dynamoConfig };
