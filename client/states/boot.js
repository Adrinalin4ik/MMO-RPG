'use strict';

function Boot(){}

Boot.prototype = {
    preload: function(){
        this.game.stage.disableVisibilityChange = true;
        this.game.stage.backgroundColor = 0x3b0760;
        this.load.onLoadComplete.addOnce(this.onLoadComplete, this);
        this.saveCPU = this.game.plugins.add(new Phaser.Plugin.SaveCPU)
        console.log(this.saveCPU)
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
