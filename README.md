protobuf-lite
=============

Light-weight protocol buffers implementation.  Reads and writes the wire protocol and
converts some of the more common data types.  The program data is kept in native
JavaScript format, so no true 64-bit ints. Also no maps, services, groups, extensions,
no .proto file parsing.

On the other hand, it is possible to decode protobuf numbers and strings with a single
call, eg

    // pack as varint, uint32, string, float
    var buf = pbuflite.pack('iVaf', [123, 4.5, 'hello', 1234.5 ]);
    var items = pbuflite.unpack('iVaf', buf);
    // => [ 123, 4, 'hello', 1234.5 ]

*NOTE* This is a work in progress.  The code seems to work, but testing has been very
light.  Not much error checking yet internally.


Api
---

### pack( format, array )

Encode the data in the `array` accorting to the `format`, and return
a Buffer containing the packed bytes.

### _pack( format, array, bytebuf, pos )

Encode the data into the given buffer `bytebuf` starting at offset `pos.p`.
`bytebuf` may also be an array.

### unpack( format, bytebuf )

Decode the binary data in `bytebuf` according to the `format`.
Returns an array, possibly sparse, of data items.

### _unpack( format, bytebuf, pos )

Dencode the data in `bytes` starting at position `pos.p`.
`bytebuf` may also be an array.


Format
------

The pack/unpack `format` is a concatenated series of conversion specifiers, one per
data item.  Skipping items is not yet supported.  The conversion specifiers were
deliberately patterned after `PERL pack()`.

For example, the format `'iVad'` would store the first four data items from the input
array, packing them as `varint`, `uint32`, `string` and `double64`, respectively.
The number of data items converted is controlled by the format string.

As of 12/6/17:

    'i': { wt: 0, enc: encodeVarint, dec: decodeVarint },       // int
    'I': { wt: 0, enc: encodeUVarint, dec: decodeUVarint },     // uint
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


Todo
----

- needs tests
- split out float/double decoding into a separate package


Related Work
------------

- [`google-protobuf`](https://npmjs.com/package/google-protobuf)
- [`protocol-buffers`](https://npmjs.com/package/protocol-buffers)
- [`protocol-buffers-schema`](https://npmjs.com/package/protocol-buffers-schema)
- [`protobufjs`](https://npmjs.com/package/protobufjs)
- [`protobuf`](https://npmjs.com/package/protobuf)
- [`qbson`](https://github.com/andrasq/node-qbson)
- [`qunpack`](https://npmjs.com/package/qunpack)
