/**
 * @module utils.js
 * @author Westlad,Chaitanya-Konda,iAmMichaelConnor
 * @desc Set of utilities to manipulate variable into forms most liked by
 * Ethereum and Zokrates
 */

import BI from "big-integer";
import hexToBinary from "hex-to-binary";
import crypto from "crypto";
import safeBuffer from "safe-buffer";
import config from "./config/index.js";

const inputsHashLength = 32;

const { Buffer } = safeBuffer;

// FUNCTIONS ON HEX VALUES

/**
 * utility function to remove a leading 0x on a string representing a hex number.
 * If no 0x is present then it returns the string un-altered.
 */
export function strip0x(hex) {
  if (typeof hex === "undefined") return "";
  if (typeof hex === "string" && hex.indexOf("0x") === 0) {
    return hex.slice(2).toString();
  }
  return hex.toString();
}

export function isHex(h) {
  const regexp = /^[0-9a-fA-F]+$/;
  return regexp.test(strip0x(h));
}

/**
 * utility function to check that a string has a leading 0x (which the Solidity
 * compiler uses to check for a hex string).  It adds it if it's not present. If
 * it is present then it returns the string unaltered
 */
export function ensure0x(hex = "") {
  const hexString = hex.toString();
  if (typeof hexString === "string" && hexString.indexOf("0x") !== 0) {
    return `0x${hexString}`;
  }
  return hexString;
}

/**
 * Utility function to convert a string into a hex representation of fixed length.
 * @param {string} str - the string to be converted
 * @param {int} outLength - the length of the output hex string in bytes (excluding the 0x)
 * if the string is too short to fill the output hex string, it is padded on the left with 0s
 * if the string is too long, an error is thrown
 */
export function utf8StringToHex(str, outLengthBytes) {
  const outLength = outLengthBytes * 2; // work in characters rather than bytes
  const buf = Buffer.from(str, "utf8");
  let hex = buf.toString("hex");
  if (outLength < hex.length)
    throw new Error(
      "String is to long, try increasing the length of the output hex"
    );
  hex = hex.padStart(outLength, "00");
  return ensure0x(hex);
}

export function hexToUtf8String(hex) {
  const cleanHex = strip0x(hex).replace(/00/g, "");

  const buf = Buffer.from(cleanHex, "hex");
  return buf.toString("utf8");
}

/**
 * Converts hex strings into binary, so that they can be passed into merkle-proof.code
 * for example (0xff -> [1,1,1,1,1,1,1,1])
 */
export function hexToBin(hex) {
  return hexToBinary(strip0x(hex)).split("");
}

/** Helper function for the converting any base to any base
 */
export function parseToDigitsArray(str, base) {
  const digits = str.split("");
  const ary = [];
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const n = parseInt(digits[i], base);
    if (Number.isNaN(n)) return null;
    ary.push(n);
  }
  return ary;
}

/** Helper function for the converting any base to any base
 */
export function add(x, y, base) {
  const z = [];
  const n = Math.max(x.length, y.length);
  let carry = 0;
  let i = 0;
  while (i < n || carry) {
    const xi = i < x.length ? x[i] : 0;
    const yi = i < y.length ? y[i] : 0;
    const zi = carry + xi + yi;
    z.push(zi % base);
    carry = Math.floor(zi / base);
    i += 1;
  }
  return z;
}

/** Helper function for the converting any base to any base
 * Returns a*x, where x is an array of decimal digits and a is an ordinary
 * JavaScript number. base is the number base of the array x.
 */
export function multiplyByNumber(num, x, base) {
  if (num < 0) return null;
  if (num === 0) return [];

  let result = [];
  let power = x;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-bitwise
    if (num & 1) {
      result = add(result, power, base);
    }
    num >>= 1; // eslint-disable-line
    if (num === 0) break;
    power = add(power, power, base);
  }
  return result;
}

/** Helper function for the converting any base to any base
 */
export function convertBase(str, fromBase, toBase) {
  const digits = parseToDigitsArray(str, fromBase);
  if (digits === null) return null;

  let outArray = [];
  let power = [1];
  for (let i = 0; i < digits.length; i += 1) {
    // invariant: at this point, fromBase^i = power
    if (digits[i]) {
      outArray = add(
        outArray,
        multiplyByNumber(digits[i], power, toBase),
        toBase
      );
    }
    power = multiplyByNumber(fromBase, power, toBase);
  }

  let out = "";
  for (let i = outArray.length - 1; i >= 0; i -= 1) {
    out += outArray[i].toString(toBase);
  }
  // if the original input was equivalent to zero, then 'out' will still be empty ''. Let's check for zero.
  if (out === "") {
    let sum = 0;
    for (let i = 0; i < digits.length; i += 1) {
      sum += digits[i];
    }
    if (sum === 0) out = "0";
  }

  return out;
}

// the hexToBinary library was giving some funny values with 'undefined' elements within the binary string. Using convertBase seems to be working nicely. THe 'Simple' suffix is to distinguish from hexToBin, which outputs an array of bit elements.
export function hexToBinSimple(hex) {
  const bin = convertBase(strip0x(hex), 16, 2);
  return bin;
}

/**
 * Converts hex strings into byte (decimal) values.  This is so that they can
 * be passed into  merkle-proof.code in a more compressed fromat than bits.
 * Each byte is invididually converted so 0xffff becomes [15,15]
 */
export function hexToBytes(hex) {
  const cleanHex = strip0x(hex);
  const out = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const h = ensure0x(cleanHex[i] + cleanHex[i + 1]);
    out.push(parseInt(h, 10).toString());
  }
  return out;
}

// Converts hex strings to decimal values
export function hexToDec(hexStr) {
  if (hexStr.substring(0, 2) === "0x") {
    return convertBase(hexStr.substring(2).toLowerCase(), 16, 10);
  }
  return convertBase(hexStr.toLowerCase(), 16, 10);
}

/** converts a hex string to an element of a Finite Field GF(fieldSize) (note, decimal representation is used for all field elements)
 * @param {string} hexStr A hex string.
 * @param {integer} fieldSize The number of elements in the finite field.
 * @return {string} A Field Value (decimal value) (formatted as string, because they're very large)
 */
export function hexToField(hexStr, fieldSize) {
  const cleanHexStr = strip0x(hexStr);
  const decStr = hexToDec(cleanHexStr);
  const q = BI(fieldSize);
  return BI(decStr)
    .mod(q)
    .toString();
}

/**
 * Left-pads the input hex string with zeros, so that it becomes of size N octets.
 * @param {string} hexStr A hex number/string.
 * @param {integer} N The string length (i.e. the number of octets).
 * @return A hex string (padded) to size N octets, (plus 0x at the start).
 */
export function leftPadHex(hexStr, n) {
  return ensure0x(strip0x(hexStr).padStart(n, "0"));
}

/**
 * Used by splitAndPadBitsN function.
 * Left-pads the input binary string with zeros, so that it becomes of size N bits.
 * @param {string} bitStr A binary number/string.
 * @param {integer} N The 'chunk size'.
 * @return A binary string (padded) to size N bits.
 */
export function leftPadBitsN(bitStr, n) {
  const len = bitStr.length;
  let paddedStr;
  if (len > n) {
    return new Error(`String larger than ${n} bits passed to leftPadBitsN`);
  }
  if (len === n) {
    return bitStr;
  }
  paddedStr = "0".repeat(n - len);
  paddedStr = paddedStr.toString() + bitStr.toString();
  return paddedStr;
}

/**
 * Used by split'X'ToBitsN functions.
 * Checks whether a binary number is larger than N bits, and splits its binary representation into chunks of size = N bits. The left-most (big endian) chunk will be the only chunk of size <= N bits. If the inequality is strict, it left-pads this left-most chunk with zeros.
 * @param {string} bitStr A binary number/string.
 * @param {integer} N The 'chunk size'.
 * @return An array whose elements are binary 'chunks' which altogether represent the input binary number.
 */
export function splitAndPadBitsN(bitStr, n) {
  let a = [];
  const len = bitStr.length;
  if (len <= n) {
    return [leftPadBitsN(bitStr, n)];
  }
  const nStr = bitStr.slice(-n); // the rightmost N bits
  const remainderStr = bitStr.slice(0, len - n); // the remaining rightmost bits

  a = [...splitAndPadBitsN(remainderStr, n), nStr, ...a];

  return a;
}

/** Checks whether a hex number is larger than N bits, and splits its binary representation into chunks of size = N bits. The left-most (big endian) chunk will be the only chunk of size <= N bits. If the inequality is strict, it left-pads this left-most chunk with zeros.
 * @param {string} hexStr A hex number/string.
 * @param {integer} N The 'chunk size'.
 * @return An array whose elements are binary 'chunks' which altogether represent the input hex number.
 */
export function splitHexToBitsN(hexStr, n) {
  const strippedHexStr = strip0x(hexStr);
  const bitStr = hexToBinSimple(strippedHexStr.toString());
  let a = [];
  a = splitAndPadBitsN(bitStr, n);
  return a;
}

// Converts binary value strings to decimal values
export function binToDec(binStr) {
  const dec = convertBase(binStr, 2, 10);
  return dec;
}

/** Preserves the magnitude of a hex number in a finite field, even if the order of the field is smaller than hexStr. hexStr is converted to decimal (as fields work in decimal integer representation) and then split into chunks of size packingSize. Relies on a sensible packing size being provided (ZoKrates uses packingSize = 128).
 *if the result has fewer elements than it would need for compatibiity with the dsl, it's padded to the left with zero elements
 */
export function hexToFieldPreserve(
  hexStr,
  packingSize,
  packets,
  silenceWarnings
) {
  let bitsArr = [];
  bitsArr = splitHexToBitsN(strip0x(hexStr).toString(), packingSize.toString());

  let decArr = []; // decimal array
  decArr = bitsArr.map(item => binToDec(item.toString()));

  // fit the output array to the desired number of packets:
  if (packets !== undefined) {
    if (packets < decArr.length) {
      const overflow = decArr.length - packets;
      if (!silenceWarnings)
        throw new Error(
          `Field split into an array of ${decArr.length} packets: ${decArr}
          , but this exceeds the requested packet size of ${packets}. Data would have been lost; possibly unexpectedly. To silence this warning, pass '1' or 'true' as the final parameter.`
        );
      // remove extra packets (dangerous!):
      for (let i = 0; i < overflow; i += 1) decArr.shift();
    } else {
      const missing = packets - decArr.length;
      // add any missing zero elements
      for (let i = 0; i < missing; i += 1) decArr.unshift("0");
    }
  }
  return decArr;
}

// Converts binary value strings to hex values
export function binToHex(binStr) {
  const hex = convertBase(binStr, 2, 16);
  return hex ? `0x${hex}` : null;
}

// FUNCTIONS ON DECIMAL VALUES

// Converts decimal value strings to hex values
export function decToHex(decStr) {
  const hex = convertBase(decStr, 10, 16);
  return hex ? `0x${hex}` : null;
}

// Converts decimal value strings to binary values
export function decToBin(decStr) {
  return convertBase(decStr, 10, 2);
}

export function decToPaddedHex(decStr, length) {
  const hex = decToHex(decStr);
  return leftPadHex(hex, length);
}

/** Checks whether a decimal integer is larger than N bits, and splits its binary representation into chunks of size = N bits. The left-most (big endian) chunk will be the only chunk of size <= N bits. If the inequality is strict, it left-pads this left-most chunk with zeros.
 * @param {string} decStr A decimal number/string.
 * @param {integer} N The 'chunk size'.
 * @return An array whose elements are binary 'chunks' which altogether represent the input decimal number.
 */
export function splitDecToBitsN(decStr, N) {
  const bitStr = decToBin(decStr.toString());
  let a = [];
  a = splitAndPadBitsN(bitStr, N);
  return a;
}

export function isProbablyBinary(arr) {
  const foundField = arr.find(el => el !== 0 && el !== 1);
  // ...hence it is not binary:
  return !foundField;
}

// FUNCTIONS ON FIELDS

/**
 * Converts an array of Field Elements (decimal numbers which are smaller in magnitude than the field size q), where the array represents a decimal of magnitude larger than q, into the decimal which the array represents.
 * @param {[string]} fieldsArr is an array of (decimal represented) field elements. Each element represents a number which is 2**128 times larger than the next in the array. So the 0th element of fieldsArr requires the largest left-shift (by a multiple of 2**128), and the last element is not shifted (shift = 1). The shifted elements should combine (sum) to the underlying decimal number which they represent.
 * @param {integer} packingSize Each field element of fieldsArr is a 'packing' of exactly 'packingSize' bits. I.e. packingSize is the size (in bits) of each chunk (element) of fieldsArr. We use this to reconstruct the underlying decimal value which was, at some point previously, packed into a fieldsArr format.
 * @returns {string} A decimal number (as a string, because it might be a very large number)
 */
export function fieldsToDec(fieldsArr, packingSize) {
  const len = fieldsArr.length;
  let acc = new BI("0");
  const s = [];
  const t = [];
  const shift = [];
  const exp = new BI(2).pow(packingSize);
  for (let i = 0; i < len; i += 1) {
    s[i] = new BI(fieldsArr[i].toString());
    shift[i] = new BI(exp).pow(len - 1 - i); // binary shift of the ith field element
    t[i] = new BI("0");
    t[i] = s[i].multiply(shift[i]);
    acc = acc.add(t[i]);
  }
  const decStr = acc.toString();
  return decStr;
}

// UTILITY FUNCTIONS:

/**
 * Utility function to xor to two hex strings and return as buffer
 * Looks like the inputs are somehow being changed to decimal!
 */
export function xor(a, b) {
  const length = Math.max(a.length, b.length);
  const buffer = Buffer.allocUnsafe(length); // creates a buffer object of length 'length'
  for (let i = 0; i < length; i += 1) {
    buffer[i] = a[i] ^ b[i]; // eslint-disable-line
  }
  // a.forEach((item)=>logger.debug("xor input a: " + item))
  // b.forEach((item)=>logger.debug("xor input b: " + item))
  // buffer.forEach((item)=>logger.debug("xor outputs: " + item))
  return buffer;
}

/**
 * Utility function to concatenate two hex strings and return as buffer
 * Looks like the inputs are somehow being changed to decimal!
 */
export function concatenate(a, b) {
  const length = a.length + b.length;
  const buffer = Buffer.allocUnsafe(length); // creates a buffer object of length 'length'
  for (let i = 0; i < a.length; i += 1) {
    buffer[i] = a[i];
  }
  for (let j = 0; j < b.length; j += 1) {
    buffer[a.length + j] = b[j];
  }
  return buffer;
}

/**
 * Utility function:
 * hashes a concatenation of items but it does it by
 * breaking the items up into 432 bit chunks, hashing those, plus any remainder
 * and then repeating the process until you end up with a single hash.  That way
 * we can generate a hash without needing to use more than a single sha round.  It's
 * not the same value as we'd get using rounds but it's at least doable.
 */
export function hash(item) {
  const preimage = strip0x(item);

  const h = `0x${crypto
    .createHash("sha256")
    .update(preimage, "hex")
    .digest("hex")
    .slice(-(inputsHashLength * 2))}`;
  return h;
}

/**
 * Utility function to:
 * - convert each item in items to a 'buffer' of bytes (2 hex values), convert those bytes into decimal representation
 * - 'concatenate' each decimally-represented byte together into 'concatenated bytes'
 * - hash the 'buffer' of 'concatenated bytes' (sha256) (sha256 returns a hex output)
 * - truncate the result to the right-most 64 bits
 * Return:
 * createHash: we're creating a sha256 hash
 * update: [input string to hash (an array of bytes (in decimal representaion) [byte, byte, ..., byte] which represents the result of: item1, item2, item3. Note, we're calculating hash(item1, item2, item3) ultimately]
 * digest: [output format ("hex" in our case)]
 * slice: [begin value] outputs the items in the array on and after the 'begin value'
 */
export function concatenateThenHash(...items) {
  const concatvalue = items
    .map(item => Buffer.from(strip0x(item), "hex"))
    .reduce((acc, item) => concatenate(acc, item));

  const h = `0x${crypto
    .createHash("sha256")
    .update(concatvalue, "hex")
    .digest("hex")}`;
  return h;
}

/**
 * function to generate a promise that resolves to a string of hex
 * @param {int} bytes - the number of bytes of hex that should be returned
 */
export function randomHex(bytes) {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(bytes, (err, buf) => {
      if (err) reject(err);
      resolve(`0x${buf.toString("hex")}`);
    });
  });
}

/* flattenDeep converts a nested array into a flattened array. We use this to pass our proofs and vks into the verifier contract.
 * Example:
 * A vk of the form:
 * [
 *   [
 *     [ '1','2' ],
 *     [ '3','4' ]
 *   ],
 *     [ '5','6' ],
 *     [
 *       [ '7','8' ], [ '9','10' ]
 *     ],
 * ]
 *
 * is converted to:
 * ['1','2','3','4','5','6',...]
 */
export function flattenDeep(arr) {
  return arr.reduce(
    (acc, val) =>
      Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val),
    []
  );
}

// function to pad out a Hex value with leading zeros to l bits total length,
// preserving the '0x' at the start
export function padHex(A, l) {
  if (l % 8 !== 0)
    throw new Error("cannot convert bits into a whole number of bytes");
  return ensure0x(strip0x(A).padStart(l / 4, "0"));
}

/**
export function to compute the sequence of numbers that go after the 'a' in:
$ 'zokrates compute-witness -a'.
These will be passed into a ZoKrates container by zokrates.js to compute a witness.
Note that we don't always encode these numbers in the same way (sometimes they are individual bits, sometimes more complex encoding is used to save space e.g. fields ).
@param {array} elements - the array of Element objects that represent the parameters we wish to encode for ZoKrates.
*/

export function formatInputsForZkSnark(elements) {
  let a = [];
  elements.forEach(element => {
    switch (element.encoding) {
      case "bits":
        a = a.concat(hexToBin(strip0x(element.hex)));
        break;

      case "bytes":
        a = a.concat(hexToBytes(strip0x(element.hex)));
        break;

      case "field":
        // each vector element will be a 'decimal representation' of integers modulo a prime. p=21888242871839275222246405745257275088548364400416034343698204186575808495617 (roughly = 2*10e76 or = 2^254)
        a = a.concat(
          hexToFieldPreserve(
            element.hex,
            element.packingSize,
            element.packets,
            1
          )
        );
        break;

      default:
        throw new Error("Encoding type not recognised");
    }
  });
  return a;
}

export function gasUsedStats(txReceipt, functionName) {
  console.log(`\nGas used in ${functionName}:`);
  const { gasUsed } = txReceipt.receipt;
  const gasUsedLog = txReceipt.logs.filter(log => {
    return log.event === "GasUsed";
  });
  const gasUsedByShieldContract = Number(
    gasUsedLog[0].args.byShieldContract.toString()
  );
  const gasUsedByVerifierContract = Number(
    gasUsedLog[0].args.byVerifierContract.toString()
  );
  const refund = gasUsedByVerifierContract + gasUsedByShieldContract - gasUsed;
  console.log("Total:", gasUsed);
  console.log("By shield contract:", gasUsedByShieldContract);
  console.log("By verifier contract (pre refund):", gasUsedByVerifierContract);
  console.log("Refund:", refund);
  console.log("Attributing all of refund to the verifier contract...");
  console.log(
    "By verifier contract (post refund):",
    gasUsedByVerifierContract - refund
  );
}

/**
This class defines a 'proof element'.  That's basically an object that will be fed to token-format-inputs.js so that it can generate the witness string for a proof.
We are now potentially using different encoding for each of the elements and formatInputsForZkSnark() needs to know which encoding we have applied.  For example we may take the hex representation of an element and encode it as a string of uint bits or bytes. Hence, this becomes an object, rather than a simple number, so that it can carry the encoding. Sometimes the encoding will split the element across multiple witness fields and we will want to define how many fields.  This is what the packets property is used for.
*/
export function toProofElement(_hex, encoding, packingSize, packets) {
  const hex = _hex.toString(16);
  const allowedEncoding = ["bits", "bytes", "field"];

  if (!allowedEncoding.includes(encoding))
    throw new Error("Element encoding must be one of:", allowedEncoding);

  if (hex === undefined) throw new Error("Hex string was undefined");
  if (hex === "") throw new Error("Hex string was empty");

  return {
    hex: ensure0x(hex),
    encoding,
    packingSize:
      encoding === "field"
        ? packingSize || config.ZOKRATES_PACKING_SIZE
        : undefined,
    packets
  };
}

// TEST

const treeHeight = config.MERKLE_TREE_HEIGHT;
const treeWidth = 2 ** treeHeight;

export function rightShift(integer, shift) {
  return Math.floor(integer / 2 ** shift);
}

export function leftShift(integer, shift) {
  return integer * 2 ** shift;
}

// INDEX CONVERSIONS

export function leafIndexToNodeIndex(_leafIndex) {
  const leafIndex = Number(_leafIndex);
  return leafIndex + treeWidth - 1;
}

export function nodeIndexToLeafIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return nodeIndex + 1 - treeWidth;
}

// export function nodeIndexToRow(_nodeIndex) {
//   const nodeIndex = Number(_nodeIndex);
//   return Math.floor(Math.log2(nodeIndex + 1));
// }

// export function nodeIndexToLevel(_nodeIndex) {
//   const row = nodeIndexToRow(_nodeIndex);
//   return treeHeight - row;
// }

// 'DECIMAL' NODE INDICES

export function siblingNodeIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  /*
  odd? then the node is a left-node, so sibling is to the right.
  even? then the node is a right-node, so sibling is to the left.
  */
  return nodeIndex % 2 === 1 ? nodeIndex + 1 : nodeIndex - 1;
}

export function parentNodeIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return nodeIndex % 2 === 1
    ? rightShift(nodeIndex, 1)
    : rightShift(nodeIndex - 1, 1);
}

export function leftChildNodeIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return leftShift(nodeIndex, 1) + 1;
}

export function rightChildNodeIndex(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  return leftShift(nodeIndex, 1) + 2;
}

// BINARY INDICES

export function siblingBinaryIndex(binaryIndex) {
  /*
  even? then the node is a left-node, so sibling is to the right.
  odd? then the node is a right-node, so sibling is to the left.
  */
  return binaryIndex % 2 === 0 ? binaryIndex + 1 : binaryIndex - 1;
}

export function parentBinaryIndex(binaryIndex) {
  // the root has no binary index; it's a special case
  if (binaryIndex === 0 || binaryIndex === 1) return "root";

  return rightShift(binaryIndex, 1);
}

export function leftChildBinaryIndex(binaryIndex) {
  // the root is a special case with no binary index; it's input as a string 'root'
  if (binaryIndex === "root") return 0;

  return leftShift(binaryIndex, 1);
}

export function rightChildBinaryIndex(binaryIndex) {
  // the root is a special case with no binary index; it's input as a string 'root'
  if (binaryIndex === "root") return 1;

  return leftShift(binaryIndex, 1) + 1;
}

// COMPLEX TREE export FUNCTIONS

/**
Recursively calculate the indices of the path from a particular leaf up to the root.
@param {integer} nodeIndex - the nodeIndex of the leaf for which we wish to calculate the siblingPathIndices. Not to be confused with leafIndex.
*/
export function getPathIndices(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  if (nodeIndex === 0) return [0]; // terminal case

  const indices = getPathIndices(parentNodeIndex(nodeIndex));

  // push this node to the final output array, as we escape from the recursion:
  indices.push(nodeIndex);
  return indices;
}

/**
Recursively calculate the indices of the sibling path of a particular leaf up to the root.
@param {integer} nodeIndex - the nodeIndex of the leaf for which we wish to calculate the siblingPathIndices. Not to be confused with leafIndex.
*/
export function getSiblingPathIndices(_nodeIndex) {
  const nodeIndex = Number(_nodeIndex);
  if (nodeIndex === 0) return [0]; // terminal case

  const indices = getSiblingPathIndices(parentNodeIndex(nodeIndex));

  // push the sibling of this node to the final output array, as we escape from the recursion:
  indices.push(siblingNodeIndex(nodeIndex));
  return indices;
}

/**
A js implementation of the corresponding Solidity export function in MerkleTree.sol
*/
export function getFrontierSlot(leafIndex) {
  let slot = 0;
  if (leafIndex % 2 === 1) {
    let exp1 = 1;
    let pow1 = 2;
    let pow2 = pow1 << 1;
    while (slot === 0) {
      if ((leafIndex + 1 - pow1) % pow2 === 0) {
        slot = exp1;
      } else {
        pow1 = pow2;
        pow2 <<= 1;
        exp1 += 1;
      }
    }
  }
  return slot;
}

/**
A js implementation of the corresponding Solidity export function in MerkleTree.sol
@notice KEEP ALL CONSOLE LOGGING (even if commented out) FOR FUTURE DEBUGGING.
*/
export async function updateNodes(
  leafValues,
  currentLeafCount,
  frontier,
  updateNodesFunction
) {
  console.log(`\nsrc/utils-merkle-tree updateNodes()`);

  const newFrontier = frontier;

  // check that space exists in the tree:
  const numberOfLeavesAvailable = treeWidth - currentLeafCount;
  const numberOfLeaves = Math.min(leafValues.length, numberOfLeavesAvailable);

  let slot;
  let nodeIndex;
  let nodeValueFull; // the node value before truncation (truncation is sometimes done so that the nodeValue (when concatenated with another) fits into a single hashing round in the next hashing iteration up the tree).
  let nodeValue; // the truncated nodeValue

  // consider each new leaf in turn, from left to right:
  for (
    let leafIndex = currentLeafCount;
    leafIndex < currentLeafCount + numberOfLeaves;
    leafIndex++
  ) {
    nodeValueFull = leafValues[leafIndex - currentLeafCount];
    nodeValue = `0x${nodeValueFull.slice(
      -config.MERKLE_TREE_NODE_HASHLENGTH * 2
    )}`; // truncate hashed value, so it 'fits' into the next hash.
    nodeIndex = leafIndexToNodeIndex(leafIndex, treeWidth); // convert the leafIndex to a nodeIndex

    slot = getFrontierSlot(leafIndex); // determine at which level we will next need to store a nodeValue

    if (slot === 0) {
      // console.log('below slot');
      // console.log('level', 0);
      // console.log('slot', slot);
      newFrontier[slot] = nodeValue; // store in frontier
      // console.log('frontier', frontier);
      continue; // eslint-disable-line no-continue
    }

    // hash up to the level whose nodeValue we'll store in the frontier slot:
    for (let level = 1; level <= slot; level++) {
      // console.log('below slot');
      // console.log('level', level);
      // console.log('slot', slot);
      if (nodeIndex % 2 === 0) {
        // even nodeIndex
        // console.log('leafIndex', leafIndex);
        // console.log('nodeIndex', nodeIndex);
        // console.log('left input', frontier[level - 1]);
        // console.log('right input', nodeValue);
        nodeValueFull = concatenateThenHash(frontier[level - 1], nodeValue); // the parentValue, but will become the nodeValue of the next level
        nodeValue = `0x${nodeValueFull.slice(
          -config.MERKLE_TREE_NODE_HASHLENGTH * 2
        )}`; // truncate hashed value, so it 'fits' into the next hash.
        // console.log('output', nodeValue);
      } else {
        // odd nodeIndex
        // console.log('leafIndex', leafIndex);
        // console.log('nodeIndex', nodeIndex);
        // console.log('left input', nodeValue);
        // console.log('right input', config.ZERO);
        nodeValueFull = concatenateThenHash(
          nodeValue,
          "0x000000000000000000000000000000000000000000000000000000"
        ); // the parentValue, but will become the nodeValue of the next level
        nodeValue = `0x${nodeValueFull.slice(
          -config.MERKLE_TREE_NODE_HASHLENGTH * 2
        )}`; // truncate hashed value, so it 'fits' into the next hash.
        // console.log('output', nodeValue);
      }
      console.log(nodeIndex, nodeValue)
      nodeIndex = parentNodeIndex(nodeIndex); // move one row up the tree

      // add the node to the db:
      const node = {
        value: nodeValue,
        nodeIndex
      };
      if (!updateNodesFunction) {
        // e.g. for use NOT with a db
        console.log(node);
      } else {
        await updateNodesFunction(node); // eslint-disable-line no-await-in-loop
      }
    }

    newFrontier[slot] = nodeValue; // store in frontier
  }

  // So far we've added all leaves, and hashed up to a particular level of the tree. We now need to continue hashing from that level until the root:
  for (let level = slot + 1; level <= treeHeight; level++) {
    // console.log('above slot');
    // console.log('level', level);
    // console.log('slot', slot);
    if (nodeIndex % 2 === 0) {
      // even nodeIndex
      // console.log('nodeIndex', nodeIndex);
      // console.log('left input', frontier[level - 1]);
      // console.log('right input', nodeValue);
      nodeValueFull = concatenateThenHash(frontier[level - 1], nodeValue); // the parentValue, but will become the nodeValue of the next level
      nodeValue = `0x${nodeValueFull.slice(
        -config.MERKLE_TREE_NODE_HASHLENGTH * 2
      )}`; // truncate hashed value, so it 'fits' into the next hash.
      // console.log('output', nodeValue);
    } else {
      // odd nodeIndex
      // console.log('nodeIndex', nodeIndex);
      // console.log('left input', nodeValue);
      // console.log('right input', config.ZERO);
      nodeValueFull = concatenateThenHash(
        nodeValue,
        "0x000000000000000000000000000000000000000000000000000000"
      ); // the parentValue, but will become the nodeValue of the next level
      nodeValue = `0x${nodeValueFull.slice(
        -config.MERKLE_TREE_NODE_HASHLENGTH * 2
      )}`; // truncate hashed value, so it 'fits' into the next hash.
      // console.log('output', nodeValue);
    }
    nodeIndex = parentNodeIndex(nodeIndex); // move one row up the tree
    const node = {
      value: nodeIndex === 0 ? nodeValueFull : nodeValue, // we can add the full 32-byte root (nodeIndex=0) to the db, because it doesn't need to fit into another hash round.
      nodeIndex
    };
    if (!updateNodesFunction) {
      console.log(node);
    } else {
      // add the node to the db
      await updateNodesFunction(node); // eslint-disable-line no-await-in-loop
    }
  }
  const root = nodeValueFull;
  console.log("root:", root);

  return [root, newFrontier];
}

/**
Calculates the exact number of hashes required to add a consecutive batch of leaves to a tree
@param {integer} maxLeafIndex - the highest leafIndex of the batch
@param {integer} minLeafIndex - the lowest leafIndex of the batch
@param {integer} height - the height of the merkle tree
*/
export function getNumberOfHashes(
  maxLeafIndex,
  minLeafIndex,
  height = treeHeight
) {
  let hashCount = 0;
  let increment;
  let hi = Number(maxLeafIndex);
  let lo = Number(minLeafIndex);
  const batchSize = hi - lo + 1;
  const binHi = hi.toString(2); // converts to binary
  const bitLength = binHi.length;

  for (let level = 0; level < bitLength; level += 1) {
    increment = hi - lo;
    hashCount += increment;
    hi = rightShift(hi, 1);
    lo = rightShift(lo, 1);
  }
  console.log({ hi, lo, batchSize, binHi, bitLength });
  return hashCount + height - (batchSize - 1);
}

/**
For debugging the correctness of getNumberOfHashes: Loops through a calculation of the numberOfHashes for a given batch size, at every leafIndex of the tree.
@param {integer} batchSize - the number of leaves in the batch
@param {integer} height - the height of the merkle tree
*/
export function loopNumberOfHashes(batchSize, height) {
  let lo;
  let hi;
  const width = 2 ** height;
  for (let i = 0; i < width - batchSize + 1; i += 1) {
    lo = i;
    hi = i + batchSize - 1;
    const numberOfHashes = getNumberOfHashes(hi, lo, height);
    console.log(`(${hi}, ${lo}) = ${numberOfHashes}`);
  }
  return true;
}
