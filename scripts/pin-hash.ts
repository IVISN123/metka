import { hashPin, randomSalt } from '../src/lib/pin.ts'

const args = process.argv.slice(2)
if (args.length !== 1 || !/^\d{4}$/.test(args[0] ?? '')) {
  console.error('Usage: npm run pin-hash -- 1234')
  console.error('Prints a salt and a SHA-256 hash for the GitHub Actions secrets. Does not write a file.')
  process.exit(1)
}

const pin = args[0] ?? ''
const salt = randomSalt()
const hash = await hashPin(pin, salt)

console.log('Put these in GitHub → Settings → Secrets and variables → Actions.')
console.log('Do not commit them. The PIN is not printed.')
console.log('')
console.log(`VITE_METKA_PIN_SALT=${salt}`)
console.log(`VITE_METKA_PIN_HASH=${hash}`)
