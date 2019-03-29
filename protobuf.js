/**
 * protobuf-lite -- protocol buffers, simplified
 *
 * 2017-12-06 - AR.
 */

// https://developers.google.com/protocol-buffers/docs/encoding (wire protocol, very terse)
// https://developers.google.com/protocol-buffers/docs/proto (long!)


/**

- varint encoding: 1xxx xxxx 0xxx xxxx little-e 14-bit value
- signed varint: zig-zag varint encoded: lsb is sign, other bits are absolute value (eg 6 = 1100, -6 = 1011)
- 64-bit: always 8 bytes, decodes as 64 little-e bits, parser interprets bits (eg double, fixint64)
- 32-bit: always 4 bytes, decodes as 32 little-e bits, parser interprets bits (eg float)
- wire protocol encodes bits, type can only be determined from its type .proto type definition file

**/

var qutf8 = require('q-utf8');
var fp = require('ieee-float');

var protobuf = module.exports = {
    pack: pack,
    unpack: unpack,
    _pack: _pack,
    _unpack: _unpack,

    // common aliases
    encode: pack,
    decode: unpack,
};

/*
 * protobuf wire protocol decoder
 */

function pack( format, data ) {
    var buf = new Array();
    //var buf = new Buffer(1000);
    var pos = { p: 0, fieldnum: 0 };

    protobuf._pack(format, data, buf, pos);
    //return pos.p < buf.length ? buf.slice(0, pos.p) : buf;
    return new Buffer(buf);
}

function unpack( format, data ) {
    return protobuf._unpack(format, data, {p:0});
}

var convMap = {
    'i': { wt: 0, enc: encodeVarint, dec: decodeVarint },       // int
    'I': { wt: 0, enc: encodeUVarint, dec: decodeUVarint },     // uint
    'j': { wt: 0, enc: encodeVarint32, dec: decodeVarint32 },   // int
    'k': { wt: 0, enc: encodeVarint64, dec: decodeVarint64 },   // uint
    'b': { wt: 0,                                               // bool
           enc: function(v, buf, pos) { buf[pos.p++] = v ? 1 : 0 },
           dec: function(buf, pos) { return buf[pos.p++] ? true : false } },
    'd': { wt: 1, enc: encodeDouble, dec: decodeDouble },       // double
    'q': { wt: 1, enc: encodeInt64, dec: decodeInt64 },         // int64
    'P': { wt: 1, enc: encodeUInt64, dec: decodeUInt64 },       // uint64
    'a': { wt: 2, enc: encodeString, dec: decodeString },       // string
    'Z': { wt: 2, enc: encodeBinary, dec: decodeBinary },       // binary
    'f': { wt: 5, enc: encodeFloat, dec: decodeFloat },         // float
    'l': { wt: 5, enc: encodeInt32, dec: decodeInt32 },         // int32
    'V': { wt: 5, enc: encodeUInt32, dec: decodeUInt32 },       // uint32
    // enum? (else int32)
};

// when a message is serialized [fields] should be written sequentially by field number
function _pack( format, data, buf, pos ) {
    for (var fieldnum=0, fi=0; fieldnum<data.length; fieldnum++) {
        if (data[fieldnum] === undefined) continue;
        var fmt = format[fi++];
        // if needed, insert support for multi-char formats here
        var conv = convMap[fmt];
        if (conv) {
            //encodeUVarint(fieldnum * 8 + conv.wt, buf, pos);
            encodeType(fieldnum, conv.wt, buf, pos);
            conv.enc(data[fieldnum], buf, pos);
        }
        else throw new Error(fmt + ": unknown pack conversion at offset " + fi);
    }
    return buf;
}

// NOTE: the fields are normally decoded according to the .proto type spec
// Each wire type can be decoded as various different types.
function _unpack( format, buf, pos ) {
    var data = new Array();
    var key, fieldnum, wiretype, conv;

    var len = format.length;
    for (var fi=0; fi<len; fi++) {
        key = decodeUVarint(buf, pos);
        wiretype = key & 7;
        fieldnum = key >>> 3;

        var fmt = format[fi];
        // if needed, insert support for multi-char formats here
        conv = convMap[fmt];
        if (conv) {
            data[fieldnum] = conv.dec(buf, pos);
        }
        else throw new Error(fmt + ": unknown unpack conversion at offset " + fi);

    }
    return data;
}

function encodeType( fieldnum, wiretype, buf, pos ) {
    encodeUVarint(fieldnum * 8 + wiretype, buf, pos);
}

function encodeUVarint( n, buf, pos ) {
    // TODO: if n < 0, while (n & 0x7f) { ... } ... but might end up with 1023 bits!!
    while (n >= 128) {
        buf[pos.p++] = 0x80 | (n & 0x7f);
        //n /= 128;
        n *= 0.0078125;
    }
    // TODO: this stores -1 as 127... is that a problem?
    buf[pos.p++] = n & 0x7f;
}

// negative numbers are stored in ones complement with a sign bit,
// e.g. -2 111110 => 00001.1 and -6 111010 => 00101.1
// "Ones complement" == "two's complement - 1", and "two's complement" is
// the negative of the number (on all cpus that javascript runs on).
function encodeVarint( n, buf, pos ) {
    var negative = (n < 0) ? 1 : 0;
    n = (n < 0) ? -n - 1 : n;

    buf[pos.p++] = ((n >= 64) ? 0x80 : 0x00) | ((n & 0x3f) << 1) | negative;
    if (n >= 64) encodeUVarint(n / 64, buf, pos);
}

// spec says negative int32 are always encoded as 10 bytes, so just use the Varint64 code.
// This breaks procol-buffers compat (which stores only 32 bits and leaves overlongs as positive).
// "If you use int32 or int64 as the type for a negative number, the resulting varint
// is always ten bytes long -- it is, effectively, treated like a very large unsigned
// integer." (encoding doc, "More Value Types").
function encodeVarint32( n, buf, pos ) {
    encodeVarint64(n, buf, pos);
}

// encode 64 bits of the twos complement value n
// Stored as unsigned, but will decode as a signed 64-bit int.
// Work with the ones complement halves to keep things positive,
// to not truncate (-1/2) to 0:  (1111.1 >>> 0) == 0.
function encodeVarint64( n, buf, pos ) {
    if (n >= 0) return encodeUVarint(n, buf, pos);

    n = -n - 1;
    var v1 = (0xFFFFFFFF ^ n) >>> 0;
    var v2 = (0xFFFFFFFF ^ (n / 0x100000000)) >>> 0;

    while (v2 > 0) {
        buf[pos.p++] = 0x80 | (v1 & 0x7f);
        v1 = ((v2 & 0x7f) << (32 - 7)) | (v1 >>> 7);
        v2 = v2 >>> 7;
    }
    while (v1 >= 0x100000000) { buf[pos.p++] = 0x80 | (v1 & 0x7f); v1 /= 128; }
    while (v1 >= 128) { buf[pos.p++] = 0x80 | (v1 & 0x7f); v1 >>>= 7; }
    buf[pos.p++] = v1 & 0x7f;
}

var tmpbuf = new Buffer(8);
function encodeFloat( v, buf, pos ) {
    fp.writeFloatLE(buf, v, (pos.p += 4) - 4);
}

function encodeDouble( v, buf, pos ) {
    fp.writeDoubleLE(buf, v, (pos.p += 8) - 8);
}

// store two-s complement little-endian 32-bit integer
function encodeInt32( v, buf, pos ) {
    buf[pos.p++] = (v      ) & 0xff;
    buf[pos.p++] = (v >>= 8) & 0xff;
    buf[pos.p++] = (v >>= 8) & 0xff;
    buf[pos.p++] = (v >>= 8) & 0xff;
}

function encodeUInt32( v, buf, pos ) {
    return encodeInt32(v, buf, pos);
}

// store two-s complement little-endian 64-bit integer
function encodeInt64( v, buf, pos ) {
    if (v < 0) return encodeVarint64(v, buf, pos);
    encodeUInt32(v &  0xffffffff, buf, pos);
    encodeUInt32(v / 0x100000000, buf, pos);
}

// store two-s complement little-endian 64-bit integer
function encodeUInt64( v, buf, pos ) {
    return encodeInt64(v, buf, pos);
}

function encodeString( str, buf, pos ) {
    if (Buffer.isBuffer(buf)) {
        encodeUVarint(Buffer.byteLength(str), buf, pos);
        pos.p += buf.write(str, pos.p);
    } else {
        encodeUVarint(qutf8.utf8_byteLength(str, 0, str.length), buf, pos);
        pos.p = qutf8.utf8_encode(str, 0, str.length, buf, pos.p);
    }
}

function encodeBinary( bytes, buf, pos ) {
    encodeUVarint(bytes.length, buf, pos);
    for (var i=0; i<bytes.length; i++) buf[pos.p++] = bytes[i];
}

function decodeUVarint( buf, pos ) {
    var byte = buf[pos.p++];
    if (! (byte & 0x80)) return byte;

    var val = byte & 0x7f;
    var scale = 128;
    do {
        byte = buf[pos.p++];
        val += (byte & 0x7f) * scale;
        scale *= 128;
    } while (byte & 0x80);
    return val;
}

function decodeVarint( buf, pos ) {
    var byte = buf[pos.p++];
    var val = (byte & 0x7e) >>> 1;
    if (! (byte & 0x80)) return (byte & 1) ? -val - 1 : val;

    // multi-byte values
    // decode as 0..63 or -1..-64
    val += 64 * decodeUVarint(buf, pos);
    return (byte & 1) ? -val - 1 : val;
}

// spec says negative int32 are always 10 bytes, so decode as Varint64
function decodeVarint32( buf, pos ) {
    return decodeVarint64(buf, pos);
}

// to recover -1 as negative, must not overflow 53 bits.
// decodeUVarint would overflow and round -1 ffff to +2e64, 10000.
// Gather the positive ones complement halves, then assemble.
// v1 holds the low 21 bits, v2 the high 43 bits.
// More than 64 bits is rejected as NaN.
var _2e21 = Math.pow(2, 21);
var _2e42 = Math.pow(2, 42);
var _2e43 = Math.pow(2, 43);
function decodeVarint64( buf, pos ) {
    var byte = buf[pos.p++];
    var v1 = (byte & 0x7f);
    if (! (byte & 0x80)) return v1;

    // low 21 bits
    byte = buf[pos.p++];
    v1 += (byte & 0x7f) << 7;
    if (! (byte & 0x80)) return v1;

    byte = buf[pos.p++];
    v1 += (byte & 0x7f) << 14;
    if (! (byte & 0x80)) return v1;

    // high 43 bits
    var v2 = decodeUVarint(buf, pos);

    if (v2 >= _2e43) return NaN;

    if (v2 < _2e42) return v2 * _2e21 + v1;     // positive
    v2 = -(_2e43 - v2);
    return v2 * _2e21 + v1;
}

var tmpbuf = new Buffer(8);
function decodeFloat( buf, pos ) {
    return fp.readFloatLE(buf, (pos.p += 4) - 4);
}

function decodeDouble( buf, pos) {
    return fp.readDoubleLE(buf, (pos.p += 8) - 8);
}

function decodeInt32( buf, pos ) {
    return buf[pos.p++] + (buf[pos.p++] << 8) + (buf[pos.p++] << 16) + (buf[pos.p++] << 24);
}

function decodeUInt32( buf, pos ) {
    return buf[pos.p++] + (buf[pos.p++] << 8) + (buf[pos.p++] << 16) + ((buf[pos.p++] << 24) >>> 0);
}

function decodeInt64( buf, pos ) {
    var negative = buf[pos.p + 7] & 0x80;
    return decodeUInt32(buf, pos) + decodeInt32(buf, pos) * 0x100000000;
}

function decodeUInt64( buf, pos ) {
    var negative = buf[pos.p + 7] & 0x80;
    return decodeUInt32(buf, pos) + decodeUInt32(buf, pos) * 0x100000000;
}

function decodeString( buf, pos ) {
    var len = decodeUVarint(buf, pos);
    var base = pos.p;
    // fast with toString
    if (Buffer.isBuffer(buf)) return buf.toString(undefined, base, pos.p += len);
    else return qutf8.utf8_decode(buf, base, pos.p += len);
}

function decodeBinary( buf, pos ) {
    var len = decodeUVarint(buf, pos);
    var bytes = new Buffer(len);
    for (var i=0; i<len; i++) bytes[i] = buf[pos.p++];
    return bytes;
}


/** quicktest:

var assert = require('assert');
var qtimeit = require('qtimeit');

assert.equal(decodeUVarint(new Buffer([0x9E, 0xA7, 0x05]), {p:0}), 86942);
assert.equal(decodeUVarint(new Buffer([0x8E, 0x02]), {p:0}), 270);
assert.equal(decodeUVarint(new Buffer([0xAC, 0x02]), {p:0}), 300);

var buf = new Buffer([0x82, 0x81, 0x01]);        // 1.000001.0 1.0000001 0.0000001 = 1 + 64 + 128*64 = 8257
var val = decodeVarint(buf, {p: 0});
console.log("AR:", val, buf);

// encode/decode unsigned varint
for (var i = 0; i < 100100; i++) {
    var buf = [];
    encodeUVarint(i, buf, {p:0})
    var n = decodeUVarint(buf, {p:0});
    assert.equal(i, n);
}

// encode/decode signed varint
for (var i = -100100; i < 100100; i++) {
    var buf = [];
    encodeVarint(i, buf, {p:0})
    var n = decodeVarint(buf, {p:0});
    assert.equal(i, n);
}

var str = "foo\u1234bar";
var buf = [];
encodeString(str, buf, {p:0});
console.log("AR:", buf);
assert.equal(decodeString(buf, {p:0}), str);

var qtimeit = require('qtimeit');

// first test
var data = [512, 513, 514, 515, "hello, world!  now is the time for the quick brown fox to jump over the lazy dog."];
var data = [512, 513, 514, 515, "hello, world"];
var format = "IIII";
var format = "IIIIa";

// bson test (ish):
var data = [ "ABC", 1, "DEFGHI\xff", 12345.67e-1, null ];
var format = "aiadb";

// protobufjs test
var format = "aVlqilbbbbbbbdf";
var data = [ "Lorem ipsum dolor sit amet.", 9000, 20161110, 151234 * 0x100000000 + 1051, 1, -42, 1, 0, 0, 1, 0, 0, 1, 204.8, 0.25 ];

var jsonString = JSON.stringify(data);
var jsonBuf = new Buffer(JSON.stringify(data));
var packBuf = pack(format, data);
var packArray = _pack(format, data, new Array(), {p:0});
//console.log("AR: pack/unpack buf", data, packBuf, _unpack(format, packBuf, {p:0}));
//console.log("AR: pack/unpack array", data, new Buffer(packArray), _unpack(format, packArray, {p:0}));

var tmpBuf = new Buffer(1000);
var floatBuf = new Buffer(4); floatBuf.writeFloatLE(1234.5);
assert.equal(decodeFloat(floatBuf, {p:0}), floatBuf.readFloatLE());
var doubleBuf = new Buffer(8); doubleBuf.writeDoubleLE(1234.5e-200);
var doubleBuf = new Buffer(8); doubleBuf.writeDoubleLE(1234.5);
assert.equal(decodeDouble(doubleBuf, {p:0}), doubleBuf.readDoubleLE());

if (1) {
var qtimeit = require('qtimeit');
var x;
qtimeit.bench.timeGoal = .20;
qtimeit.bench.visualize = true;
qtimeit.bench({
    'pack': function() { x = pack(format, data) },
    //  620 k/s into new Buffer(), 2000 k/s into array -> then new Buffer(). (small struct, 1k buf)
    // '_pack': function() { x = _pack(format, data, tmpBuf, {p:0}) },
    //  900 k/s
    '_pack arr': function() { x = _pack(format, data, new Array(), {p:0}) },
    //  900 k/s to buffer, 2000 k/s to array
    '_unpack': function() { x = _unpack(format, packBuf, {p:0}) },
    // 3100 k/s
    'unpack': function() { x = unpack(format, packBuf) },
    // 3450 k/s
    // 1600 k/s js, 600 k/s Buffer.read
    'jsonBuf': function() { x = JSON.parse(jsonBuf) },
    // 1760 k/s
    'jsonString': function() { x = JSON.parse(jsonString) },
    // 3100 k/s

    'pack2': function() { x = pack(format, data) },
});

console.log(x, unpack(format, x));
}
/**/
