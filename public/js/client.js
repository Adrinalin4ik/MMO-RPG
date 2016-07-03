(function() {
  'use strict';

  var globals = typeof window === 'undefined' ? global : window;
  if (typeof globals.require === 'function') return;

  var modules = {};
  var cache = {};
  var aliases = {};
  var has = ({}).hasOwnProperty;

  var endsWith = function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  };

  var _cmp = 'components/';
  var unalias = function(alias, loaderPath) {
    var start = 0;
    if (loaderPath) {
      if (loaderPath.indexOf(_cmp) === 0) {
        start = _cmp.length;
      }
      if (loaderPath.indexOf('/', start) > 0) {
        loaderPath = loaderPath.substring(start, loaderPath.indexOf('/', start));
      }
    }
    var result = aliases[alias + '/index.js'] || aliases[loaderPath + '/deps/' + alias + '/index.js'];
    if (result) {
      return _cmp + result.substring(0, result.length - '.js'.length);
    }
    return alias;
  };

  var _reg = /^\.\.?(\/|$)/;
  var expand = function(root, name) {
    var results = [], part;
    var parts = (_reg.test(name) ? root + '/' + name : name).split('/');
    for (var i = 0, length = parts.length; i < length; i++) {
      part = parts[i];
      if (part === '..') {
        results.pop();
      } else if (part !== '.' && part !== '') {
        results.push(part);
      }
    }
    return results.join('/');
  };

  var dirname = function(path) {
    return path.split('/').slice(0, -1).join('/');
  };

  var localRequire = function(path) {
    return function expanded(name) {
      var absolute = expand(dirname(path), name);
      return globals.require(absolute, path);
    };
  };

  var initModule = function(name, definition) {
    var module = {id: name, exports: {}};
    cache[name] = module;
    definition(module.exports, localRequire(name), module);
    return module.exports;
  };

  var require = function(name, loaderPath) {
    var path = expand(name, '.');
    if (loaderPath == null) loaderPath = '/';
    path = unalias(name, loaderPath);

    if (has.call(cache, path)) return cache[path].exports;
    if (has.call(modules, path)) return initModule(path, modules[path]);

    var dirIndex = expand(path, './index');
    if (has.call(cache, dirIndex)) return cache[dirIndex].exports;
    if (has.call(modules, dirIndex)) return initModule(dirIndex, modules[dirIndex]);

    throw new Error('Cannot find module "' + name + '" from '+ '"' + loaderPath + '"');
  };

  require.alias = function(from, to) {
    aliases[to] = from;
  };

  require.register = require.define = function(bundle, fn) {
    if (typeof bundle === 'object') {
      for (var key in bundle) {
        if (has.call(bundle, key)) {
          modules[key] = bundle[key];
        }
      }
    } else {
      modules[bundle] = fn;
    }
  };

  require.list = function() {
    var result = [];
    for (var item in modules) {
      if (has.call(modules, item)) {
        result.push(item);
      }
    }
    return result;
  };

  require.brunch = true;
  require._cache = cache;
  globals.require = require;
})();
require.register("client/game", function(exports, require, module) {
"use strict";

var gameBootstrapper = {
    init: function(gameContainerElementId){

        var game = new Phaser.Game('100%', '100%', Phaser.AUTO, gameContainerElementId);

        game.state.add('boot', require('./states/boot'));
        game.state.add('login', require('./states/login'));
        game.state.add('play', require('./states/play'));

        game.state.start('boot');
    }
};

module.exports = gameBootstrapper;

});

require.register("client/gameObjects/CharacterObj", function(exports, require, module) {
'use strict';

var CharacterSpr = require('client/gameSprites/CharacterSpr');
var Pathfinder = require('client/utils/Pathfinder');
var NetworkManager = require('client/network/NetworkManager');

var collideWithCollectableMapAction;

var CharacterObj = function(game, x, y, isMainPlayer) {
    this.configure(game, isMainPlayer);
    this.setupSprite(x, y);
    this.resetCurrentTweens();
};

CharacterObj.prototype.configure = function(game, isMainPlayer){
    this.game = game;
    this.isMainPlayer = isMainPlayer;
    this.moveDuration = 500;
    this.info = {};

    this.currentTweens = [];
    this.moving = false;
    this.tweenInProgress = false;
};

CharacterObj.prototype.setupSprite = function(x, y){
    this.sprite = new CharacterSpr(this.game, x, y, this.isMainPlayer);
    this.game.add.existing(this.sprite);
    this.game.mmo_group_characters.add(this.sprite);

    this.sprite.walkDown();
};

CharacterObj.prototype.moveTo = function(targetX, targetY, pathReadyCallback){
    var me = this;

    if(this.isMainPlayer) {
        NetworkManager.notifyMovement({x: targetX, y: targetY, uid: this.uid})
    }

    Pathfinder.calculatePath(
        this.sprite.position.x,
        this.sprite.position.y,
        targetX,
        targetY,
        function(path) {
            if (pathReadyCallback !== undefined || typeof pathReadyCallback === "function") {
                pathReadyCallback(path);
            }
            me.onReadyToMove(me, path);
        }
    );
};


CharacterObj.prototype.onReadyToMove = function(me, listPoints){
    this.resetCurrentTweens();
    this.prepareMovement(listPoints);
    this.moveInPath();
};

CharacterObj.prototype.resetCurrentTweens  = function(){
    var me = this;
    this.currentTweens.map(function(tween){
        me.game.tweens.remove(tween);
    });
    this.currentTweens = [];
    this.moving = false;
    this.sprite.stopAnimation();
};

CharacterObj.prototype.prepareMovement = function(listPoints){
    listPoints = listPoints || [];
    this.currentTweens = [];
    var me = this;

    listPoints.map(function(point){
        me.currentTweens.push(me.getTweenToCoordinate(point.x, point.y));
    });

};

CharacterObj.prototype.getTweenToCoordinate = function(x, y){
    var tween = this.game.add.tween(this.sprite.position);

    x = (x * Pathfinder.tileSize) + Pathfinder.tileSize / 2;
    y = (y * Pathfinder.tileSize) + Pathfinder.tileSize / 2;
    tween.to({ x:x, y:y }, this.moveDuration);
    return tween;
};

CharacterObj.prototype.moveInPath = function() {
    if(this.currentTweens.length === 0){
        return;
    }
    var index = 1, me = this;
    this.moving = true;


    moveToNext(this.currentTweens[index]);


    function moveToNext(tween){

        index ++;
        var nextTween = me.currentTweens[index];
        if(nextTween != null){

            tween.onComplete.add(function(){
                me.tweenInProgress = false;
                moveToNext(nextTween);
            });
        }else{
            // if i am the last tween
            tween.onComplete.add(function(){
                me.onStopMovement();
            });
        }

        tween.start();
        me.faceNextTile(tween);

        me.tweenInProgress = true;
    }
};

CharacterObj.prototype.faceNextTile = function(tween){

    var isVerticalMovement = tween.properties.y == this.sprite.position.y;

    if(isVerticalMovement) {
        if(tween.properties.x > this.sprite.position.x){
            this.sprite.walkRight();
        } else {
            this.sprite.walkLeft();
        }
    } else {
        if(tween.properties.y > this.sprite.position.y){
            this.sprite.walkDown();
        } else {
            this.sprite.walkUp();
        }

    }
};

/*
 Set an external function to be executed when the Player collide with a collectable
 */
CharacterObj.prototype.setOnCollideCollectableMapAction = function(callback){
    collideWithCollectableMapAction = callback;
};

/*
 Check if the Character sprite collide with a collectable object sprite and set the function
 to execute when a collision occurs
 */
CharacterObj.prototype.checkCollision = function(){
    this.sprite.callOnCollideWithCollectableSprite(this.onCollideWithCollectable);
};

CharacterObj.prototype.onCollideWithCollectable = function(collectableSpr){
    var collectableObj = collectableSpr.collectableObj;

    if(collideWithCollectableMapAction) {
        collideWithCollectableMapAction(collectableObj);
    }
};



CharacterObj.prototype.onStopMovement = function(){
    this.resetCurrentTweens();

};

CharacterObj.prototype.setPosition = function(x, y){
    this.sprite.position.x = x;
    this.sprite.position.y = y;
};

CharacterObj.prototype.destroy = function(){
  this.sprite.destroy();
};


CharacterObj.prototype.getInfo = function(){
  this.info.x = this.sprite.position.x;
  this.info.y = this.sprite.position.y;
  this.info.uid = this.uid;
  this.info.nickname = this.nickname;

  return this.info;
};

module.exports = CharacterObj;
});

require.register("client/gameObjects/CollectableObj", function(exports, require, module) {
'use stric';


var CollectableObj = function(config) {
    this.game = config.game;
    this.isAvailable = config.isAvailable;
    this.type = config.type;
    this.uid = config.uid;

    this.sprite = this.game.add.sprite(config.x, config.y, 'sprites', 'collectables/' + this.type + '.png');
    this.sprite.collectableObj = this;

    this.sprite.anchor.setTo(0, 1);
    this.game.physics.arcade.enable(this.sprite);
    this.game.mmo_group_collectables.add(this.sprite);
};

CollectableObj.prototype.destroy = function() {
    this.sprite.kill();
};

module.exports = CollectableObj;
});

require.register("client/gameSprites/CharacterSpr", function(exports, require, module) {
'use strict';

var collideWithCollectableCallback;

var CharacterSpr = function(game, x, y, isCollisionEnabled) {
    Phaser.Sprite.call(this, game, x, y, 'sprites');
    if(isCollisionEnabled){
        this.enableCollision();
    }
    this.setupAnimations();
};

CharacterSpr.prototype = Object.create(Phaser.Sprite.prototype);
CharacterSpr.prototype.constructor = CharacterSpr;

CharacterSpr.prototype.enableCollision = function() {
    this.game.physics.arcade.enable(this);
    this.body.fixedRotation = true;
};

CharacterSpr.prototype.callOnCollideWithCollectableSprite = function(callback){
    this.game.physics.arcade.overlap(this, this.game.mmo_group_collectables, function(playerSpr, collectableSpr){
        callback(collectableSpr);
    });
};


CharacterSpr.prototype.setupAnimations = function() {
    this.anchor.setTo(0.5, 0.5);

    this.animations.add('walk_down', [
        "character/walk/down/0.png",
        "character/walk/down/1.png",
        "character/walk/down/0.png",
        "character/walk/down/2.png"
    ], 60, true);
    this.animations.add('walk_up', [
        "character/walk/up/0.png",
        "character/walk/up/1.png",
        "character/walk/up/0.png",
        "character/walk/up/2.png"
    ], 60, true);

    this.animations.add('walk_side', [
        "character/walk/side/0.png",
        "character/walk/side/1.png",
        "character/walk/side/0.png",
        "character/walk/side/2.png"
    ], 60, true);

};

CharacterSpr.prototype.walkDown = function(){
    this.animations.play("walk_down",6,true);
};

CharacterSpr.prototype.walkUp = function(){
    this.animations.play("walk_up",6,true);
};

CharacterSpr.prototype.walkLeft = function(){
    this.scale.x = 1;
    this.animations.play("walk_side",6,true);
};

CharacterSpr.prototype.walkRight = function(){
    this.scale.x = -1;
    this.animations.play("walk_side",6,true);
};

CharacterSpr.prototype.stopAnimation = function(){
    this.animations.stop();
};

module.exports = CharacterSpr;
});

require.register("client/network/MapDataClient", function(exports, require, module) {
'use strict';

var CollectableObj = require('client/gameObjects/CollectableObj');
var scoreBoard = require('client/utils/ScoreBoard');

var serverSocket, concernedPhaserState;
var collectableObjects = [];

function synchronize(socket, phaserState){
    serverSocket = socket;
    concernedPhaserState = phaserState;

    // configure incoming traffic
    serverSocket.on('SERVER_PLAYER_ID', onReadyToRequestCollectables);
    serverSocket.on('SERVER_ALL_COLLECTABLES', onReceiveAllCollectables);
    serverSocket.on('SERVER_COLLECTABLE_DESTROY', onDestroyCollectable);
    serverSocket.on('SERVER_UPDATE_PLAYER_SCORES', onReceiveScores);

    // initialize score board
    scoreBoard.init();
}

function onReadyToRequestCollectables(){
    serverSocket.emit('CLIENT_GET_ALL_COLLECTABLES');
}

function onDestroyCollectable(newCollectableInfo){
    var collectableIdToDestroy = newCollectableInfo.uid;

    var collectableToDestroy = collectableObjects.filter(function(collectable){
        return (collectable.uid === collectableIdToDestroy);
    })[0];


    if(collectableToDestroy !== undefined){
        collectableToDestroy.destroy();
    }
}

function onReceiveScores(playersList){
    scoreBoard.setScores(playersList);
}

function tryToCollectForPlayer(collectable, player){
    serverSocket.emit('CLIENT_TRY_TO_COLLECT', { collectableId: collectable.uid, playerId: player.uid});
}



function onReceiveAllCollectables(collectableList) {
    destroyAllCollectables();

    collectableList.forEach(function(collectable){

        if(collectable.isAvailable){
            var colObj = new CollectableObj({
                game : concernedPhaserState.game,
                x: collectable.x,
                y: collectable.y,
                isAvailable: collectable.isAvailable,
                type: collectable.type,
                uid: collectable.uid
            });
        }
        collectableObjects.push(colObj);
    });
}

function destroyAllCollectables(){
    collectableObjects.forEach(function(colObject){
        if(colObject){
            colObject.destroy();
        }
    });
    collectableObjects = [];
}

function setConcernedPhaserState(state){
    concernedPhaserState = state;
}

module.exports = {
    synchronize : synchronize,
    tryToCollectForPlayer: tryToCollectForPlayer
};
});

require.register("client/network/NetworkManager", function(exports, require, module) {
'use strict';

var serverSocket, mainPlayer;
var onOtherPlayerConnectedCallback;
var onOtherPlayerMove;
var onUpdatePlayerListCallback;
var onReceiveChatMessageCallback;

var networkManager = {
    connected: false,
    connect: function (player) {
        mainPlayer = player;
        serverSocket = io.connect('http://localhost:9192');
        serverSocket.on('connect', onConnectedToServer);

        this.configureIncomingTraffic();

        return serverSocket;
    },
    configureIncomingTraffic: function(){
        serverSocket.on('SERVER_PLAYER_ID', onReceivePlayerId);

        serverSocket.on('SERVER_PLAYER_CONNECTED', onPlayerConnected);
        serverSocket.on('SERVER_PLAYER_LIST', onReceivePlayerList);
        serverSocket.on('SERVER_OTHER_PLAYER_MOVED', onOtherPlayerMoved);
        serverSocket.on('SERVER_PLAYER_CHAT_MESSAGE', onReceiveChatMessage);
    },
    onOtherPlayerConnected: function(callback){
        onOtherPlayerConnectedCallback = callback;
    },
    onOtherPlayerMove: function(callback){
        onOtherPlayerMove = callback;
    },
    notifyMovement: function(movementInfo){
        serverSocket.emit('CLIENT_NOTIFY_PLAYER_MOVEMENT', movementInfo);
    },
    onUpdatePlayerList: function(callback){
        onUpdatePlayerListCallback = callback;
    },
    setOnReceiveChatMessage: function(callback){
        onReceiveChatMessageCallback = callback;
    },
    sendChatMessage: function(textMessage){
        serverSocket.emit('CLIENT_CHAT_MESSAGE', {
            uid: mainPlayer.uid,
            nickname: mainPlayer.nickname,
            text: textMessage
        });

    }
};

function onConnectedToServer() {
    networkManager.connected = true;
    serverSocket.emit('CLIENT_REQUEST_ID', mainPlayer.getInfo());
    serverSocket.emit('CLIENT_REQUEST_PLAYER_LIST');
}

function onReceivePlayerId(mainPlayerID) {
    mainPlayer.uid = mainPlayerID;
}

function onPlayerConnected(otherPlayer){
    onOtherPlayerConnectedCallback(otherPlayer);
}

function onOtherPlayerMoved(movementInfo){
    onOtherPlayerMove(movementInfo);
}

function onReceivePlayerList(listPlayers){
    onUpdatePlayerListCallback(listPlayers);
}

function onReceiveChatMessage(messageInfo){
    onReceiveChatMessageCallback(messageInfo);
}

module.exports = networkManager;
});

require.register("client/states/boot", function(exports, require, module) {
'use strict';

function Boot(){}

Boot.prototype = {
    preload: function(){
        this.game.stage.disableVisibilityChange = true;
        this.game.stage.backgroundColor = 0x3b0760;
        this.load.onLoadComplete.addOnce(this.onLoadComplete, this);

        this.showLoadingText();
        this.loadAssets();
    },

    onLoadComplete: function(){
        this.game.state.start('login');
    },

    loadAssets: function(){
        //this.game.load.tilemap('map', 'gameAssets/map/map.json', null, Phaser.Tilemap.TILED_JSON);
        //this.game.load.image('tiles', 'gameAssets/map/tile1.png');
        //this.game.load.image('walkables', 'gameAssets/map/walkable.png');

        //this.game.load.tilemap('tilemap', 'gameAssets/map/tilemap.json', null, Phaser.Tilemap.TILED_JSON);
        //this.game.load.image('tileset', 'gameAssets/map/tileset.png');

        this.game.load.tilemap('tilemap1', 'gameAssets/map/tilemap1.json', null, Phaser.Tilemap.TILED_JSON);
        //this.game.load.image('tileset1', 'gameAssets/map/tileset1.png');
        this.game.load.image('tileset2', 'gameAssets/map/tileset2.png');
        this.game.load.image('tileset3', 'gameAssets/map/tileset3.png');
        this.game.load.image('tileset4', 'gameAssets/map/tileset4.png');
        this.game.load.image('collision', 'gameAssets/map/walkable.png');
        //console.log(this)
        this.load.atlasJSONArray('sprites', 'gameAssets/sprites/sprites.png', 'gameAssets/sprites/sprites.json');
    },

    showLoadingText: function(){
        var loadingText = "- Loading -";
        var text = this.game.add.text(this.game.world.centerX, this.game.world.centerY, loadingText);
        //  Centers the text
        text.anchor.set(0.5);
        text.align = 'center';

        //  Our font + size
        text.font = 'Arial';
        text.fontWeight = 'bold';
        text.fontSize = 70;
        text.fill = '#ffffff';
    }
};

module.exports = Boot;

});

require.register("client/states/login", function(exports, require, module) {
'use strict';

var ChatManager = require('client/utils/ChatManager');
var DomHelper = require('client/utils/DomHelper');

var nickNameInput;
var domToRemove = [];

function Login(){}


Login.prototype = {

    create: function(){
        this.game.stage.backgroundColor = 0x66990D;

        DomHelper.init(this.game);
        domToRemove = [];
        this.showLoginPanel();
    },
    showLoginPanel: function(){
        var me = this;
        var panel = DomHelper.mediumPanel(180, 120, 'game-login-panel');
        var form = DomHelper.form(saveName);
        var blockInput = DomHelper.inputBlock();

        nickNameInput = DomHelper.inputWithLabel(blockInput, 'Enter a nickname', 200, 200);

        var saveButton = DomHelper.createButton('GO !!', 'game-login-button');

        form.appendChild(blockInput);
        form.appendChild(saveButton);
        panel.appendChild(form);

        domToRemove.push(panel); // removing the panel will remove all its childs

        function saveName(){
            me.game.mainPlayerName = ChatManager.setMainPlayerName(nickNameInput.value);
            if(me.game.mainPlayerName){
                me.cleanDom();
                me.game.state.start('play');
             }
             nickNameInput.value = '';
        }
    },

    cleanDom: function(){
        for(var i = 0, max = domToRemove.length; i < max; i++){
            domToRemove[i].remove();
        }
    }
};

module.exports = Login;
});

require.register("client/states/play", function(exports, require, module) {
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
        this.initPathfinder();
        this.initCursor();
        this.setupSpriteGroups();
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

});

require.register("client/utils/ChatManager", function(exports, require, module) {
'use strict';

var NetworkManager = require('client/network/NetworkManager');

var chatInput, messagesBox;
var mainPlayerName;

function init(containerId){
    initGuiElements(containerId);
    appendSystemMessage('info', 'Welcome ' + mainPlayerName + ' to this Demo');
}

/*
 Create the html structure that correspond to this :

 <div id="game-chat-box">
     <div class="game-chat-messages">
        Messages goes here
     </div>
     <form>
        <input type="text" class="game-chat-input">
     </form>
 </div>
 */
function initGuiElements(containerId){
    var container = document.getElementById(containerId);

    var chatBox = document.createElement('div');
    chatBox.id = 'game-chat-box';

    messagesBox = document.createElement('div');
    messagesBox.className = 'game-chat-messages';

    var chatForm = document.createElement('form');

    chatForm.onsubmit= onSendMessage;

    chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.className = 'game-chat-input';

    chatForm.appendChild(chatInput);

    chatBox.appendChild(messagesBox);
    chatBox.appendChild(chatForm);

    container.appendChild(chatBox);
}

function onSendMessage(){
    var textMessage = escapeHtml(chatInput.value);

    NetworkManager.sendChatMessage(textMessage);

    appendMessage(mainPlayerName, textMessage);

    chatInput.value = '';

    return false;
}

function appendSystemMessage(type, message){
    appendMessage('*', message, type);
}

function appendMessage(author, message, messageType){
    var cssTypeSuffix = '';
    if(messageType !== undefined){
        cssTypeSuffix = 'game-message-type-' + messageType;
    }

    var htmlMessage = '<span class="game-message ' + cssTypeSuffix + '"><span class="game-message-author"> [' + author + ']</span> : ' + message + '</span>';
    messagesBox.innerHTML += htmlMessage + '<br />';

    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function setMainPlayerName(nickName){
    if(!nickName || nickName.length === 0){
        return false;
    }
    mainPlayerName = escapeHtml(nickName);
    return mainPlayerName;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

module.exports = {
    init: init,
    appendMessage: appendMessage,
    systemMessage: appendSystemMessage,
    setMainPlayerName: setMainPlayerName
};
});

require.register("client/utils/DomHelper", function(exports, require, module) {
'use strict';

var containerElement, verticalOffset = 0, horizontalOffset = 0;

function getY(y){
    return y - verticalOffset;
}

function getX(x){
    return x - horizontalOffset;
}


module.exports = {
    init: function(game){
        containerElement = document.getElementById(game.parent);
        verticalOffset = game.height;
    },

    mediumPanel: function (x, y, cssClass){
        if(!cssClass){
            cssClass = '';
        }
        var panel = document.createElement('div');
        panel.className = 'gui-panel gui-panel-medium ' + cssClass;
        panel.style.left = getX(x) + 'px';
        panel.style.top = getY(y) + 'px';

        containerElement.appendChild(panel);

        return panel;
    },

    form: function(onSaveCallback){
        var form = document.createElement('form');
        form.onsubmit= function(){
            onSaveCallback();

            return false;
        };

        return form;
    },

    inputBlock: function(){
        var blockInput = document.createElement('div');
        blockInput.className='game-input-block';
        return blockInput;
    },

    inputWithLabel: function(parent, label, x, y){
        var nameLabel = document.createElement('div');
        nameLabel.className='game-gui-label';
        nameLabel.innerText = label;


        var nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'game-gui-input';

        parent.appendChild(nameLabel);
        parent.appendChild(nameInput);

        return nameInput;
    },

    createButton: function(label, cssClass){
        var button = document.createElement('button');
        button.className = cssClass;

        button.innerText = label;
        return button;
    },

    createElement: function(elementName, className){
        var element = document.createElement(elementName);
        element.className = className;
        return element;
    },

    addToContainer: function(element){
        containerElement.appendChild(element);
    },
    getX: getX,
    getY: getY

};
});

require.register("client/utils/Pathfinder", function(exports, require, module) {
'use strict';


var pathfinder;

module.exports = {
  init: function(game, walkableLayer, walkableLayerData, walkableTiles, tileSize){

      this.walkableLayer = walkableLayer;
      this.tileSize = tileSize;
      pathfinder = game.plugins.add(Phaser.Plugin.PathFinderPlugin);
      pathfinder.setGrid(walkableLayerData, walkableTiles);
      
  },
    calculatePath: function(fromX, fromY, toX, toY, onPathReadyCallback){
        var fromTiles = [this.getTileX(fromX), this.getTileY(fromY)];
        var toTiles = [this.getTileX(toX), this.getTileY(toY)];
        pathfinder.preparePathCalculation (fromTiles, toTiles,onPathReadyCallback );

        pathfinder.calculatePath();
    },

    getTileX: function(value){
        return this.walkableLayer.getTileX(value);
    },
    getTileY: function(value){
        return this.walkableLayer.getTileY(value);
    }
};
});

require.register("client/utils/ScoreBoard", function(exports, require, module) {
'use strict';

var DomHelper = require('client/utils/DomHelper');
var scoreList;


function init(){
    var scoreContainer = DomHelper.createElement('div', 'game-scoreboard');
    //scoreContainer.style.left = DomHelper.getX(800) + 'px';
    //scoreContainer.style.top = DomHelper.getY(0) + 'px';

    var title = document.createElement('h3');
    title.innerHTML = 'Scores';

    scoreList = DomHelper.createElement('ul', 'game-scorelist');

    scoreContainer.appendChild(title);
    scoreContainer.appendChild(scoreList);

    DomHelper.addToContainer(scoreContainer);
}

function setScores(scores){
    // empty the list
    while (scoreList.firstChild) {
        scoreList.removeChild(scoreList.firstChild);
    }

    scores.sort(orderByScore)
          .forEach(addScoreElement);

    function orderByScore(a, b) {
        return parseFloat(b.score) - parseFloat(a.score);
    }
    function addScoreElement(scoreInfo){
        var listElement = document.createElement('li');
        listElement.innerHTML = '<strong>' + scoreInfo.nickname + '</strong>' + ' : ' + scoreInfo.score;

        scoreList.appendChild(listElement);
    }
}

module.exports = {
    init: init,
    setScores: setScores
};

});


//# sourceMappingURL=client.js.map