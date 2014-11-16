function ArrayIndex(p) {
  this.identifier = p.identifier || 'id';
  this.idx = [];
}

ArrayIndex.prototype.getIdentifiers = function () {
  var ids = [];
  for (var i = this.idx.length - 1; i >= 0; i--) {
    ids.push(this.idx[i][this.identifier]);
  }
  return ids;
};

ArrayIndex.prototype.getRecordIfExists = function (id) {
  for (var i = this.idx.length - 1; i >= 0; i--) {
    if ('' + this.idx[i][this.identifier] === '' + id) {
      return this.idx[i];
    }
  }
  return undefined;
};

ArrayIndex.prototype.addRecord = function (record) {
  this.removeRecord(record[this.identifier]);
  this.idx.push(record);
  return true;
};

ArrayIndex.prototype.removeRecord = function (id) {
  for (var i = this.idx.length - 1; i >= 0; i--) {
    if (this.idx[i][this.identifier] === id) {
      this.idx.splice(i, 1);
      return true;
    }
  }
  return false;
};

ArrayIndex.prototype.forEachRecord = function (cb) {
  for (var i = this.idx.length - 1; i >= 0; i--) {
    cb(this.idx[i]);
  }
};

module.exports = function (p) {
  return new ArrayIndex(p);
};
