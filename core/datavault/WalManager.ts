import { appendFileSync } from 'fs';
import { createHash } from 'crypto';

export type LogEntry = {
  capabilityId: string;
  args: any;
  timestamp: number;
  hash?: string;
  previousHash?: string;
};

let previousHash = "GENESIS_BLOCK";

export const WalManager = {
  append: async (entry: LogEntry) => {
    const payload = JSON.stringify({ ...entry, previousHash });
    const currentHash = createHash('sha256').update(payload).digest('hex');
    
    const finalEntry = { ...entry, previousHash, hash: currentHash };
    
    // Write to Append-Only Log
    try {
      appendFileSync('C:/Users/Randy Webb/Desktop/Os_lucy/OS_Lucy\'s/lucyverse_datavault.wal', JSON.stringify(finalEntry) + '\n');
    } catch(e) {
      console.error("WAL Write Failed", e);
    }
    
    previousHash = currentHash;
    return currentHash;
  }
};
