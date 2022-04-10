# Space Token Initial Coin Offering and Liquidity Pool

## <ins>SpaceCoin (SPC) ICO</ins>
The goal of this ICO is to raise `30,000 ETH` by selling `150,000 SPC` token out of max supply of `500,000`. <br>
The ICO has following three phases.

1. **Seed Phase**: In this phase, only whitelisted seed investors can invest. An individual seed investor can invest 1500 ETH at max. The total seed investment limit is 15,000 ETH.

2. **General Phase**: ICO will become available to general public in this phase. An individual contribution limit is 1000 ETH. The total investment limit, including funds raised from previous phase, is 30,000 ETH.

3. **Open Phase**: In this phase, ICO is open to everyone and there is no individual limit. At this phase, ICO should release SPC tokens to all contributors at an `exchange rate of 1 ETH to 5 SPC`.

ICO has following features:
- ICO investors can claim their SPC tokens once ICO is in open phase
- The contract owner can pause and resume the fundraising at anytime
- The contract owner can move a phase forward at anytime, but not backwards
- The contract owner can enable/disable 2% tax on Space token transfer except for initial investment in the ICO. By default, this transfer tax is disabled, Transfer tax is deposited in the treasury account.
- The treasury can move funds to ETH-SPC liquidity pool

## <ins>SpaceCoin Liquidity Pool</ins>
This is Uniswap style constant product market maker pool & router to provide swapping for ETH & SPC pair.

SPC-ETH liquidity pool has following features:
- An user/contract can add (ETH,SPC) liquidity at anytime
- An user/contract can remove liquidity at anytime
- An user/contract can swap SPC for ETh or vice versa
<br>
SpaceRouter provides same functionality with built-in mechanism for price safety & slippage parameters. Users can also specify deadlines for their transactions. End users should use SpaceRouter contract.

## Implementation
This project uses following technologies & tools:
- `Solidity` for smart contract development
- `Openzeppelin` for standard solidity contracts
- `Hardhat` for local ethereum network & running tests
- `JavaScript, Ethers, Waffle/Chai` for unit testing
- `ESLint, Prettier & Solhint` for code styling
- `solidity-coverage` for code coverage
- `JavaScript/HTML/CSS & Parcel` for minimal frontend
  
## Contracts
There are 4 main contracts:
- `SpaceToken.sol` implements openzeppelin based ERC-20 token (symbol: `SPC`) implementation
- `SpaceTokenICO.sol` implements the initial coin offering features described above
- `EthSpcLiquidityPair.sol` implements core liquidity pool implementation with basic ERC-20 LP token
- `SpaceRouter.sol` implements slippage & other safety mechanisms for end users

# Getting Started
Contracts could be deployed on `ROPSTEN` or `RINKEBY` test networks or could be deployed on local hardhat instance.

# Running Backend Locally
1. Clone repo using `git`
2. Run `npm install` from project directory
3. Open terminal 1 & run to start hardhat instance : `npx hardhat node`
4. Open terminal 2 & run to deploy contracts to running hardhat instance: `npx hardhat run --network localhost scripts/deploy.js`

# Running Frontend Locally
1. Change directory to `frontend`
2. Run `npm install`
3. Open terminal 3 to run: `npx parcel src/index.html --no-cache`
4. Open `http://localhost:1234` in the browser

# Deploying Contracts On Rinkeby Test Network
1. Clone repo using `git`
2. Run `npm install` from project directory
3. Copy `env.example` as `.env` and update `RINKEBY_URL` & `PRIVATE_KEY` properties
4. Open terminal 1 & run: `npx hardhat run --network rinkeby scripts/deploy.js`
   
After deployment is successful, you can update contract addresses in `frontend/index.js` file from line 12-14.
Now, frontend can be run locally using instructions provided above and it will be connected to rinkeby test network.