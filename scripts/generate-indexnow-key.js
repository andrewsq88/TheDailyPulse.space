import { randomBytes } from 'node:crypto';

process.stdout.write(`${randomBytes(16).toString('hex')}\n`);
