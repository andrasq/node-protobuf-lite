// npm install qtimeit protocol-buffers protobufjs

'use strict';

var qtimeit = require('qtimeit');

var pbuf = require('protocol-buffers');
var protobufjs = require('protobufjs');
var pblite = require('./');

var datasets = [];

var data = {
    num: 42,
    payload: 'hello world',
};
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
var pbjsJson = {
    nested: {
        Test: {
            fields: {
                num: { type: 'float', id: 1 },
                payload: { type: 'string', id: 2 },
            },
        }
    }
};
var pbjsRoot = protobufjs.Root.fromJSON(pbjsJson);
var pbjsMessage = pbjsRoot.lookupType('Test');

datasets.push({ data: data, pbufSchema: schema, pbjsJson: pbjsJson, pbliteFormat: format });


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
var pbjsJson = {
    nested: {
        Test: {
            fields: {
                str: { type: 'string', id: 1 },
                iso: { type: 'uint32', id: 2 },
                date: { type: 'int32', id: 3 },
                long: { type: 'int64', id: 4 },
                typeid: { type: 'int32', id: 5 },
                sint: { type: 'sint32', id: 6 },
                b1: { type: 'bool', id: 7 },
                b2: { type: 'bool', id: 8 },
                b3: { type: 'bool', id: 9 },
                b4: { type: 'bool', id: 10 },
                b5: { type: 'bool', id: 11 },
                b6: { type: 'bool', id: 12 },
                b7: { type: 'bool', id: 13 },
                doub: { type: 'double', id: 14 },
                flt: { type: 'float', id: 15 },
            },
        }
    }
};
var pbjsRoot = protobufjs.Root.fromJSON(pbjsJson);
var pbjsMessage = pbjsRoot.lookupType('Test');

datasets.push({ data: data, pbufSchema: schema, pbjsJson: pbjsJson, pbliteFormat: format });


var data = { a: 1.5, b: 'foo', c1: 1, c2: 2, d: true };  // {"a":1.5,"b":"foo","c":[1,2],"d":true,"e":{}}
var format = "faIIb";
var schema = [
    'message Test {',
    '  float a = 1;',
    '  string b = 2;',
    '  int32 c1 = 3;',
    '  int32 c2 = 4;',
    '  bool d = 5;',
    '}'
].join('\n');
var pbjsJson = {
    nested: {
        Test: {
            fields: {
                a: { type: 'float', id: 1 },
                b: { type: 'string', id: 2 },
                c1: { type: 'int32', id: 3 },
                c2: { type: 'int32', id: 4 },
                d: { type: 'bool', id: 5 },
            }
        }
    }
}
var pbjsRoot = protobufjs.Root.fromJSON(pbjsJson);
var pbjsMessage = pbjsRoot.lookupType('Test');

datasets.push({ data: data, pbufSchema: schema, pbjsJson: pbjsJson, pbliteFormat: format });


var canonical = { a: "ABC", b: 1, c: "DEFGHI\xff", d: 12345.67e-1, e: null };
var format = "aiafb";
var schema = [
    'message Test {',
    '  string a = 1;',
    '  sint32 b = 2;',
    '  string c = 3;',
    '  double d = 4;',
    '  bool e = 4;',
    '}'
].join('\n');
var pbjsJson = {
    nested: {
        Test: {
            fields: {
                a: { type: 'string', id: 1 },
                b: { type: 'int32', id: 2 },
                c: { type: 'string', id: 3 },
                d: { type: 'double', id: 4 },
                e: { type: 'bool', id: 5 },
            }
        }
    }
}

datasets.push({ data: canonical, pbufSchema: schema, pbjsJson: pbjsJson, pbliteFormat: format });


for (var i=0; i<datasets.length; i++) {
    data = datasets[i].data;
    schema = datasets[i].pbufSchema;
    pbjsJson = datasets[i].pbjsJson;
    format = datasets[i].pbliteFormat;

    var dataA = [undefined];
    for (var k in data) dataA.push(data[k]);

    // create a protocol-buffers coder
    var messages = pbuf(schema);

    // create a pbjs coder
    var pbjsRoot = protobufjs.Root.fromJSON(pbjsJson);
    var pbjsMessage = pbjsRoot.lookupType('Test');

    // prepare the test data, encoded and decoded
    var json = JSON.stringify(data);
    var packed = messages.Test.encode(data);
    //console.log("AR: packed", packed);
    //console.log("AR: test encode", pblite.pack(format, dataA));
    //console.log("AR: test decode", pblite.unpack(format, packed));
    //console.log("AR: test my decode", pblite.unpack(format, pblite.pack(format, dataA)));

    var item = messages.Test.decode(packed);
    //console.log("AR: item", item);
    //console.log("AR: unpacked", pblite.unpack(format, packed));


    console.log("---------------- testing", data);

    var x;
    qtimeit.bench.timeGoal = .2;
    qtimeit.bench.visualize = true;
    console.log("");
    qtimeit.bench({
        '1st pblite packA': function() { x = pblite.pack(format, dataA) },
        'pbuf enc': function() { x = messages.Test.encode(data) },
        'pbjs enc': function() { x = pbjsMessage.encode(pbjsMessage.create(data)).finish() },
        'json enc': function() { x = JSON.stringify(data) },
        'pblite packA': function() { x = pblite.pack(format, dataA) },
        'pblite _packA': function() { x = pblite._pack(format, dataA, new Array(), {p:0}) },
    });
    //console.log(JSON.stringify(x));

    console.log("");
    qtimeit.bench({
        '1st pblite unpack': function() { x = pblite.unpack(format, packed) },
        'pbuf dec': function() { x = messages.Test.decode(packed) },
        'pbjs dec': function() { x = pbjsMessage.toObject(pbjsMessage.decode(packed)) },
        'json dec': function() { x = JSON.parse(json) },
        'pblite unpack': function() { x = pblite.unpack(format, packed) },
    });
    console.log(x);
}

/*

Notes:
- fields are traditionally numbered 1.. (= 1; =2; etc), not 0-based;
  pack and unpack use fieldnum to index into an array, not the fields lookup map.

*/
