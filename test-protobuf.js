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
            pb.pack('i', [1]);
            t.equal(spy.callCount, 1);
            t.deepEqual(spy.callArguments[0], 'i');
            t.deepEqual(spy.callArguments[1], [1]);
            t.done();
        },

        'unpack should invoke _unpack': function(t) {
            var spy = t.spyOnce(pb, '_unpack');
            pb.unpack('i', [8, 1]);
            t.equal(spy.callCount, 1);
            t.deepEqual(spy.callArguments[0], 'i');
            t.deepEqual(spy.callArguments[1], [8, 1]);
            t.done();
        },
    },

    'pack': {
        'should return a Buffer': function(t) {
            t.ok(Buffer.isBuffer(pb.pack("", [])));
            t.done();
        },

        'should tag with the array offset + 1': function(t) {
// TODO: should this "feature" be supported?
t.skip();
            var buf = pb.pack('ii', [,,,1,,2]);
            t.deepEqual(buf, [0x08, 2, 0x10, 4]);
            t.done();
        },

        'should encode and decode scalar types': function(t) {
            // note: int32 spec calls for negatives to be encoded in 10 bytes as 64-bit twos complement
            var tests = [
                [ 'i', -1, [8, 1] ],                                                    // signed varint
                [ 'I', 0xffffffff, [8, 255, 255, 255, 255, 0x0f] ],                     // unsigned varint
                [ 'j', 1, [8, 1] ],                                                     // int32, int64
                [ 'j', -1, [8, 255, 255, 255, 255, 255, 255, 255, 255, 255, 1] ],       // int32, int64
// FIXME: make encodeVarint64 v1 finish with the high bit set!
                [ 'j', -Math.pow(2, 39), [8, 128, 128, 128, 128, 128, 0xf0, 255, 255, 255, 1] ],        // int64
                [ 'b', true, [8, 1] ],
                [ 'b', false, [8, 0] ],
                [ 'd', 0.25, [9, 0, 0, 0, 0, 0, 0, 0xd0, 0x3f] ],
                [ 'q', 1, [9, 1, 0, 0, 0, 0, 0, 0, 0] ],        // sint64
                [ 'P', 1, [9, 1, 0, 0, 0, 0, 0, 0, 0] ],                                // int64
                [ 'P', -1, [9, 255, 255, 255, 255, 255, 255, 255, 255, 255, 1] ],       // int64
                [ 'a', 'hello test', [10, 0x0a, 104, 101, 108, 108, 111, 32, 116, 101, 115, 116] ],
                [ 'Z', new Buffer('hello test'), [10, 0x0a, 104, 101, 108, 108, 111, 32, 116, 101, 115, 116] ],
                [ 'f', 0.25, [13, 0, 0, 0x80, 0x3e] ],
                [ 'l', 1, [13, 1, 0, 0, 0] ],                    // sfixed32
                [ 'l', -1, [13, 255, 255, 255, 255] ],           // sfixed32
                [ 'V', 1, [13, 1, 0, 0, 0] ],                    // ufixed32
                [ 'V', -1, [13, 255, 255, 255, 255] ],           // ufixed32 ??? TODO: verify
                [ 'V', 0xffffffff, [13, 255, 255, 255, 255] ],           // ufixed32
                [ 'V', -1, [13, 255, 255, 255, 255] ],           // ufixed32
                [ 'a', 'hello', [10, 5, 104, 101, 108, 108, 111] ],
                [ 'Z', new Buffer('hello'), [10, 5, 104, 101, 108, 108, 111] ],
// FIXME: break
//                [ 'q', -1, [9, 255, 255, 255, 255, 255, 255, 255, 255] ],
//                [ 'P', -1, [9, 255, 255, 255, 255, 255, 255, 255, 255] ],
            ];

            for (var i=0; i<tests.length; i++) {
                var fmt = tests[i][0];
                var item = tests[i][1];
                var expect = tests[i][2];
                t.deepEqual(pb._pack(fmt, [item], [], {p:0}), expect, "_pack test " + i);
                t.deepEqual(pb.pack(fmt, [item]), new Buffer(expect), "pack test " + i);
                if ((fmt !== 'V' && fmt !== 'P') || item >= 0) {
                    t.deepEqual(pb.unpack(fmt, expect), [ item ] , "unpack test " + i);
                    t.deepEqual(pb.unpack(fmt, new Buffer(expect)), [ item ] , "unpack test " + i);
                }
            }

            t.done();
        },

        'varint': function(t) {
            var tests = [
                [ 0, [8, 0] ],
                [ 1, [8, 2] ],
                [ 2, [8, 4] ],
                [ 3, [8, 6] ],
                [ 257, [8, 0x82, 0x04] ],
                [ 65535, [8, 0xfe, 0xff, 0x07] ],
                [ Math.pow(2, 50), [8, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x04] ],
                [ -1, [8, 1] ],
                [ -2, [8, 3] ],
                [ -3, [8, 5] ],
                [ -4, [8, 7] ],
                [ -5, [8, 9] ],
                [ -Math.pow(2, 50), [8, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x03] ],
            ];

            for (var i=0; i<tests.length; i++) {
                var item = tests[i][0];
                var expect = tests[i][1];
                t.deepEqual(pb._pack('i', [item], [], {p:0}), expect, "test " + i);
                t.deepEqual(pb.pack('i', [item]), new Buffer(expect));
            }

            t.done();
        },

        'float': function(t) {
            var tests = [
                [ 0.0, [13, 0, 0, 0, 0] ],
                [ 0.25, [13, 0, 0, 0x80, 0x3e] ],
                [ Math.pow(2, 40), [13, 0, 0, 0x80, 0x53] ],
                [ NaN, [13, 0, 0, 0xc0, 0x7f] ],
            ];

            for (var i=0; i<tests.length; i++) {
                t.deepEqual(toArray(pb.pack('f', [tests[i][0]])), tests[i][1]);
                if (!isNaN(tests[i][0])) t.equal(pb.unpack('f', tests[i][1])[0], tests[i][0]);
                else t.ok(isNaN(pb.unpack('f', tests[i][1])[0]));
            }

            t.done();
        },

        'double': function(t) {
            var tests = [
                [ 0.0, [9, 0, 0, 0, 0, 0, 0, 0, 0] ],
                [ 0.25, [9, 0, 0, 0, 0, 0, 0, 0xd0, 0x3f] ],
                [ Math.pow(2, 40), [9, 0, 0, 0, 0, 0, 0, 0x70, 0x42] ],
                [ NaN, [9, 0, 0, 0, 0, 0, 0, 0xf8, 0x7f] ],
            ];

            for (var i=0; i<tests.length; i++) {
                t.deepEqual(toArray(pb.pack('d', [tests[i][0]])), tests[i][1]);
                if (!isNaN(tests[i][0])) t.equal(pb.unpack('d', tests[i][1])[0], tests[i][0]);
                else t.ok(isNaN(pb.unpack('d', tests[i][1])[0]));
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

        'should extract to the array offset': function(t) {
t.skip();
            var buf = pb.pack('ii', [,,,1,,2]);
            t.deepEqual(pb.unpack('ii', buf), [,,,1,,2]);
            t.done();
        },

        'should decode the encoded types': function(t) {
            var canonical = { a: "ABC", b: 1, c: "DEFGHI\xff", d: 12345.67e-1, e: null };
            var tests = [
                [ "aIadb",      "ABC", 1, "DEFGHI\xff", 12345.67e-1, false ],
            ];

            for (var i=0; i<tests.length; i++) {
                var format = tests[i][0];
                var data = tests[i].slice(1);
                t.deepEqual(pb.unpack(format, pb.pack(format, data)), data);
            }

            t.done();
        },
    },
}

function toArray(ary) {
    var array = [];
    for (var i = 0; i < ary.length; i++) array.push(ary[i]);
    return array;
}
