'use strict';


var ZoneCamera_1;

module.exports = {
  init: function(game,mainPlayer,border_scale){

      this.game = game;
      this.mainPlayer = hero;
      this.game.camera.deadzone = new Phaser.Rectangle(this.game.camera.x+this.mainPlayer.sprite.width*border_scale, 
                                                         this.game.camera.y+this.mainPlayer.sprite.height*border_scale, 
                                                         this.game.width-this.mainPlayer.sprite.width*border_scale*2, 
                                                         this.game.height-this.mainPlayer.sprite.height*border_scale*2);
      this.game.camera.setPosition(this.game.camera.deadzone.x-this.mainPlayer.sprite.width, this.camera.y-this.mainPlayer.sprite.height);
      
  },
    updateCamera: function(){
         var zone = this.game.camera.deadzone;
        

        if (this.mainPlayer.sprite.x>zone.x+zone.width){
            console.log(this.game.camera.deadzone)
            this.game.camera.deadzone = new Phaser.Rectangle(this.game.camera.deadzone.x+this.game.camera.deadzone.width, 
                                                             this.game.camera.y+this.mainPlayer.sprite.height, 
                                                             this.game.width-this.mainPlayer.sprite.width*border_scale*2, 
                                                             this.game.height - this.mainPlayer.sprite.height*border_scale*2);
            this.game.camera.setPosition(this.game.camera.deadzone.x-this.mainPlayer.sprite.width, this.camera.y);
            
        }
        if (this.mainPlayer.sprite.y>zone.y+zone.height){
            console.log(this.game.camera.deadzone)
            this.game.camera.deadzone = new Phaser.Rectangle(this.game.camera.x+this.mainPlayer.sprite.width, 
                                                             this.game.camera.deadzone.y+this.game.camera.deadzone.height,  
                                                             this.game.width-this.mainPlayer.sprite.width*border_scale*2, 
                                                             this.game.height - this.mainPlayer.sprite.height*border_scale*2);
            this.game.camera.setPosition(this.camera.x, this.game.camera.deadzone.y-this.mainPlayer.sprite.height);
            
        }
        /////
        if (this.mainPlayer.sprite.x<this.game.camera.deadzone.x){
            // console.log(this.game.camera.deadzone)
            console.log('here')
            this.game.camera.deadzone = new Phaser.Rectangle(this.game.camera.deadzone.x-this.game.camera.deadzone.width*border_scale*2, 
                                                             this.game.camera.y+this.mainPlayer.sprite.height, 
                                                             this.game.width-this.mainPlayer.sprite.width*border_scale*2, 
                                                             this.game.height - this.mainPlayer.sprite.height*border_scale*2);
            this.game.camera.setPosition(this.game.camera.deadzone.x-this.mainPlayer.sprite.width, this.camera.y);
        }
        if (this.mainPlayer.sprite.y<this.game.camera.deadzone.y){
            // console.log(this.game.camera.deadzone)
            this.game.camera.deadzone = new Phaser.Rectangle(this.game.camera.x+this.mainPlayer.sprite.width, 
                                                             this.game.camera.deadzone.y-this.game.camera.deadzone.height*border_scale*2,  
                                                             this.game.width-this.mainPlayer.sprite.width*border_scale*2, 
                                                             this.game.height - this.mainPlayer.sprite.height*border_scale*2);
            this.game.camera.setPosition(this.camera.x, this.game.camera.deadzone.y-this.mainPlayer.sprite.height);
        }

        red_zone.lineStyle(2, 0x000000, 1);
        red_zone.drawRect(zone.x, zone.y, zone.width, zone.height);
    },

};