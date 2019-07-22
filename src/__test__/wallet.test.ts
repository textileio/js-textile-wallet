import Wallet, { Account } from '../index'

const mnemonic = 'atom check bronze man connect iron swear degree excess dawn quantum sting'
const expected = [
  {
    index: 0,
    address: 'P6qX6kYu7ntDWYYsGb5beKPCnwZJkzkhPrj4bBrAES6nLAHU',
    seed: 'SVcwoEu2Dz8SWmvDYHqVM14Rwg1BFK8w6xdiqE9JdQukrPho'
  },
  {
    index: 1,
    address: 'P5KwuKG6bfCmLDVaJUigr1bjHw6GsgewDNp3G6onBv7Qi3dG',
    seed: 'SU7co5XLJ999uSN7GD5Wwpj3vjEYWa31EevvCpHVCvFBuyDB'
  },
  {
    index: 2,
    address: 'P85WLP28zDhaHBMCtTXmBX3zaW1FWbuNUt7VATxwDWCPXjVQ',
    seed: 'SVuwocyQuBkxMkxvV19gSA97EC4tWdnvbZVisXPVC6kKngYv'
  },
  {
    index: 3,
    address: 'P98C1XY1amKmNcVjdtZq2E85XfJR7BnTCPZL1fjyC1Gzernz',
    seed: 'SY2734iXMjRGbaFmFGkz7AeiA9LCHZPG16L4mQGCxZVVJuDv'
  }
]

describe('wallet accountAt', () => {
  it('should create a valid Textile wallet account', () => {
    const wallet = new Wallet(mnemonic, true)
    expected.forEach((correct, index) => {
      const { keypair } = wallet.accountAt(index)
      expect(keypair.publicKey()).toEqual(correct.address)
      expect(keypair.secret()).toEqual(correct.seed)
    })
  })
})
