import bip39 from 'bip39'
import { BIP32 } from './bip32'
import { Keypair } from './keypair'
import { hmacSHA512 } from './crypto'

export * from './keypair'

/**
 * A derived Wallet account
 * @property index The index for the given account
 * @property keypair The associated account Keypair
 */
export interface Account {
  index: number | number[]
  keypair: Keypair
}

// Textile account path format used for key pair derivation as described in SEP-00XX
const bip44Path = `m/44'/406'`

// Derive the 'm' level of the BIP44 wallet
function createMasterKey(seed: Buffer) {
  // As in https://github.com/satoshilabs/slips/blob/master/slip-0010.md
  const I = hmacSHA512('ed25519 seed', seed)
  const privateKey = I.slice(0, 32)
  const chainCode = I.slice(32)
  return BIP32.fromPrivateKey(privateKey, chainCode)
}

/**
 * Wallet is an API module for initializing wallets and creating/accessing accounts
 *
 * A wallet is represented by mnemonic phrase, and in practice is a BIP32 Hierarchical
 * Deterministic Wallet based on Stellar's implementation of SLIP-0010. You can think of a wallet
 * as a master key, and the account represent keys specific to a given application or use-case.
 * Any given wallet may create an arbitrary number of accounts.
 *
 * Accounts are generated via the wallet pass-phrase and are an Ed25519 public/private keypair
 * used to sign backups, provision libp2p identities, etc. Textile uses Ed25519 here because
 * it's fast, compact, secure, and widely used. See the EdDSA Wikipedia page for more details.
 */
export class Wallet {
  /** Generate a new Wallet from a given word count */
  static fromWordCount(wordCount: number) {
    return Wallet.fromEntropy(
      (count => {
        switch (count) {
          case 12:
            return 128
          case 15:
            return 160
          case 18:
            return 192
          case 21:
            return 225
          case 24:
            return 256
          default:
            return 256
        }
      })(wordCount),
    )
  }

  /**
   * Generate a new Walet from a given entropy level
   * @param strength The bits of entropy to use (defaults to 128)
   */
  static fromEntropy(strength?: number) {
    return new Wallet(bip39.generateMnemonic(strength))
  }

  private recoveryPhrase: string

  /**
   * Initialize a new Wallet
   *
   * @param recoveryPhrase Mnemonic pass-phrase (aka wordlist, recovery phrase, etc)
   * @param check Whether to validate the input recovery phrase
   */
  constructor(recoveryPhrase: string, check: boolean = false) {
    if (check && !bip39.validateMnemonic(recoveryPhrase)) {
      throw new Error('Invalid recovery phrase')
    }
    this.recoveryPhrase = recoveryPhrase
  }

  /**
   * Derives accounts (address/seed pairs) from a Textile wallet
   *
   * Uses wallet seed to derive (hardened) BIP-32 hierarchical key for a path in BIP-44 format.
   *
   * @param index Account index. This is the (possibly multi-dimensional) index at which to
   * derive an account key. For highly hierarchical systems, an index of arbitrary dimension can
   * be used. For example, to derive the 3rd 2nd-level keypair, of the 1st account, index would
   * be [0, 3].
   * @param password mnemonic recovery phrase password (omit if none)
   * @returns The specified index and associated keypair
   */
  accountAt(index: number | number[], password?: string): Account {
    const seed = bip39.mnemonicToSeed(this.recoveryPhrase, password)
    const masterKey = createMasterKey(seed)
    const indices = Array.isArray(index) ? index : [index]
    const accountKey = masterKey.derivePath(`${bip44Path}/${indices.join("'/")}'`)
    const keypair = Keypair.fromRawEd25519Seed(accountKey.privateKey)
    return { index, keypair }
  }
}
