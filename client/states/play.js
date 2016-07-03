'use strict';

var CharacterObj = require('client/gameObjects/CharacterObj');
var Pathfinder = require('client/utils/Pathfinder');
var NetworkManager = require('client/network/NetworkManager');
var ChatManager = require('client/utils/ChatManager');
var MapDataClient = require('client/network/MapDataClient');

var cursors;
function Play(){}

Play.prototype = {
    create: function(){
        this.game.stage.backgroundColor = 0xFFFFFF;
        this.game.physics.startSystem(Phaser.Physics.ARCADE);

        this.initMap();
        //this.initPathfinder();
        //this.initCursor();
        //this.setupSpriteGroups();
        //this.addMainPlayer();
        //this.configPlayerCollisions();
        //this.initChatModule();

        //this.connectToServer();
    },
    setupSpriteGroups: function(){
        this.game.mmo_group_collectables = this.game.add.group();
        this.game.mmo_group_characters = this.game.add.group();
    },
    initMap: function(){
        //this.map = this.game.add.tilemap('map');
        //this.map.addTilesetImage('tiles', 'tiles');
        //this.map.addTilesetImage('collision', 'walkables');
        this.map = this.game.add.tilemap('tilemap1');
        //this.map.addTilesetImage('tileset1', 'tileset1');
        this.map.addTilesetImage('tileset2', 'tileset2');
        this.map.addTilesetImage('tileset3', 'tileset3');
        this.map.addTilesetImage('tileset4', 'tileset4');
        this.map.addTilesetImage('walkable', 'collision');
        //this.map.addTilesetImage('collision', 'walkables');

        this.walkableLayer = this.map.createLayer('collision');


        //this.map.createLayer('ground');
        //this.map.createLayer('obstacles');
        this.map.createLayer('layer 2');

        this.map.createLayer('ground');
        this.initPathfinder();
        this.initCursor();
        this.setupSpriteGroups()
        this.addMainPlayer();
        this.configPlayerCollisions();
        this.initChatModule();
        this.connectToServer();

        this.map.createLayer('layer 1');
        this.map.createLayer('layer 2');

        this.walkableLayer.resizeWorld();
    },

    initPathfinder: function(){

        Pathfinder.init(this.game,
                        this.walkableLayer,
                        this.map.layers[3].data, // the layer containing the walkable tiles
                        [2529], // ID of the walkable tile ( the green one )
                        32
        );
    },

    initCursor: function(){
        this.marker = this.game.add.graphics();
        this.marker.lineStyle(2, 0x000000, 1);
        this.marker.drawRect(0, 0, Pathfinder.tileSize, Pathfinder.tileSize);

        this.input.onDown.add(function(event){
            this.updateCursorPosition();
            this.mainPlayer.moveTo(this.marker.x, this.marker.y, function(path){

            });
        }, this);

    },

    updateCursorPosition: function(){
        this.marker.x = this.walkableLayer.getTileX(this.game.input.activePointer.worldX) * 32;
        this.marker.y = this.walkableLayer.getTileY(this.game.input.activePointer.worldY) * 32;
    },


    addMainPlayer: function(){
        this.game.world.setBounds(0, 0, 100, 100);

        var startX = (79 * Pathfinder.tileSize) + (Pathfinder.tileSize / 2);
        var startY = (89 * Pathfinder.tileSize) + (Pathfinder.tileSize / 2);

        this.mainPlayer = new CharacterObj(this.game, startX, startY, true);
        this.game.camera.follow(this.mainPlayer.sprite);

        this.mainPlayer.nickname = this.game.mainPlayerName;

        cursors = this.game.input.keyboard.createCursorKeys();
    },

    configPlayerCollisions: function(){
        var me = this;
        this.mainPlayer.setOnCollideCollectableMapAction(function(collectable) {
            collectable.destroy();
            MapDataClient.tryToCollectForPlayer(collectable, me.mainPlayer);
        });
    },

    connectToServer: function(){
        var me = this;
        var serverSocket = NetworkManager.connect(this.mainPlayer);

        NetworkManager.onOtherPlayerConnected(function(otherPlayerInfo){
            ChatManager.systemMessage('info', otherPlayerInfo.nickname + ' is connected');
            me.addOtherPlayer(otherPlayerInfo);
        });

        // set what to do when the current player receive movement information about another player
        NetworkManager.onOtherPlayerMove(function(movementInfo){
            var otherPlayerToMove = searchById(me.otherPlayers, movementInfo.uid);
            if(otherPlayerToMove){
                otherPlayerToMove.moveTo(movementInfo.x, movementInfo.y);
            }
        });

        // set what to do when the client receive the players list from the server
        NetworkManager.onUpdatePlayerList(function(receivedList){
            me.removeDisconnected(receivedList);
            me.addConnected(receivedList);

        });
        this.otherPlayers = [];

        this.synchronizeMapData(serverSocket);
    },

    addOtherPlayer: function(otherPlayerInfo){
        var otherPlayer = new CharacterObj(this.game, otherPlayerInfo.x, otherPlayerInfo.y, false);
        otherPlayer.uid = otherPlayerInfo.uid;
        otherPlayer.nickname = otherPlayerInfo.nickname;
        this.otherPlayers.push(otherPlayer);
    },

    removeDisconnected: function(receivedList){
        var newOtherPlayers = [];
        for(var i = 0, max = this.otherPlayers.length; i<max; i++){
            var otherPlayer = this.otherPlayers[i];
            // test if the player on this browser is still on the server list
            var playerInList = searchById(receivedList, otherPlayer.uid);

            if(playerInList){
                // keep the player
                newOtherPlayers.push(otherPlayer);
            } else {
                // remove from the game
                otherPlayer.destroy();
                ChatManager.systemMessage('error', otherPlayer.nickname + ' disconnected');
            }
        }
        this.otherPlayers = newOtherPlayers;
    },

    addConnected: function(receivedList){
        // search in the list if an element is not present in the otherPlayers, and not mainPlayer Add it

        for(var i = 0, max = receivedList.length; i<max;i++){
            var receivedPlayer = receivedList[i];
            if(receivedPlayer.uid !== this.mainPlayer.uid){
                var connectedPlayer = searchById(this.otherPlayers, receivedPlayer.uid);
                if(!connectedPlayer){
                    this.addOtherPlayer(receivedPlayer);
                }
            }

        }
    },

    initChatModule: function(){
        ChatManager.init(this.game.parent);
        var me = this;

        NetworkManager.setOnReceiveChatMessage(function(messageInfo){
            ChatManager.appendMessage(messageInfo.nickname, messageInfo.text);
        });
    },

    synchronizeMapData: function(serverSocket){
        MapDataClient.synchronize(serverSocket, this);
    },

    checkMainPlayerCollision: function() {
        if(this.mainPlayer !== undefined) {
            this.mainPlayer.checkCollision();
        }
    },

    update: function(){
        this.updateCursorPosition();
        this.checkMainPlayerCollision();

          if (cursors.left.isDown)
          {
              this.mainPlayer.sprite.x -= 4;
          }
          else if (cursors.right.isDown)
          {
              this.mainPlayer.sprite.x += 4;
          }

          if (cursors.up.isDown)
          {
              this.mainPlayer.sprite.y -= 4;
          }
          else if (cursors.down.isDown)
          {
              this.mainPlayer.sprite.y += 4;
          }
           this.game.world.wrap(this.mainPlayer.sprite, 0, true);
    }
};

function searchById(array, id){
    for(var i = 0, max = array.length; i < max; i++){
        var uid = array[i].getInfo ? array[i].getInfo().uid : array[i].uid;
        if(array[i] != null && uid === id){
            return array[i];
        }
    }
    return undefined;
}

function removeElementById(array, id){
    return array.filter(function( obj ) {
        return obj.uid !== id;
    });
}

module.exports = Play;
