export function generateBankAccountNumber() {
  let accountNumber = "";

  // Generate 10 random digits
  for (let i = 0; i < 10; i++) {
    accountNumber += Math.floor(Math.random() * 10);
  }

  return accountNumber;
}
