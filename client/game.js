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
