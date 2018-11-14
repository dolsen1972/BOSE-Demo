'use strict';

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region
AWS.config.update({ region: 'us-east-2' });
// Create DynamoDB document client
var docClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' });

var resultSet = null;

exports.handler = function(event, context, callback) {
  var params = {
    TableName: 'BOSE-Wearables'
  };
  
  //Get all products
  docClient.scan(params, function(err, data) {
    if (err) {
      console.log("Error", err);
      callback(err, null);
    }
    else {
      //Define different types for QueryParameters handling
      var stringKeys = ["ProductDesc", "SubCategory", "Category", "Name"];
      var numKeys = ["Price", "Stock", "Rating"];
      var arrayKeys = ["ProductInfo"];
      
      //Loop through all query params and handle them accoring to the type
      for (var key in event.queryParams) {
        if (event.queryParams.hasOwnProperty(key)) {
          console.log(key + " -> " + event.queryParams[key]);
          
          if (stringKeys.includes(key)) {
            console.log("Standard " + key + " -> " + event.queryParams[key]);
            findAndRemoveWildcard(data.Items, key, event.queryParams[key]);
          }
          
          if (numKeys.includes(key)) {
            var numStrArr = event.queryParams[key].split(',');
            if (numStrArr.length < 1 || numStrArr.length > 2) {
              // error handling here
              //TODO: Improve
              console.log(key + ": illegal arguments");
              let response = {
                statusCode: '400',
                body: JSON.stringify({ error: key + ": illegal arguments" }),
                headers: {
                  'Content-Type': 'application/json',
                }
              };

              context.succeed(response);
              callback(key + ": illegal arguments", null);
            }
            else {
              (numStrArr.length === 1) ? findAndRemoveOutside(data.Items, key, numStrArr[0], numStrArr[0]): findAndRemoveOutside(data.Items, key, numStrArr[0], numStrArr[1]);
            }
          }
          
          if (arrayKeys.includes(key)) {
            console.log("arrayKeys " + key + " -> " + event.queryParams[key]);
            var arr = event.queryParams[key].split(',').map((item) => {
              return item.toLowerCase();
            });

            findAndRemoveArray(data.Items, key, arr);
          }
        }
      }

      resultSet = data.Items;
      //Sort resultSet on Rating then Price.
      //TODO: This can/should be exposed on API as queryParameters as in "GET ../products?sort=-Rating,+Price"
      sortResults('Rating', 'Price');
      console.log("Success", data.Items);
      callback(null, data.Items);
    }
  });
}

// Helper function to sort retultSet by two keys
function sortResults(prop1, prop2) {
  resultSet = resultSet.sort(function(a, b) {
    return a[prop1] - b[prop1] || a[prop2] - b[prop2];
  });
}

// Helper function to remove all resultSet entries not matching wildcard value of value passed in.
function findAndRemoveWildcard(array, property, like) {
  var change = true;
  while (change) // index get messed up with multiple deletes. Brute force fix
  {
    change = false;
    array.forEach(function(result, index) {
      if (!result[property].toLowerCase().includes(like.toLowerCase())) {
        //Remove from array
        array.splice(index, 1);
        change = true;
      }
    });
  }
}

// Helper function to remove all resultSet entries outside of valueLow and valueHigh.
// If valueLow and valueHigh is equal it returns the actual match.
function findAndRemoveOutside(array, property, valueLow, valueHigh) {
  var change = true;
  while (change) // index get messed up with multiple deletes. Brute force fix
  {
    change = false;
    array.forEach(function(result, index) {
      if (result[property] < valueLow || result[property] > valueHigh) {
        console.log(result[property]);
        //Remove from array
        array.splice(index, 1);
        change = true;
      }
    });
  }
}

// Helper function to remove all resultSet entries if the values passed in is not part of an array.
function findAndRemoveArray(array, property, values) {
  var change = true;
  var found;

  console.log("values: " + values);

  while (change) // index get messed up with multiple deletes. Brute force fix
  {
    change = false;
    array.forEach(function(result, index) {
      found = false;
      result[property].forEach(function(arrValue, index2) {
        var i;
        for (i = 0; i < values.length; i++) {
          if (arrValue.toLowerCase().includes(values[i])) {
            found = true;
          }
        }
      });
      if (!found) {
        array.splice(index, 1);
        change = true;
      }
    });
  }
}

