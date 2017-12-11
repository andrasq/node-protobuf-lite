'use strict';

var pb = require('./');

module.exports = {
    'package': {
        'should export expected functions': function(t) {
            t.equal(typeof pb.pack, 'function');
            t.equal(typeof pb.unpack, 'function');
            t.equal(typeof pb._pack, 'function');
            t.equal(typeof pb._unpack, 'function');
            t.done();
        },

        'pack should invoke _pack': function(t) {
            var spy = t.spyOnce(pb, '_pack');
            pb.pack('i', [,1]);
            t.equal(spy.callCount, 1);
            t.deepEqual(spy.callArguments[0], 'i');
            t.deepEqual(spy.callArguments[1], [,1]);
            t.done();
        },

        'unpack should invoke _unpack': function(t) {
            var spy = t.spyOnce(pb, '_unpack');
            pb.unpack('i', [0, 1]);
            t.equal(spy.callCount, 1);
            t.deepEqual(spy.callArguments[0], 'i');
            t.deepEqual(spy.callArguments[1], [0, 1]);
            t.done();
        },
    },

    'pack': {
        'should return a Buffer': function(t) {
            t.ok(Buffer.isBuffer(pb.pack("", [])));
            t.done();
        },

        'should tag with the array offset': function(t) {
            var buf = pb.pack('ii', [,,,1,,2]);
            t.deepEqual(buf, [0x18, 2, 0x28, 4]);
            t.skip();
        },

        'varint': function(t) {
            var tests = [
                [ 0, [0, 0] ],
                [ 1, [0, 2] ],
                [ 2, [0, 4] ],
                [ 3, [0, 6] ],
                [ 257, [0, 0x82, 0x04] ],
                [ 65535, [0, 0xfe, 0xff, 0x07] ],
                [ Math.pow(2, 50), [0, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x04] ],
                [ -1, [0, 1] ],
                [ -2, [0, 3] ],
                [ -3, [0, 5] ],
                [ -4, [0, 7] ],
                [ -5, [0, 9] ],
                [ -Math.pow(2, 50), [0, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x03] ],
            ];

            for (var i=0; i<tests.length; i++) {
                var item = tests[i][0];
                var expect = tests[i][1];
                t.deepEqual(pb._pack('i', [item], [], {p:0}), expect, "test " + i);
                t.deepEqual(pb.pack('i', [item]), new Buffer(expect));
            }

            t.done();
        },

        'errors': {
            'should throw on unrecognized conversion': function(t) {
                t.throws(function(){ pb.pack('X', [1]) }, /unknown/);
                t.done();
            },
        },
    },

    'unpack': {
        'should return an Array': function(t) {
            t.ok(Array.isArray(pb.unpack("", [])));
            t.done();
        },
    },
}
