var express = require('express');
var http = require('http');
var https = require('https');
var mysql = require('mysql');
var fs = require('fs');
var app = express();
var schedule = require('node-schedule');

app.use(express.static('public'));

var Realm = function(name, host, path)
{
	this.name = name;
	this.host = host;
	this.path = path;
	
	this.currentAuctions = new Array();
} 

var AggregateItem = function(id)
{
	this.realmName = '';
	this.id = id;
	
	this.count = 0;
	this.average = 0;
	this.min = 999999999;
	this.max = 0;
}

// Setup realms 
var realms = new Array();
var medivh = new Realm('Medivh', 'auction-api-us.worldofwarcraft.com', '/auction-data/ab1239c3bc437d48321a64e6b5e5ab7f/auctions.json');
var whisperwind = new Realm('Whisperwind', 'auction-api-us.worldofwarcraft.com', '/auction-data/32b45012b2ba771193da0aaed94102d8/auctions.json');
var aegwynn = new Realm('Aegwynn', 'auction-api-us.worldofwarcraft.com', '/auction-data/4923213e5eb3ec3b7e03d22b632bda36/auctions.json');	
	
realms.push(medivh);
realms.push(whisperwind);
realms.push(aegwynn);

// Items we're interested in tracking
var items = new Array(); 
items.push(6289);
items.push(118472);
items.push(72014);

function requestAllAuctionData()
{
	for (i = 0; i < realms.length; i++)
	{
		requestAuctionData(realms[i]);
	}
}

var scheduledJob = schedule.scheduleJob('*/1 * * * *', function(){
  console.log("*** scheduler fired ***");
  requestAllAuctionData();
});

function requestAuctionData(realm)
{
	console.log('>> requestAuctionData initiated for ' + realm.name);
	
	var options = {
	  host: realm.host,
	  path: realm.path
	};
	
	var callback = function(response) {
	var str = '';

	  // Another chunk of data has been received, so append it to `str`
	  response.on('data', function (chunk) {
		str += chunk; 
	  });

	  // The whole response has been received
	  response.on('end', function () {
		var realmAuctions = new Array();
		console.log("Auction response received");
		
		var result = JSON.parse(str);
		for (var i = 0; i < result.auctions.length; i++)
		{
			var auct = result.auctions[i];
			
			// Is this item one of the items we're interest in
			if (items.indexOf(auct.item) != -1)
			{
				console.log("item " + auct.item + "    buy out: " + auct.buyout);
				realmAuctions.push(auct);
			}
		}
		
		console.log("Auction parse done");
		realm.currentAuctions = realmAuctions;
	  });
	  
	}
	
	http.request(options, callback).end();
	console.log('<< requestAuctionData ended for ' + realm);
}
requestAllAuctionData();

app.get('/refreshall', function (req, res) {
	console.log('>> refreshall');
	requestAllAuctionData();
});


app.get('/additem/:index', function (req, res) {
	console.log('>> add item ' + req.params.index);
	items.push(parseInt(req.params.index));
	
	console.log(JSON.stringify(items));
});

app.get('/auctiondata', function (req, res) {
	res.send(JSON.stringify(realms));
});

app.get('/item/:index', function (req, res) {

	var aggregates = new Array();
	for (i = 0; i < realms.length; i++)
	{
		var item = new AggregateItem(parseInt(req.params.index));
		item.realmName = realms[i].name;
		
		var total = 0;
		var count = 0;
		for (j = 0; j < realms[i].currentAuctions.length; j++)
		{
			if (realms[i].currentAuctions[j].item == parseInt(req.params.index))
			{
				var buyout = realms[i].currentAuctions[j].buyout;
				
				if (buyout == 0)
					continue;
				
				total += buyout;
				
				if (buyout < item.min)
				{
					item.min = buyout;
				}
				
				if (buyout > item.max)
				{
					item.max = buyout;
				}
				
				count++;
			}
		}
		
		item.average = total / count;
		item.count = count;
		aggregates.push(item);
	}
	
	res.send(JSON.stringify(aggregates));
});

var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example 9app listening at http://%s:%s', host, port);
});