import { Mina, PublicKey, UInt64, fetchAccount } from 'snarkyjs';

export { loopUntilAccountExists };
export { getFriendlyDateTime };
// export { callFaucet };

async function loopUntilAccountExists({
  account,
  eachTimeNotExist,
  isZkAppAccount,
}: {
  account: PublicKey;
  eachTimeNotExist: () => void;
  isZkAppAccount: boolean;
}) {
  for (;;) {
    let response = await fetchAccount({ publicKey: account });
    let accountExists = response.account !== undefined;
    if (isZkAppAccount) {
      accountExists = response.account?.zkapp?.appState !== undefined;
    }
    if (!accountExists) {
      eachTimeNotExist();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      // TODO add optional check that verification key is correct once this is available in SnarkyJS
      return response.account!;
    }
  }
}

// function to print the time
function getFriendlyDateTime() {
  let timestamp = Date.now();
  const date = new Date(timestamp);
  const day = date.toLocaleString('en-US', { weekday: 'long' });
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
  return `${day}, ${month} ${date.getDate()}, ${year} at ${time}`;
}

// async function callFaucet(deployerAccount: PublicKey) {
//   // await fetchAccount({ publicKey: deployerAccount });
//   // await Mina.faucet(deployerAccount);

//   // let currentBalance = Mina.getBalance(deployerAccount);
//   // console.log('current balance', currentBalance.toString());

//   await Mina.faucet(deployerAccount);
// }

const deployTransactionFee = 100_000_000;
