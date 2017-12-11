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


var format = 'aIIIIibbbbbbbdf';
var schema = [
    'message Test {',
    '  required string str = 1;',
    '  required uint32 iso = 2;',       // unsigned vint (but stores 'ff' for negative and breaks on decode)
    '  required int32 date = 3;',       // unsigned vint (but stores 32 ff bits for negative ?!)
    '  required int64 long = 4;',       // unsigned vint?? (but stores 64 ff bits for negative ?!)
    '  required int32 typeid = 5;',
    '  required sint32 sint = 6;',      // signed varint
    '  required bool b1 = 7;',          // varint, 1 byte
    '  required bool b2 = 8;',
    '  required bool b3 = 9;',
    '  required bool b4 = 10;',
    '  required bool b5 = 11;',
    '  required bool b6 = 12;',
    '  required bool b7 = 13;',
    '  required double doub = 14;',
    '  required float flt = 15;',
    '}',
].join('\n');
var data = {
    str: 'Lorem ipsum dolor sit amet.',
    iso: 9000,
    date: 20161110,
    long: 649545084044315,
    typeid: 1,
    sint: -42,
    b1: true, b2: false, b3: false,
    b4: true, b5: false, b6: false, b7: true,
    doub: 204.8,
    flt: 0.25,
};
var dataA = [
    , 'Lorem ipsum dolor sit amet.', 9000, 20161110, 649545084044315, 1, -42,
    true, false, false, true, false, false, true, 204.8, 0.25
];


var schema = 'message Test { required sint64 a = 1; required sint64 b = 2; required sint64 c = 3; }';
var data = { a: 1234, b: 23456, c: 345678 };
var dataA = [ , 1234, 23456, 345678 ];
var format = "iii";

var schema = 'message Test { required int64 a = 1; required int64 b = 2; required int64 c = 3; }';
var dataA = [ , -1, -2, -3 ];
var data = { a: dataA[1], b: dataA[2], c: dataA[3] };
var format = "kkk";


var json = JSON.stringify(data);

var messages = pbuf(schema);
var buf = messages.Test.encode(data);
console.log("AR: buf", buf);
console.log("AR: test encode", pblite.pack(format, dataA));
console.log("AR: test decode", pblite.unpack(format, buf));
console.log("AR: test my decode", pblite.unpack(format, pblite.pack(format, dataA)));

var item = messages.Test.decode(buf);
console.log("AR: item", item);
console.log("AR: unpacked", pblite.unpack(format, buf));

var x;
var qtimeit = require('qtimeit');
qtimeit.bench.timeGoal = .2;
qtimeit.bench.visualize = true;
qtimeit.bench({
    'pbuf enc': function() { x = messages.Test.encode(data) },
    'json enc': function() { x = JSON.stringify(data) },
    'pblite packA': function() { x = pblite.pack(format, dataA) },
    'pblite _pack': function() { x = pblite._pack(format, dataA, new Array(), {p:0}) },
});
console.log(JSON.stringify(x));

qtimeit.bench({
    'pbuf dec': function() { x = messages.Test.decode(buf) },
    'json dec': function() { x = JSON.parse(json) },
    'pblite unpack': function() { x = pblite.unpack(format, buf) },
});
console.log(x);

/*

Notes:
- fields are traditionally numbered 1.. (= 1; =2; etc), not 0-based;
  pack and unpack use fieldnum to index into an array, not the fields lookup map.

*/
