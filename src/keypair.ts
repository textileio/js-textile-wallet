import nacl from 'tweetnacl'
import { convertPublicKey, convertSecretKey } from 'ed2curve'
import { sign, verify } from './signing'
import { StrKey } from './strkey'

const nonceBytes = 24 // Length of nacl nonce
const ephemeralPublicKeyBytes = 32 // Length of nacl ephemeral public key

/**
 * `Keypair` represents public (and secret) keys of the account.
 *
 * Currently `Keypair` only supports ed25519 but in a future this class can be an abstraction
 * layer for other public-key signature systems.
 *
 * Copyright (c) 2015-2018 Stellar Development Foundation
 */
export class Keypair {
  /**
   * Creates a new `Keypair` instance from secret. This can either be secret key or secret seed depending
   * on underlying public-key signature system. Currently `Keypair` only supports ed25519.
   * @param secret secret key (ex. `SDAKFNYEIAORZKKCYRILFQKLLOCNPL5SWJ3YY5NM3ZH6GJSZGXHZEPQS`)
   */
  static fromSecret(secret: string) {
    const rawSecret = StrKey.decodeEd25519SecretSeed(secret)
    return this.fromRawEd25519Seed(rawSecret)
  }

  /**
   * Creates a new `Keypair` object from ed25519 secret key seed raw bytes.
   *
   * @param rawSeed Raw 32-byte ed25519 secret key seed
   */
  static fromRawEd25519Seed(rawSeed: Buffer) {
    return new this(rawSeed, 'ed25519')
  }

  /**
   * Create a random `Keypair` object.
   */
  static random() {
    const secret = nacl.randomBytes(32)
    return this.fromRawEd25519Seed(Buffer.from(secret))
  }

  pubKey: Buffer
  seed: Buffer
  privKey: Buffer
  type: 'ed25519'

  /**
   * Constructor
   * @param secretKey Raw secret key (32-byte secret seed in ed25519`)
   * @param type Public-key signature system name. (currently only `ed25519` keys are supported)
   */
  constructor(secretKey: Buffer, type?: 'ed25519') {
    if (type !== 'ed25519') {
      throw new Error('Invalid keys type')
    }
    this.type = type || 'ed25519'

    const secret = Buffer.from(secretKey)

    if (secret.length !== 32) {
      throw new Error('secretKey length is invalid')
    }
    const naclKeys = nacl.sign.keyPair.fromSeed(new Uint8Array(secret))

    this.seed = secret
    this.privKey = Buffer.from(naclKeys.secretKey)
    this.pubKey = Buffer.from(naclKeys.publicKey)
  }

  /**
   * Returns raw public key
   */
  rawPublicKey() {
    return this.pubKey
  }

  /**
   * Returns base58-encoded public key associated with this `Keypair` object.
   */
  publicKey() {
    return StrKey.encodeEd25519PublicKey(this.pubKey)
  }

  /**
   * Returns base58-encoded secret key associated with this `Keypair` object
   */
  secret() {
    if (this.type !== 'ed25519') {
      throw new Error('Invalid Keypair type')
    }
    return StrKey.encodeEd25519SecretSeed(this.seed)
  }

  /**
   * Returns raw secret key.
   */
  rawSecretKey() {
    return this.seed
  }

  /**
   * Returns `true` if this `Keypair` object contains secret key and can sign.
   */
  canSign() {
    return !!this.privKey
  }

  /**
   * Signs data.
   * @param data Data to sign
   */
  sign(data: Buffer) {
    if (!this.canSign()) {
      throw new Error('cannot sign: no secret key available')
    }
    return sign(data, this.privKey)
  }

  /**
   * Verifies if `signature` for `data` is valid.
   * @param data Signed data
   * @param signature Signature
   */
  verify(data: Buffer, signature: Buffer) {
    return verify(data, signature, this.pubKey)
  }

  /**
   * Encrypts the given `data` using a Curve25519 'variant' of the public key.
   *
   * The encryption uses an ephemeral private key, which is prepended to the ciphertext,
   * along with a nonce of random bytes.
   *
   * @note See https://github.com/dchest/ed2curve-js for conversion details.
   * @param data Data to encrypt
   */
  encrypt(data: Buffer) {
    if (this.type !== 'ed25519') {
      throw Error(`'${this.type}' type keys are not currently supported`)
    }
    // generated ephemeral key pair
    const ephemeral = nacl.box.keyPair()
    // convert recipient's key into curve25519 (assumes ed25519 keys)
    const pk = convertPublicKey(this.pubKey)
    if (!pk) {
      throw Error('could not convert key type')
    }
    // encrypt with nacl
    const nonce = nacl.randomBytes(24)
    const ciphertext = nacl.box(data, nonce, pk, ephemeral.secretKey)
    const merged = new Uint8Array(nonceBytes + ephemeralPublicKeyBytes + ciphertext.byteLength)
    // prepend nonce
    merged.set(new Uint8Array(nonce), 0)
    // then ephemeral public key
    merged.set(new Uint8Array(ephemeral.publicKey), nonceBytes)
    // then cipher text
    merged.set(new Uint8Array(ciphertext), nonceBytes + ephemeralPublicKeyBytes)
    return Buffer.from(merged)
  }

  /**
   * Decrypts the given `data` using a Curve25519 'variant' of the private key.
   *
   * Assumes ciphertext includes ephemeral public key and nonce used in original encryption
   * (e.g., via `encrypt`).
   *
   * @note See https://github.com/dchest/ed2curve-js for conversion details.
   * @param ciphertext Data to decrypt
   */
  decrypt(ciphertext: Buffer) {
    if (this.type !== 'ed25519') {
      throw Error(`'${this.type}' type keys are not currently supported`)
    }
    const pk = convertSecretKey(this.privKey)
    if (!pk) {
      throw Error('could not convert key type')
    }
    const nonce = ciphertext.slice(0, nonceBytes)
    const ephemeral = ciphertext.slice(nonceBytes, nonceBytes + ephemeralPublicKeyBytes)
    const ct = ciphertext.slice(nonceBytes + ephemeralPublicKeyBytes)
    const plaintext = nacl.box.open(ct, nonce, ephemeral, pk)
    if (!plaintext) {
      throw Error('failed to decrypt curve25519')
    }
    return Buffer.from(plaintext)
  }
}
