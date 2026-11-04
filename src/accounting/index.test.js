'use strict';

// Unit and integration tests mirroring docs/TESTPLAN.md (TC-001 .. TC-035).

const {
  INITIAL_BALANCE_CENTS,
  MAX_BALANCE_CENTS,
  formatBalance,
  parseAmount,
  createDataStore,
  createOperations,
  runMenu,
} = require('./index');

const MENU_LINES = [
  '--------------------------------',
  'Account Management System',
  '1. View Balance',
  '2. Credit Account',
  '3. Debit Account',
  '4. Exit',
  '--------------------------------',
];
const MENU_PROMPT = 'Enter your choice (1-4): ';
const INVALID_CHOICE = 'Invalid choice, please select 1-4.';
const INSUFFICIENT_FUNDS = 'Insufficient funds for this debit.';
const GOODBYE = 'Exiting the program. Goodbye!';
const INVALID_AMOUNT = 'Invalid amount. Please enter a non-negative number (max 999999.99).';

// Scripted I/O: answers prompts from `inputs` (null once exhausted) and records output.
function createScriptedIO(inputs) {
  const queue = [...inputs];
  const output = [];
  const prompts = [];
  return {
    output,
    prompts,
    print: (message) => output.push(message),
    ask: async (prompt) => {
      prompts.push(prompt);
      output.push(prompt);
      return queue.length > 0 ? queue.shift() : null;
    },
  };
}

// Starts a new program run (fresh in-memory balance) and feeds it the inputs.
async function runSession(inputs, dataProgram = createDataStore()) {
  const io = createScriptedIO(inputs);
  const operations = createOperations(dataProgram, io);
  await runMenu(io, operations);
  return { output: io.output, dataProgram };
}

const messages = (output) => output.filter((line) => !MENU_LINES.includes(line) && line !== MENU_PROMPT);
const countMenus = (output) => output.filter((line) => line === MENU_PROMPT).length;

describe('Menu (MainProgram)', () => {
  test('TC-001: shows the main menu at startup', async () => {
    const { output } = await runSession(['4']);
    expect(output.slice(0, MENU_LINES.length + 1)).toEqual([...MENU_LINES, MENU_PROMPT]);
  });

  test('TC-018: exit displays goodbye and the menu does not appear again', async () => {
    const { output } = await runSession(['4', '1']);
    expect(countMenus(output)).toBe(1);
    expect(output[output.length - 1]).toBe(GOODBYE);
    expect(messages(output)).toEqual([GOODBYE]);
  });

  test('TC-019: rejects an out-of-range numeric choice, shows the menu again, then exits', async () => {
    const { output } = await runSession(['9', '4']);
    expect(messages(output)).toEqual([INVALID_CHOICE, GOODBYE]);
    expect(countMenus(output)).toBe(2);
  });

  test('TC-020: rejects menu choice zero', async () => {
    const { output } = await runSession(['0', '4']);
    expect(messages(output)).toEqual([INVALID_CHOICE, GOODBYE]);
    expect(countMenus(output)).toBe(2);
  });

  test.each([['a'], ['']])('TC-021: rejects a non-numeric or blank menu choice (%j)', async (choice) => {
    const { output } = await runSession([choice, '4']);
    expect(messages(output)).toEqual([INVALID_CHOICE, GOODBYE]);
  });

  test('TC-022: keeps the balance after an invalid menu choice', async () => {
    const { output } = await runSession(['9', '1', '4']);
    expect(messages(output)).toEqual([INVALID_CHOICE, 'Current balance: 001000.00', GOODBYE]);
  });

  // Legacy COBOL reads only the first digit (PIC 9). The Node.js port rejects it instead.
  test('TC-035: [Legacy quirk] multi-character menu input is treated as an invalid choice', async () => {
    const { output } = await runSession(['12', '4']);
    expect(messages(output)).toEqual([INVALID_CHOICE, GOODBYE]);
  });
});

describe('View balance (TOTAL)', () => {
  test('TC-002: displays the initial balance and shows the menu again', async () => {
    const { output } = await runSession(['1', '4']);
    expect(messages(output)).toEqual(['Current balance: 001000.00', GOODBYE]);
    expect(countMenus(output)).toBe(2);
  });

  test('TC-003: viewing twice does not change the balance', async () => {
    const { output, dataProgram } = await runSession(['1', '1', '4']);
    expect(messages(output)).toEqual(['Current balance: 001000.00', 'Current balance: 001000.00', GOODBYE]);
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });
});

describe('Credit (CREDIT)', () => {
  test('TC-004: credits a whole-number amount', async () => {
    const { output } = await runSession(['2', '100', '4']);
    expect(messages(output)).toContain('Amount credited. New balance: 001100.00');
  });

  test('TC-005: credits a decimal amount', async () => {
    const { output } = await runSession(['2', '250.50', '4']);
    expect(messages(output)).toContain('Amount credited. New balance: 001250.50');
  });

  test('TC-006: keeps a credited balance after viewing it', async () => {
    const { output } = await runSession(['2', '250.50', '1', '4']);
    expect(messages(output)).toEqual([
      'Enter credit amount: ',
      'Amount credited. New balance: 001250.50',
      'Current balance: 001250.50',
      GOODBYE,
    ]);
  });

  test('TC-007: credits zero without changing the balance', async () => {
    const { output, dataProgram } = await runSession(['2', '0', '4']);
    expect(messages(output)).toContain('Amount credited. New balance: 001000.00');
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });

  test('TC-008: truncates (does not round) extra decimal places', async () => {
    const { output } = await runSession(['2', '10.555', '4']);
    expect(messages(output)).toContain('Amount credited. New balance: 001010.55');
  });

  test('TC-032: reaches the maximum valid balance 999999.99', async () => {
    const { output, dataProgram } = await runSession(['2', '998999.99', '4']);
    expect(messages(output)).toContain('Amount credited. New balance: 999999.99');
    expect(dataProgram('READ')).toBe(MAX_BALANCE_CENTS);
  });

  // Legacy COBOL drops the sign and credits 100. The Node.js port rejects negative amounts.
  test('TC-029: [Legacy quirk] negative credit amount is rejected and the balance is unchanged', async () => {
    const { output, dataProgram } = await runSession(['2', '-100', '4']);
    expect(messages(output)).toContain(INVALID_AMOUNT);
    expect(messages(output).some((line) => line.startsWith('Amount credited'))).toBe(false);
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });

  // Legacy COBOL treats "abc" as zero. The Node.js port shows a validation error.
  test('TC-031: [Legacy quirk] non-numeric amount is rejected with a validation error', async () => {
    const { output, dataProgram } = await runSession(['2', 'abc', '4']);
    expect(messages(output)).toContain(INVALID_AMOUNT);
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });

  // Legacy COBOL silently wraps to 000000.00. The Node.js port rejects the credit.
  test('TC-033: [Legacy quirk] credit that would exceed 999999.99 is rejected', async () => {
    const { output, dataProgram } = await runSession(['2', '999000.00', '1', '4']);
    expect(messages(output)).toContain('Credit rejected: balance cannot exceed 999999.99.');
    expect(messages(output)).toContain('Current balance: 001000.00');
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });

  // Legacy COBOL truncates to 234567. The Node.js port rejects amounts over six integer digits.
  test('TC-034: [Legacy quirk] amount with more than six integer digits is rejected', async () => {
    const { output, dataProgram } = await runSession(['2', '1234567', '4']);
    expect(messages(output)).toContain(INVALID_AMOUNT);
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });
});

describe('Debit (DEBIT)', () => {
  test('TC-009: debits an amount less than the balance', async () => {
    const { output } = await runSession(['3', '50', '4']);
    expect(messages(output)).toContain('Amount debited. New balance: 000950.00');
  });

  test('TC-010: debits an amount equal to the balance', async () => {
    const { output } = await runSession(['3', '1000.00', '1', '4']);
    expect(messages(output)).toContain('Amount debited. New balance: 000000.00');
    expect(messages(output)).toContain('Current balance: 000000.00');
  });

  test('TC-011: rejects a debit of balance + 0.01', async () => {
    const { output } = await runSession(['3', '1000.01', '1', '4']);
    expect(messages(output)).toContain(INSUFFICIENT_FUNDS);
    expect(messages(output)).toContain('Current balance: 001000.00');
  });

  test('TC-012: rejects a much larger debit without changing the balance', async () => {
    const { output, dataProgram } = await runSession(['3', '5000', '4']);
    expect(messages(output)).toContain(INSUFFICIENT_FUNDS);
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });

  test('TC-013: rejects a debit from a zero balance (balance never negative)', async () => {
    const { output, dataProgram } = await runSession(['3', '1000', '3', '0.01', '1', '4']);
    expect(messages(output)).toContain(INSUFFICIENT_FUNDS);
    expect(messages(output)).toContain('Current balance: 000000.00');
    expect(dataProgram('READ')).toBe(0);
  });

  test('TC-014: debits zero without changing the balance', async () => {
    const { output } = await runSession(['3', '0', '4']);
    expect(messages(output)).toContain('Amount debited. New balance: 001000.00');
  });

  // Legacy COBOL drops the sign and debits 100. The Node.js port rejects negative amounts.
  test('TC-030: [Legacy quirk] negative debit amount is rejected and the balance is unchanged', async () => {
    const { output, dataProgram } = await runSession(['3', '-100', '4']);
    expect(messages(output)).toContain(INVALID_AMOUNT);
    expect(messages(output).some((line) => line.startsWith('Amount debited'))).toBe(false);
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });
});

describe('Integration: Operations and DataProgram', () => {
  test('TC-015: a debit after a credit uses the updated balance', async () => {
    const { output } = await runSession(['2', '100', '3', '50', '1', '4']);
    expect(messages(output)).toEqual([
      'Enter credit amount: ',
      'Amount credited. New balance: 001100.00',
      'Enter debit amount: ',
      'Amount debited. New balance: 001050.00',
      'Current balance: 001050.00',
      GOODBYE,
    ]);
  });

  test('TC-016: allows a debit only because of an earlier credit', async () => {
    const { output } = await runSession(['2', '500', '3', '1200', '4']);
    expect(messages(output)).toContain('Amount debited. New balance: 000300.00');
    expect(messages(output)).not.toContain(INSUFFICIENT_FUNDS);
  });

  test('TC-017: a rejected debit does not affect later operations', async () => {
    const { output } = await runSession(['3', '2000', '2', '100', '1', '4']);
    expect(messages(output)).toEqual([
      'Enter debit amount: ',
      INSUFFICIENT_FUNDS,
      'Enter credit amount: ',
      'Amount credited. New balance: 001100.00',
      'Current balance: 001100.00',
      GOODBYE,
    ]);
  });

  test('TC-023: keeps the balance during a session with multiple operations', async () => {
    const { output } = await runSession(['2', '200', '3', '300', '2', '50.25', '1', '4']);
    expect(messages(output)).toContain('Current balance: 000950.25');
  });

  test('TC-024: a new program run resets the balance to 1000.00', async () => {
    const first = await runSession(['2', '500', '4']);
    expect(first.dataProgram('READ')).toBe(150000);

    const second = await runSession(['1', '4']);
    expect(messages(second.output)).toContain('Current balance: 001000.00');
  });
});

describe('Data layer (DataProgram)', () => {
  test('TC-025: READ returns the stored balance (initially 1000.00)', () => {
    const dataProgram = createDataStore();
    expect(dataProgram('READ')).toBe(100000);
  });

  test('TC-026: WRITE updates the stored balance', () => {
    const dataProgram = createDataStore();
    dataProgram('WRITE', 150000);
    expect(dataProgram('READ')).toBe(150000);
  });

  test('TC-027: ignores an unknown operation', () => {
    const dataProgram = createDataStore();
    dataProgram('DELETE', 100);
    expect(dataProgram('READ')).toBe(100000);
  });
});

describe('Operations layer', () => {
  test('TC-028: ignores an unknown operation code (no output, no prompt, no balance change)', async () => {
    const dataProgram = createDataStore();
    const io = createScriptedIO(['100']);
    const operations = createOperations(dataProgram, io);

    await operations('REFUND');

    expect(io.output).toEqual([]);
    expect(io.prompts).toEqual([]);
    expect(dataProgram('READ')).toBe(INITIAL_BALANCE_CENTS);
  });
});

describe('Helpers', () => {
  test('formatBalance uses the zero-padded PIC 9(6)V99 format', () => {
    expect(formatBalance(100000)).toBe('001000.00');
    expect(formatBalance(0)).toBe('000000.00');
    expect(formatBalance(MAX_BALANCE_CENTS)).toBe('999999.99');
  });

  test('parseAmount converts input to integer cents and truncates extra decimals', () => {
    expect(parseAmount('100')).toBe(10000);
    expect(parseAmount('250.50')).toBe(25050);
    expect(parseAmount('10.555')).toBe(1055);
    expect(parseAmount(' 5. ')).toBe(500);
    expect(parseAmount('-1')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1234567')).toBeNull();
  });
});
