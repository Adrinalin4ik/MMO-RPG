MMO game using Phaser.io Express and Socket.IO
========================================


This is an MMO game using phaser.IO socket.io and express.


[Current version](https://mmorpg-test.herokuapp.com/)


Requirements
-------------

You need to install [NodeJS](https://nodejs.org) and [Brunch.io](http://brunch.io/) to run this example.

Installation
-------------
Clone this repo then run this command:

    npm install
	
After change client/network/NetworkManager.js:
example
	if production version:
	serverSocket = io.connect('https://mmorpg-test.herokuapp.com/');
	or local version:
	serverSocket = io.connect('http://localhost:9192');
	
Start the development environment
-------------------------------------------
	
    brunch w
	
Deploy on heroku
========================================
 1) Configure git ignore: You must allow public folder.
 2) Check you client/network/NetworkManager.js It should be like serverSocket = io.connect('https://mmorpg-test.herokuapp.com/');
 3) run brunch build.
 4) Deploy.

