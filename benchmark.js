// npm install qtimeit protocol-buffers

'use strict';

var pbuf = require('protocol-buffers');
var pblite = require('./');

var format = 'fa';
var schema = [
    'enum FOO {',
    '  BAR = 1;',
    '}',
    '',
    'message Test {',
    '  required float num  = 1;',
    '  required string payload = 2;',
    '}'
].join('\n');

var data = {
    num: 42,
    payload: 'hello world',
};
var dataA = [ data.num, data.payload ];


var messages = pbuf(schema);

var json = JSON.stringify(data);
var buf = messages.Test.encode(data);
console.log("AR: buf", buf);

var item = messages.Test.decode(buf);
console.log("AR: item", item);
console.log("AR: long", pblite.unpack(format, buf));

var x;
var qtimeit = require('qtimeit');
qtimeit.bench.timeGoal = .2;
qtimeit.bench.visualize = true;
qtimeit.bench({
    'pbuf enc': function() { x = messages.Test.encode(data) },
    'json enc': function() { x = JSON.stringify(data) },
    'pblite enc': function() { x = pblite.pack(format, data) },

    'pbuf dec': function() { x = messages.Test.decode(buf) },
    'json dec': function() { x = JSON.parse(json) },
    'pblite dec': function() { x = pblite.unpack(format, buf) },

});

console.log(x);

/*

Notes:
- fields are traditionally numbered 1.. (= 1; =2; etc), not 0-based;
  pack and unpack use fieldnum to index into an array, not the fields lookup map.

*/
