# Test Plan: COBOL Student Account Management

This test plan covers the business logic in [`src/cobol`](../src/cobol) (`MainProgram`, `Operations` and `DataProgram`). Business stakeholders can use it to validate current behavior. It also serves as the baseline for unit and integration tests in the Node.js migration.

## Conventions

- **Initial state:** Each test case starts a new program run with the balance initialized to `1000.00`, unless otherwise stated.
- **Balance display format:** Balances appear as zero-padded `PIC 9(6)V99` values, for example, `001000.00`.
- **Actual Result** and **Status** are left blank. Fill them in during test execution.
- Test cases marked **[Legacy quirk]** describe behavior observed in the current COBOL app (GnuCOBOL) that may not be intended. Stakeholders should confirm whether the Node.js app must keep this behavior or replace it with validation.

## Test Cases

| Test Case ID | Test Case Description | Pre-conditions | Test Steps | Expected Result | Actual Result | Status (Pass/Fail) | Comments |
|---|---|---|---|---|---|---|---|
| TC-001 | Show the main menu at startup | Application started | 1. Start the application | The menu shows the separator line, "Account Management System", "1. View Balance", "2. Credit Account", "3. Debit Account", "4. Exit", the separator line and "Enter your choice (1-4): " | | | `main.cob` menu loop |
| TC-002 | View the initial balance | New run (balance 1000.00) | 1. Enter `1` | The app displays "Current balance: 001000.00" and shows the menu again | | | Initial balance rule: 1,000.00 |
| TC-003 | View the balance more than once without changing it | New run | 1. Enter `1`<br>2. Enter `1` | Both views display "Current balance: 001000.00". Viewing does not change the balance | | | Read-only operation |
| TC-004 | Credit a valid whole-number amount | New run | 1. Enter `2`<br>2. Enter `100` | The app displays "Amount credited. New balance: 001100.00" | | | |
| TC-005 | Credit a valid decimal amount | New run | 1. Enter `2`<br>2. Enter `250.50` | The app displays "Amount credited. New balance: 001250.50" | | | Two decimal places are supported |
| TC-006 | Keep a credited balance after viewing it | New run | 1. Enter `2`, then `250.50`<br>2. Enter `1` | The view displays "Current balance: 001250.50" | | | Verifies the write to `DataProgram` storage |
| TC-007 | Credit zero | New run | 1. Enter `2`<br>2. Enter `0` | The app displays "Amount credited. New balance: 001000.00". The balance does not change | | | No validation rejects zero |
| TC-008 | Credit an amount with more than two decimal places | New run | 1. Enter `2`<br>2. Enter `10.555` | The app displays "Amount credited. New balance: 001010.55" | | | Extra decimal places are truncated, not rounded |
| TC-009 | Debit a valid amount less than the balance | New run | 1. Enter `3`<br>2. Enter `50` | The app displays "Amount debited. New balance: 000950.00" | | | |
| TC-010 | Debit an amount equal to the balance | New run | 1. Enter `3`<br>2. Enter `1000.00`<br>3. Enter `1` | The app displays "Amount debited. New balance: 000000.00". The view displays "Current balance: 000000.00" | | | Boundary: `balance >= amount` allows the debit |
| TC-011 | Reject a debit greater than the balance | New run | 1. Enter `3`<br>2. Enter `1000.01`<br>3. Enter `1` | The app displays "Insufficient funds for this debit.". The view displays "Current balance: 001000.00" | | | Boundary: balance + 0.01 |
| TC-012 | Reject a much larger debit | New run | 1. Enter `3`<br>2. Enter `5000` | The app displays "Insufficient funds for this debit.". The balance does not change | | | |
| TC-013 | Reject a debit from a zero balance | Balance is 0.00 after debiting `1000` | 1. Enter `3`<br>2. Enter `0.01`<br>3. Enter `1` | The app displays "Insufficient funds for this debit.". The view displays "Current balance: 000000.00" | | | The balance can never be negative |
| TC-014 | Debit zero | New run | 1. Enter `3`<br>2. Enter `0` | The app displays "Amount debited. New balance: 001000.00" | | | No validation rejects zero |
| TC-015 | Debit after a credit uses the updated balance | New run | 1. Enter `2`, then `100`<br>2. Enter `3`, then `50`<br>3. Enter `1` | Credit message: "001100.00". Debit message: "001050.00". View: "Current balance: 001050.00" | | | Integration: Operations and DataProgram |
| TC-016 | Allow a debit only because of an earlier credit | New run | 1. Enter `2`, then `500`<br>2. Enter `3`, then `1200` | The app debits the amount and displays "Amount debited. New balance: 000300.00" | | | The sufficient-funds check reads the latest stored balance |
| TC-017 | Rejected debit does not affect later operations | New run | 1. Enter `3`, then `2000` (rejected)<br>2. Enter `2`, then `100`<br>3. Enter `1` | The app rejects the debit. The credit message shows "001100.00". The view shows "001100.00" | | | |
| TC-018 | Exit the application | Application running | 1. Enter `4` | The app displays "Exiting the program. Goodbye!" and ends. The menu does not appear again | | | |
| TC-019 | Reject an out-of-range numeric menu choice | Application running | 1. Enter `9`<br>2. Enter `4` | The app displays "Invalid choice, please select 1-4." and shows the menu again. Exit then works | | | `WHEN OTHER` branch |
| TC-020 | Reject menu choice zero | Application running | 1. Enter `0`<br>2. Enter `4` | The app displays "Invalid choice, please select 1-4." and shows the menu again | | | |
| TC-021 | Reject a non-numeric menu choice | Application running | 1. Enter `a`<br>2. Enter `4` | The app displays "Invalid choice, please select 1-4." | | | Blank input behaves the same way |
| TC-022 | Keep the balance after an invalid menu choice | New run | 1. Enter `9`<br>2. Enter `1` | The view displays "Current balance: 001000.00" | | | |
| TC-023 | Keep the balance during a session with multiple operations | New run | 1. Credit `200`<br>2. Debit `300`<br>3. Credit `50.25`<br>4. View | The view displays "Current balance: 000950.25" | | | End-to-end flow |
| TC-024 | Reset the balance in a new program run | The previous run changed the balance and then exited | 1. Start the application again<br>2. Enter `1` | The view displays "Current balance: 001000.00" | | | There is no persistence across runs (in-memory storage only) |
| TC-025 | DataProgram READ returns the stored balance | Unit test of the data layer | 1. Call the data layer with `READ` | The data layer returns the current stored balance (initially 1000.00) | | | Unit test target for the Node.js data module |
| TC-026 | DataProgram WRITE updates the stored balance | Unit test of the data layer | 1. Call the data layer with `WRITE` and 1500.00<br>2. Call it with `READ` | `READ` returns 1500.00 | | | |
| TC-027 | DataProgram ignores an unknown operation | Unit test of the data layer | 1. Call the data layer with an unknown operation code and 1.00<br>2. Call it with `READ` | Storage does not change. `READ` returns the previous balance | | | Only `READ` and `WRITE` are handled |
| TC-028 | Operations ignores an unknown operation code | Unit test of the operations layer | 1. Call Operations with an unsupported code | The operations layer does nothing: no output and no balance change | | | Only `TOTAL `, `CREDIT` and `DEBIT ` are handled |
| TC-029 | [Legacy quirk] Treat a negative credit amount as positive | New run | 1. Enter `2`<br>2. Enter `-100` | The current app displays "Amount credited. New balance: 001100.00" because the sign is dropped | | | Unsigned `PIC 9` field. **Stakeholder decision:** reject negative amounts in Node.js? |
| TC-030 | [Legacy quirk] Treat a negative debit amount as positive | New run | 1. Enter `3`<br>2. Enter `-100` | The current app displays "Amount debited. New balance: 000900.00" | | | **Stakeholder decision:** reject negative amounts? |
| TC-031 | [Legacy quirk] Treat a non-numeric amount as zero | New run | 1. Enter `2`<br>2. Enter `abc` | The current app displays "Amount credited. New balance: 001000.00" | | | **Stakeholder decision:** show a validation error instead? |
| TC-032 | Reach the maximum valid balance | New run | 1. Enter `2`<br>2. Enter `998999.99` | Business expectation: the balance becomes 999999.99, the maximum value for `PIC 9(6)V99` | | | The current app truncates 9-character input and gives `999999.90`. **Confirm intended behavior** |
| TC-033 | [Legacy quirk] Balance overflow beyond 999,999.99 | New run | 1. Enter `2`<br>2. Enter `999000.00` | The current app silently truncates the high-order digits and displays "Amount credited. New balance: 000000.00" | | | Loses data. **Stakeholder decision:** reject credits that exceed the maximum balance? |
| TC-034 | [Legacy quirk] Amount with more than six integer digits | New run | 1. Enter `2`<br>2. Enter `1234567` | The current app truncates the amount to `234567` and displays "Amount credited. New balance: 235567.00" | | | **Stakeholder decision:** enforce a maximum transaction amount? |
| TC-035 | [Legacy quirk] Multi-character menu input uses only the first digit | Application running | 1. Enter `12` | The current app treats the input as `1` (View Balance) and displays "Current balance: 001000.00" | | | `USER-CHOICE` is `PIC 9`. **Stakeholder decision:** treat it as an invalid choice? |
