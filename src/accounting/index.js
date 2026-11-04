'use strict';

// Node.js port of the COBOL account management system (src/cobol):
//   main.cob       -> runMenu()          (menu loop)
//   operations.cob -> createOperations() (TOTAL / CREDIT / DEBIT)
//   data.cob       -> createDataStore()  (READ / WRITE balance storage)
//
// Amounts are kept as integer cents to avoid floating-point rounding errors.

const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100000; // 1000.00
const MAX_BALANCE_CENTS = 99999999; // 999999.99, the PIC 9(6)V99 limit

const MENU = [
  '--------------------------------',
  'Account Management System',
  '1. View Balance',
  '2. Credit Account',
  '3. Debit Account',
  '4. Exit',
  '--------------------------------',
];

// Mirrors the COBOL PIC 9(6)V99 display format, e.g. 1000.00 -> "001000.00".
function formatBalance(cents) {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${String(whole).padStart(6, '0')}.${String(fraction).padStart(2, '0')}`;
}

// Parses user input into non-negative integer cents. Extra decimal places are
// truncated (not rounded), matching COBOL MOVE semantics. Returns null when the
// input is not a valid non-negative amount within the PIC 9(6)V99 range.
function parseAmount(input) {
  const match = /^(\d{1,6})(?:\.(\d*))?$/.exec(String(input).trim());
  if (!match) {
    return null;
  }
  const fraction = (match[2] || '').padEnd(2, '0').slice(0, 2);
  return Number(match[1]) * 100 + Number(fraction);
}

// DataProgram: holds the balance in memory for the lifetime of the process.
function createDataStore(initialCents = INITIAL_BALANCE_CENTS) {
  let storageBalance = initialCents;

  return function dataProgram(operation, balanceCents) {
    if (operation === 'READ') {
      return storageBalance;
    }
    if (operation === 'WRITE') {
      storageBalance = balanceCents;
    }
    return storageBalance;
  };
}

// Operations: business rules for viewing, crediting and debiting the balance.
function createOperations(dataProgram, io) {
  async function readAmount(prompt) {
    const answer = await io.ask(prompt);
    if (answer === null) {
      return null;
    }
    const amount = parseAmount(answer);
    if (amount === null) {
      io.print('Invalid amount. Please enter a non-negative number (max 999999.99).');
    }
    return amount;
  }

  return async function operations(operationType) {
    if (operationType === 'TOTAL') {
      const finalBalance = dataProgram('READ');
      io.print(`Current balance: ${formatBalance(finalBalance)}`);
    } else if (operationType === 'CREDIT') {
      const amount = await readAmount('Enter credit amount: ');
      if (amount === null) {
        return;
      }
      const finalBalance = dataProgram('READ') + amount;
      if (finalBalance > MAX_BALANCE_CENTS) {
        io.print('Credit rejected: balance cannot exceed 999999.99.');
        return;
      }
      dataProgram('WRITE', finalBalance);
      io.print(`Amount credited. New balance: ${formatBalance(finalBalance)}`);
    } else if (operationType === 'DEBIT') {
      const amount = await readAmount('Enter debit amount: ');
      if (amount === null) {
        return;
      }
      const currentBalance = dataProgram('READ');
      if (currentBalance >= amount) {
        const finalBalance = currentBalance - amount;
        dataProgram('WRITE', finalBalance);
        io.print(`Amount debited. New balance: ${formatBalance(finalBalance)}`);
      } else {
        io.print('Insufficient funds for this debit.');
      }
    }
  };
}

// MainProgram: menu loop until the user chooses Exit (or input ends).
async function runMenu(io, operations) {
  let continueFlag = true;

  while (continueFlag) {
    MENU.forEach((line) => io.print(line));
    const choice = await io.ask('Enter your choice (1-4): ');

    if (choice === null) {
      break;
    }

    switch (choice.trim()) {
      case '1':
        await operations('TOTAL');
        break;
      case '2':
        await operations('CREDIT');
        break;
      case '3':
        await operations('DEBIT');
        break;
      case '4':
        continueFlag = false;
        break;
      default:
        io.print('Invalid choice, please select 1-4.');
    }
  }

  io.print('Exiting the program. Goodbye!');
}

// Console I/O that works for both interactive terminals and piped input.
function createConsoleIO(input = process.stdin, output = process.stdout) {
  const rl = readline.createInterface({ input, terminal: false });
  const lines = rl[Symbol.asyncIterator]();

  return {
    print: (message) => output.write(`${message}\n`),
    ask: async (prompt) => {
      output.write(prompt);
      const { value, done } = await lines.next();
      return done ? null : value;
    },
    close: () => rl.close(),
  };
}

async function main() {
  const io = createConsoleIO();
  const dataProgram = createDataStore();
  const operations = createOperations(dataProgram, io);
  try {
    await runMenu(io, operations);
  } finally {
    io.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  INITIAL_BALANCE_CENTS,
  MAX_BALANCE_CENTS,
  formatBalance,
  parseAmount,
  createDataStore,
  createOperations,
  runMenu,
  createConsoleIO,
};
