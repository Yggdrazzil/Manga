import { xorDecrypt } from '../lib/api/mangaplus';

describe('xorDecrypt', () => {
  it('returns the buffer unchanged when no key is given', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(Array.from(xorDecrypt(bytes))).toEqual([1, 2, 3, 4]);
    expect(Array.from(xorDecrypt(new Uint8Array([9]), ''))).toEqual([9]);
  });

  it('is an involution: decrypting twice with the same key restores the input', () => {
    const original = new Uint8Array([0x00, 0xff, 0x42, 0x13, 0x99]);
    const key = 'a1b2c3';
    const once = xorDecrypt(original.slice(), key);
    expect(Array.from(once)).not.toEqual(Array.from(original));
    const twice = xorDecrypt(once, key);
    expect(Array.from(twice)).toEqual(Array.from(original));
  });

  it('cycles the key when shorter than the data', () => {
    // key 0xff XORs every byte; longer data than key forces the modulo cycle
    const bytes = new Uint8Array([0x00, 0x0f, 0xf0, 0xff]);
    const out = xorDecrypt(bytes, 'ff');
    expect(Array.from(out)).toEqual([0xff, 0xf0, 0x0f, 0x00]);
  });

  it('applies multi-byte keys positionally', () => {
    const bytes = new Uint8Array([0x10, 0x20, 0x30, 0x40]);
    // key bytes: [0x01, 0x02] → XOR [0x01,0x02,0x01,0x02]
    const out = xorDecrypt(bytes, '0102');
    expect(Array.from(out)).toEqual([0x11, 0x22, 0x31, 0x42]);
  });
});
