// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const { ethers } = require("hardhat");
const parseEther = ethers.utils.parseEther;

let deployer;
let spaceTokenICO;
let spaceToken;
let ethSpcLiquidityPair;

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run("compile");

  [deployer] = await ethers.getSigners();

  // console.log("Deployer address: " + deployer.address);
  await deploySpaceICO();
  await deployEthSpcLiquidityPair();
  await deploySpaceRouter();

  await moveSpaceICOToOpenPhase();
}

async function deploySpaceICO() {
  // We get the contract to deploy
  const SpaceTokenICOFactory = await ethers.getContractFactory("SpaceTokenICO");
  spaceTokenICO = await SpaceTokenICOFactory.connect(deployer).deploy(
    deployer.address
  );

  await spaceTokenICO.deployed();
  spaceToken = await ethers.getContractAt("SpaceToken", await spaceTokenICO._spaceToken());

  // add deployer as see investor for testing
  await spaceTokenICO.addSeedInvestors([deployer.address]);

  console.log("SpaceTokenICO deployed to:", spaceTokenICO.address);
  console.log("SpaceToken deployed to:", spaceToken.address);
}

async function deployEthSpcLiquidityPair() {
  const EthSpcLiquidityPairFactory = await ethers.getContractFactory(
    "EthSpcLiquidityPair"
  );
  ethSpcLiquidityPair = await EthSpcLiquidityPairFactory.connect(deployer).deploy(
    spaceToken.address, 
  );
  await ethSpcLiquidityPair.deployed();
  
  console.log("EthSpcLiquidityPair deployed to:", ethSpcLiquidityPair.address);
}

async function deploySpaceRouter() {
  const SpaceRouterFactory = await ethers.getContractFactory(
    "SpaceRouter"
  );
  spaceRouter = await SpaceRouterFactory.connect(deployer).deploy(
    spaceToken.address, ethSpcLiquidityPair.address
  );
  await spaceRouter.deployed();
  console.log("SpaceRouter deployed to:", spaceRouter.address);
}

async function moveSpaceICOToOpenPhase() {
  // seed investment
  await spaceTokenICO.connect(deployer).invest({ value: parseEther("50") });

  // move to general phase
  await spaceTokenICO.connect(deployer).moveToPhase(1);

  // move to open phase
  await spaceTokenICO.connect(deployer).moveToPhase(2);

  console.log("Moved SpaceTokenICO to open phase");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
