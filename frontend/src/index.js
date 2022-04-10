import { ethers } from "ethers";
import SpaceTokenICOJSON from '../../artifacts/contracts/SpaceTokenICO.sol/SpaceTokenICO.json';
import SpaceTokenJSON from '../../artifacts/contracts/SpaceToken.sol/SpaceToken.json';
import EthSpcLiquidityPairJSON from '../../artifacts/contracts/EthSpcLiquidityPair.sol/EthSpcLiquidityPair.json';
import SpaceRouterJSON from '../../artifacts/contracts/SpaceRouter.sol/SpaceRouter.json';

// local hardhat instances
const spaceTokenICOAddr = '0x9A676e781A523b5d0C0e43731313A708CB607508';
const spaceTokenAddr = '0x8e80FFe6Dc044F4A766Afd6e5a8732Fe0977A493';
const ethSpcLiquidityPairAddr = '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1';
const spaceRouterAddr = '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE';

// Rinkeby contract instances
// const spaceTokenICOAddr = '0x3F3A19383825Fbd52B410d5F57dd461b8B041DCC';
// const spaceTokenAddr = '0xa16E02E87b7454126E5E10d957A927A7F5B5d2be';
// const ethSpcLiquidityPairAddr = '0x98F9cc0093aa5B08dCB4667061b70F57D64a78ea';
// const spaceRouterAddr = '0x9591D5D690326B3Cf4A1c708EFf2051144AbB5C4';

const provider = new ethers.providers.Web3Provider(window.ethereum)
const signer = provider.getSigner()
let account;

const spcTokenICOContract = new ethers.Contract(spaceTokenICOAddr, SpaceTokenICOJSON.abi, provider);
const spcTokenContract = new ethers.Contract(spaceTokenAddr, SpaceTokenJSON.abi, provider);
const pairContract = new ethers.Contract(ethSpcLiquidityPairAddr, EthSpcLiquidityPairJSON.abi, provider);
const routerContract = new ethers.Contract(spaceRouterAddr, SpaceRouterJSON.abi, provider);

window.ethers = ethers;
window.provider = provider;
window.spcTokenContract = spcTokenContract;
window.pairContract = pairContract;
window.routerContract = routerContract;

// UI elements
const errorLabel = document.getElementById('error');
const spcPriceLabel = document.getElementById('spcPriceLabel');

// Kick things off
start()

async function start() {
  await connectToMetamask()
}

async function connectToMetamask() {
  try {
    let chainId = await ethereum.request({ method: 'eth_chainId' });
    console.log("Connected to the chain: " + chainId);

    let accounts = await ethereum.request({ method: 'eth_accounts' });
    if (accounts.length === 0) {
        console.log("Requesting a metamask login...");
        accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    }
    account = accounts[0];
    console.log("Signed in with address: " + account);
  }
  catch(err) {
    console.log("Could not signed in" + err)
  }
}

moveLiqBtn.addEventListener('click', async e => {
  try {
    clearError();
    moveLiqBtn.disabled = true;
    console.log("Moving ICO funds to LP...");

    const ethAmt = ethers.utils.parseEther("10");
    const spcAmt = ethers.utils.parseEther("50");
    const spcBalanceBefore = await spcTokenContract.balanceOf(account);
    console.log("Account SPC balance: " + ethers.utils.formatEther(spcBalanceBefore));
    // call SPC token contract to add allowance for ICO contract to move SPC
    let approvalTx = await spcTokenContract.connect(provider.getSigner()).approve(spcTokenContract.address, spcAmt);
    approvalTx.wait();

    let tx = await spcTokenICOContract.connect(provider.getSigner())
      .moveFundsToLiquidityPool(routerContract.address, ethAmt, spcAmt);
    tx.wait();
    console.log("Moving funds to LP completed.");
  }
  catch(err) {
    displayError("Failed to move funds because of ", err);
    console.log("Failed to move funds", err);
  }
  moveLiqBtn.disabled = false;
});

//
// LP
//
let currentSpcToEthPrice = 5

provider.on("block", async n => {
  console.log("New block", n)
  
  const [ethReserve, spcReserve] = await pairContract.getReserves();
  console.log("ETH reserve: " + ethers.utils.formatEther(ethReserve) + ", SPC reserve: " + ethers.utils.formatEther(spcReserve));

  // Update currentSpcToEthPrice
  if (ethReserve.isZero() === 0 && spcReserve.isZero()) {
    displayError("No liquidity");
  }
  else {
    currentSpcToEthPrice = spcReserve / ethReserve;
    console.log("Current SPC per ETH price: " + currentSpcToEthPrice);
    spcPriceLabel.textContent = "Current SPC per ETH price: " + currentSpcToEthPrice;
  }

  // Update LP token balance
  const lpBalance = await pairContract.balanceOf(account);
  const formattedLPBal = ethers.utils.formatEther(lpBalance);
  lpBalanaceInput.value = formattedLPBal;
  console.log("LP token balance: " + formattedLPBal);

  await updateSwapOutLabel();
  updateMinAmtOut();
})

addLiqBtn.addEventListener('click', async e => {
  try {
    clearError();
    addLiqBtn.disabled = true;
    e.preventDefault();
    const eth = ethers.utils.parseEther(lp_deposit.eth.value)
    const spc = ethers.utils.parseEther(lp_deposit.spc.value)
    console.log("Depositing", eth.toString(), "eth and", spc.toString(), "spc")

    // call SPC token contract to add allowance for SPC
    let approvalTx = await spcTokenContract.connect(provider.getSigner()).approve(routerContract.address, spc);
    approvalTx.wait();

    // Call router contract addLiquidity function
    const minEthAmt = eth.sub(eth.div(100));  // 1% slippage
    const minSpcAmt = spc.sub(spc.div(100));
    console.log("Min ETH: " + ethers.utils.formatEther(minEthAmt) + ", Min SPC: " + ethers.utils.formatEther(minSpcAmt)); 
    let tx = await routerContract
      .connect(provider.getSigner())
      .addLiquidity(spc, minEthAmt, minSpcAmt, account, getDeadlineFromNow(5), {value: eth});
    tx.wait();
    console.log("Adding liquidity completed.");
  }
  catch(err) {
    displayError("Failed to add liquidity because of ", err);
    console.log("Failed to add liquidity", err);
  }
  addLiqBtn.disabled = false;
});

removeLiqBtn.addEventListener('click', async e => {
  try {
    clearError();
    removeLiqBtn.disabled = true;
    e.preventDefault();
    const lpToken = ethers.utils.parseEther(lp_withdraw.lpToken.value);
    console.log("Withdrawing LP token: " + lpToken);

    // call pair token contract to add allowance for LP tokens
    let approvalTx = await pairContract.connect(provider.getSigner()).approve(routerContract.address, lpToken);
    approvalTx.wait();

    // Call router contract remove liquidity function
    let tx = await routerContract
      .connect(provider.getSigner())
      .removeLiquidity(lpToken, ethers.utils.parseEther("0.4"), ethers.utils.parseEther("2"), account, getDeadlineFromNow(5));
    tx.wait();
    console.log("Removing liquidity completed.");
  }
  catch(err) {
    displayError("Failed to remove liquidity because of ", err);
    console.log("Failed to remove liquidity", err);
  }
  removeLiqBtn.disabled = false;
});

//
// Swap
//
let swapIn = { type: 'eth', value: 1 }
let swapOut = { type: 'spc', value: 1 }
switcher.addEventListener('click', () => {
  [swapIn, swapOut] = [swapOut, swapIn]
  swap_in_label.innerText = swapIn.type.toUpperCase()
  swap.amount_in.value = swapIn.value
  updateSwapOutLabel()
})

swap.amount_in.addEventListener('input', () => {
  updateSwapOutLabel();
  updateMinAmtOut();
});
slippageInput.addEventListener('input', updateMinAmtOut);

async function updateSwapOutLabel() {
  const [ethReserve, spcReserve] = await pairContract.getReserves();
  if (ethReserve.eq(ethers.utils.parseEther("0")) || swap.amount_in.value === '') return;

  console.log("updating swap out label");
  const amtIn = ethers.utils.parseEther(swap.amount_in.value);
  let amtOut;
  let expectedAmt;
  if (swapIn.type === 'eth') {
    amtOut = await pairContract.calculateAmountOut(amtIn, ethReserve, spcReserve);
    expectedAmt = swap.amount_in.value * currentSpcToEthPrice;
  }
  else {
    amtOut = await pairContract.calculateAmountOut(amtIn, spcReserve, ethReserve);
    expectedAmt = swap.amount_in.value / currentSpcToEthPrice;
  }

  swapOut.value = ethers.utils.formatEther(amtOut);
  swap_out_label.innerText = `Expected ${swapOut.value} ${swapOut.type.toUpperCase()}`;

  // update slippage
  // slippageInput.value = 100 * ((expectedAmt - swapOut.value)/expectedAmt);
}

function updateMinAmtOut() {
  let expectedAmt;
  if (swapIn.type === 'eth') {
    expectedAmt = swap.amount_in.value * currentSpcToEthPrice;
  }
  else {
    expectedAmt = swap.amount_in.value / currentSpcToEthPrice;
  }
  minAmtOutInput.value = expectedAmt - (expectedAmt * slippageInput.value)/100;
}

tradeBtn.addEventListener('click', async e => {
  try {
    clearError();
    tradeBtn.disabled = true;
    e.preventDefault();

    const amountIn = ethers.utils.parseEther(swap.amount_in.value);
    console.log("Swapping", amountIn, swapIn.type, "for", swapOut.type);

    let tx;
    if (swapIn.type === 'eth') {
      const minSpcAmtOut = ethers.utils.parseEther(minAmtOutInput.value);
      tx = await routerContract.connect(provider.getSigner())
        .swapInETH(account, minSpcAmtOut, getDeadlineFromNow(5), {value: amountIn});
    }
    else {
      // call SPC token contract to add allowance for SPC tokens
      let approvalTx = await spcTokenContract.connect(provider.getSigner()).approve(routerContract.address, amountIn);
      approvalTx.wait();

      // swap SPC in
      const minEthAmtOut = ethers.utils.parseEther(minAmtOutInput.value);
      tx = await routerContract.connect(provider.getSigner())
        .swapInSPC(account, amountIn, minEthAmtOut, getDeadlineFromNow(5));
    }

    tx.wait();
    console.log("Swap completed.");
  }
  catch(err) {
    displayError("Failed to swap because of ", err);
    console.log("Failed to swap", err);
  }
  tradeBtn.disabled = false;
});

function displayError(msg, err) {
  let errMsg = err.message;
  if (err.data && err.data.message) {
      errMsg = err.data.message;
  }
  errorLabel.textContent = msg + errMsg;
}

function clearError(msg) {
  errorLabel.textContent = "";
}

function getDeadlineFromNow(mins) {
  const deadlineDate = new Date();
  deadlineDate.setMinutes(deadlineDate.getMinutes() + mins);  // add specified minutes
  deadlineDate.setMilliseconds(0);    // roundout millis to avoid BigNumber underflow exception
  return deadlineDate.getTime()/1000; // convert to unix timestamp in seconds
}