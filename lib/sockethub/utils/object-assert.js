// helper function to compare two obejcts together
function objectAssert(one, two) {
  var msg;
  function isInArray(val, array) {
    if (!typeof array.length) {
      //console.log('array length:'+array.length+' typeof: '+typeof array.length+' data:',array);
      //msg = 'isInArray() array has no length.';
      return false;
    }
    for (var i = 0, num = array.length; i < num; i++) {
      if (typeof val === 'function') {
        if (''+array[i] === ''+val) {
          return true;
        }
      } else {
        if (array[i] === val) {
          return true;
        }
      }
    }
    return false;
  }

  function isEqual(a, b) {
    var p;
    for(p in a){
      if (b === undefined) { return false; }
      var av, bv;
      try {
        av = a[p];
        bv = b[p];
      } catch(e) {
        //console.log('DEBUG', a);
        msg = p + ": "+ a[p]+" doesn't match with second object property";
        return false;
      }
      //recursion
      if (typeof av === 'object' || typeof bv === 'object') {
        if (objectAssert(av,bv) !== true){
          return false;
        }
      } else { //simple comparisons
        if(a[p] !== b[p]){
          // support for arrays of different order
          if (!isInArray(a[p],b)) {
            if (!msg) {
              msg = p + ": "+ a[p]+" not in second object";
            }
            return false;
          }
        }
      }
    }
    return true;
  }

  // can't use json encoding in case objects contain functions - recursion will fail
  // can't compare non-objects
  if (isEqual(one,two) !== true) {
    console.error(' [client manager] unmatched objects [1:'+typeof one+' != 2:'+typeof two+']: ' + msg);
    return false;
  }
  if (isEqual(two,one) !== true) {
    console.error(' [client manager] unmatched objects [2:'+typeof two+' != 1:'+typeof one+']' + msg);
    return false;
  }
  return true;
}

module.exports = objectAssert;