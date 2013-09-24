var mySingleton = (function () {
  // Instance stores a reference to the Singleton
  var instance;
  var val;

  function init() {
    // Singleton

    // Private methods and variables
    function privateMethod(){
        console.log( "I am private" );
    }

    var privateVariable = "Im also private";
    var privateRandomNumber = Math.random() + '-' + val;

    return {
      // Public methods and variables
      publicMethod: function () {
        console.log( "The public can see me!" );
      },

      publicProperty: "I am also public",

      getRandomNumber: function() {
        return privateRandomNumber;
      }
    };
  }

  return {
    // Get the Singleton instance if one exists
    // or create one if it doesn't
    getInstance: function (p) {
      val = p;
      if ( !instance ) {
        instance = init();
      }

      return instance;
    }
  };
})();

module.exports = mySingleton;

