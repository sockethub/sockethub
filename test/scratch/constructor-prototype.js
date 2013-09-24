
function Person (name, age, sex, shared) {
  this.name = name || 'John Doe';
  this.age = age || 32;
  this.sex = sex || 'male';
  Person.prototype.shared = shared || 'default';
}

Person.prototype = {
  constructor: Person,
  shared: ''
};

p1 = new Person('Barbara', '46', 'female', 'locust');
p2 = new Person('Jane', '19', 'female', 'tiger');
p3 = new Person('Eko', '26', 'male', 'bird');


console.log('p1: [shared: ' + p1.shared + '] ', p1);
console.log('p2: [shared: ' + p2.shared + '] ', p2);
console.log('p3: [shared: ' + p3.shared + '] ', p3);