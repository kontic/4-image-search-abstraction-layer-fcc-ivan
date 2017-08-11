'use strict';

var fs = require('fs');
var express = require('express');
var request = require('request');
var mongo = require('mongodb').MongoClient;
var app = express();

if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = ['https://narrow-plane.gomix.me', 'https://www.freecodecamp.com'];
    var origin = req.headers.origin || '*';
    if(!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1){
         console.log(origin);
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    }
    next();
  });
}

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/_api/package.json')
  .get(function(req, res, next) {
    console.log('requested');
    fs.readFile(__dirname + '/package.json', function(err, data) {
      if(err) return next(err);
      res.type('txt').send(data.toString());
    });
  });

//------------------------------------------------------------------------------------------------------------------START
//   https://4-image-search-abstraction-layer-fcc-ivan.glitch.me/_api/image_search/?search=*****&offset=***
app.route('/_api/image_search/')
  .get(function(req, res) {
    var url_t = req.url;
    var search_for = req.query.search;
    var page_offset = (req.query.offset - 1) * 10 + 1;
    
    request.get(
      'https://www.googleapis.com/customsearch/v1?' +
      'q=' + search_for + 
      '&cx=' + process.env.CX + 
      '&searchType=' + 'image' + 
      '&start=' + page_offset +
      '&key=' + process.env.API_KEY 
    , function(err, resp, body){
        var item;
        var search_data = JSON.parse(body)
        var json = [];
        for(var i = 0; i < search_data.items.length; i++){
          item = {
            url: search_data.items[i].link
          , snippet: search_data.items[i].snippet
          , thumbnail: search_data.items[i].image.thumbnailLink
          , context: search_data.items[i].image.contextLink
          }
          json.push(item);
        }
        res.setHeader( 'Content-Type', 'application/json' );
        res.status(200);
        res.send(JSON.stringify(json, null, '  '));
      }
    );
    
    //---insert in db---
    var url = 'mongodb://' + process.env.mongo_user + ':' + process.env.mongo_pass + '@ds033086.mlab.com:33086/url_shortener_ivan'
    mongo.connect(url, function(err, db) {
      if (err) {res.send(err)}
      var collection = db.collection('image_api_layer');
      var doc = {
        term: search_for
      , when: (new Date()).toISOString()
      }
      collection.insert(doc, function(err, data) {
        if (err) throw err
        db.close();
      })
    })
    
  });

//   https://4-image-search-abstraction-layer-fcc-ivan.glitch.me/_api/latest/
app.route('/_api/latest/')
  .get(function(req, res) {
    var url_t = req.url;
    
    //---read from db---
    var url = 'mongodb://' + process.env.mongo_user + ':' + process.env.mongo_pass + '@ds033086.mlab.com:33086/url_shortener_ivan'
    mongo.connect(url, function(err, db) {
      if (err) throw err
      var collection = db.collection('image_api_layer')
      collection.find({}, {
        term: 1
      , when: 1
      , _id: 0
      }).toArray(function(err, docs) {
        if (err) throw err
        if(docs.length !== 0){
          res.setHeader( 'Content-Type', 'application/json' );
          res.status(200);
          res.send(JSON.stringify(docs, null, '  '));
        }else{
          var doc = {
            error: "No data yet"
          }
          res.setHeader( 'Content-Type', 'application/json' );
          res.status(400);
          res.send(JSON.stringify(doc, null, '  '));
        }
        db.close()
      })
    })

  });
  
//--------------------------------------------------------------------------------------------------------------------END

app.route('/')
    .get(function(req, res) {
		  res.sendFile(process.cwd() + '/views/index.html');
    })

// Respond not found to all the wrong routes
app.use(function(req, res, next){
  res.status(404);
  res.type('txt').send('Not found');
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
})

app.listen(process.env.PORT, function () {
  console.log('Node.js listening ...');
});

