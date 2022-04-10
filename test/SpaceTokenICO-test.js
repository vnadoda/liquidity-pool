const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseEther = ethers.utils.parseEther;

describe("SpaceTokenICO", function () {
  let deployer;
  let treasury;
  let seedInvestor1;
  let seedInvestor2;
  let seedInvestor3;
  let generalInvestor1;
  let generalInvestor2;
  let accounts;

  let spaceTokenICO;
  let spaceToken;

  beforeEach(async function () {
    [
      deployer,
      treasury,
      seedInvestor1,
      seedInvestor2,
      seedInvestor3,
      generalInvestor1,
      generalInvestor2,
      ...accounts
    ] = await ethers.getSigners();

    const SpaceTokenICOFactory = await ethers.getContractFactory(
      "SpaceTokenICO"
    );
    spaceTokenICO = await SpaceTokenICOFactory.connect(deployer).deploy(
      treasury.address
    );
    await spaceTokenICO.deployed();
    spaceToken = await ethers.getContractAt("SpaceToken", await spaceTokenICO._spaceToken());

    // add a seed investor
    await spaceTokenICO.addSeedInvestors([seedInvestor1.address]);
  });

  describe("deployment", async function () {
    it("should be deployed", async function () {
      expect(
        await spaceTokenICO.isSeedInvestor(seedInvestor1.address)
      ).to.equal(true);
    });
  });

  describe("seed phase", async function () {
    it("should be able to add seed investor by only owner", async function () {
      await spaceTokenICO
        .connect(deployer)
        .addSeedInvestors([seedInvestor2.address]);
      expect(
        await spaceTokenICO.isSeedInvestor(seedInvestor2.address)
      ).to.equal(true);
    });

    it("should NOT be able to add seed investor by non-owner", async function () {
      await expect(
        spaceTokenICO
          .connect(seedInvestor1)
          .addSeedInvestors([seedInvestor3.address])
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("non-seed-investor should NOT be able to invest during seed phase", async function () {
      await expect(
        spaceTokenICO.connect(generalInvestor1).invest({ value: 101 })
      ).to.be.revertedWith("Not Seed Investor");
    });

    it("should NOT be able to make > 1500 seed investment", async function () {
      await expect(
        spaceTokenICO
          .connect(seedInvestor1)
          .invest({ value: parseEther("1501") })
      ).to.be.revertedWith("Above seed investment limit");
    });

    it("should NOT be able to claim SPC tokens", async function () {
      await expect(
        spaceTokenICO.connect(generalInvestor1).claimSPCTokens()
      ).to.be.revertedWith("Not open phase");
    });

    it("should be able to make < 1500 seed investment", async function () {
      await spaceTokenICO
        .connect(seedInvestor1)
        .invest({ value: parseEther("1499") });

      await verifyInvestment(seedInvestor1, "1499");
    });

    it("should be able to make 1500 seed investment", async function () {
      await spaceTokenICO
        .connect(seedInvestor1)
        .invest({ value: parseEther("1500") });

      await verifyInvestment(seedInvestor1, "1500");
    });

    it("should accept multiple seed investments from various seed investors", async function () {
      await spaceTokenICO
        .connect(seedInvestor1)
        .invest({ value: parseEther("100") });

      await spaceTokenICO
        .connect(seedInvestor1)
        .invest({ value: parseEther("100") });

      await spaceTokenICO.addSeedInvestors([seedInvestor2.address]);
      await spaceTokenICO
        .connect(seedInvestor2)
        .invest({ value: parseEther("300") });

      await verifyInvestment(seedInvestor1, "200");
      await verifyInvestment(seedInvestor2, "300");

      const totalSeedInv = await spaceTokenICO.totalInvestment();
      expect(totalSeedInv.eq(parseEther("500"))).to.equal(true);
    });
  });

  describe("moveToPhase", async function () {
    it("should NOT be able to move phase forward by non-owner", async function () {
      await expect(
        spaceTokenICO.connect(seedInvestor1).moveToPhase(1)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should be able to move phase forward by owner", async function () {
      await spaceTokenICO.connect(deployer).moveToPhase(1);
      expect(await spaceTokenICO.currentPhase()).to.equal(1);

      await spaceTokenICO.connect(deployer).moveToPhase(2);
      expect(await spaceTokenICO.currentPhase()).to.equal(2);
    });

    it("should NOT be able to move phase forward after max", async function () {
      await spaceTokenICO.connect(deployer).moveToPhase(1);
      await spaceTokenICO.connect(deployer).moveToPhase(2);
      await expect(
        spaceTokenICO.connect(deployer).moveToPhase(2)
      ).to.be.revertedWith("New phase is not valid");
    });

    it("should NOT be able to move phase backward", async function () {
      await spaceTokenICO.connect(deployer).moveToPhase(1);
      await expect(
        spaceTokenICO.connect(deployer).moveToPhase(0)
      ).to.be.revertedWith("New phase is not valid");
    });
  });

  describe("invest - general phase", async function () {
    beforeEach(async function () {
      // move to general phase
      await spaceTokenICO.connect(deployer).moveToPhase(1);
    });

    it("should be in general phase", async function () {
      expect(await spaceTokenICO.currentPhase()).to.equal(1);
    });

    it("should NOT be able to make > 1000 general investment", async function () {
      // console.log("current phase " + (await spaceTokenICO.currentPhase()));
      await expect(
        spaceTokenICO
          .connect(generalInvestor1)
          .invest({ value: parseEther("1001") })
      ).to.be.revertedWith("Above general investment limit");
    });

    it("should NOT be able to claim SPC tokens", async function () {
      await expect(
        spaceTokenICO.connect(generalInvestor1).claimSPCTokens()
      ).to.be.revertedWith("Not open phase");
    });

    it("should be able to make <= 1000 general investment", async function () {
      await spaceTokenICO
        .connect(generalInvestor1)
        .invest({ value: parseEther("1000") });

      await verifyInvestment(generalInvestor1, "1000");

      await spaceTokenICO
        .connect(generalInvestor2)
        .invest({ value: parseEther("999") });

      await verifyInvestment(generalInvestor2, "999");
    });
  });

  describe("invest - open phase", async function () {
    beforeEach(async function () {
      // move to open phase
      await spaceTokenICO.connect(deployer).moveToPhase(1);
      await spaceTokenICO.connect(deployer).moveToPhase(2);
    });

    it("should be in open phase", async function () {
      expect(await spaceTokenICO.currentPhase()).to.equal(2);
    });

    it("should be able to make investment without individual limit", async function () {
      await spaceTokenICO
        .connect(generalInvestor1)
        .invest({ value: parseEther("551") });

      await verifyInvestment(generalInvestor1, "551");

      await spaceTokenICO
        .connect(generalInvestor2)
        .invest({ value: parseEther("2551") });

      await verifyInvestment(generalInvestor2, "2551");
    });

    it("should NOT be able to make a open investment crossing total max", async function () {
      // Invest 24K ETH
      for (let index = 0; index < 3; index++) {
        await spaceTokenICO
          .connect(accounts[index])
          .invest({ value: parseEther("8000") });
      }

      // Invest 6K eth
      await spaceTokenICO
        .connect(generalInvestor2)
        .invest({ value: parseEther("6000") });

      // This investment should be reverted
      await expect(
        spaceTokenICO
          .connect(generalInvestor1)
          .invest({ value: parseEther("1") })
      ).to.be.revertedWith("Above max total investment limit");
    });
  });

  describe("claimSPCTokens - open phase", async function () {
    beforeEach(async function () {
      // move to open phase
      await spaceTokenICO.connect(deployer).moveToPhase(1);
      await spaceTokenICO.connect(deployer).moveToPhase(2);
    });

    it("should NOT be able to claim SPC tokens without balance", async function () {
      await expect(
        spaceTokenICO.connect(generalInvestor1).claimSPCTokens()
      ).to.be.revertedWith("No balance");
    });

    it("should be able to claim SPC tokens", async function () {
      await spaceTokenICO
        .connect(generalInvestor1)
        .invest({ value: parseEther("0.01") });

      const tx = await spaceTokenICO.connect(generalInvestor1).claimSPCTokens();

      const expectedWeiSPC = parseEther("0.05");
      expect(await spaceToken.balanceOf(generalInvestor1.address)).to.equal(expectedWeiSPC);

      expect(await spaceTokenICO.investments(generalInvestor1.address)).to.equal(0);
    });

    it("should NOT be able to re-claim SPC tokens", async function () {
      await spaceTokenICO
        .connect(generalInvestor1)
        .invest({ value: parseEther("1") });

      const tx = await spaceTokenICO.connect(generalInvestor1).claimSPCTokens();

      const expectedWeiSPC = parseEther("5");
      expect(await spaceToken.balanceOf(generalInvestor1.address)).to.equal(expectedWeiSPC);

      await expect(
        spaceTokenICO.connect(generalInvestor1).claimSPCTokens()
      ).to.be.revertedWith("No balance");
    });
  });

  describe("complete scenario: seed -> general -> open", async function () {
    beforeEach(async function() {
      // Deploy EthSpcLiquidityPair
      const EthSpcLiquidityPairFactory = await ethers.getContractFactory(
        "EthSpcLiquidityPair"
      );
      ethSpcLiquidityPair = await EthSpcLiquidityPairFactory.connect(deployer).deploy(
        spaceToken.address, 
      );
      await ethSpcLiquidityPair.deployed();

    // Deploy Space router
    const SpaceRouterFactory = await ethers.getContractFactory(
        "SpaceRouter"
      );
      spaceRouter = await SpaceRouterFactory.connect(deployer).deploy(
        spaceToken.address, ethSpcLiquidityPair.address
      );
      await spaceRouter.deployed();
    });

    it("should be able to claim SPC tokens by multiple kind of investors", async function () {
      // seed investment
      await spaceTokenICO
        .connect(seedInvestor1)
        .invest({ value: parseEther("50") });

      // move to general phase
      await spaceTokenICO.connect(deployer).moveToPhase(1);

      // general investment
      await spaceTokenICO
        .connect(generalInvestor1)
        .invest({ value: parseEther("20") });

      // move to open phase
      await spaceTokenICO.connect(deployer).moveToPhase(2);

      // open investment
      const openInvestor1 = accounts[0];
      await spaceTokenICO
        .connect(openInvestor1)
        .invest({ value: parseEther("10") });

      await spaceTokenICO.connect(generalInvestor1).claimSPCTokens();
      expect(await spaceToken.balanceOf(generalInvestor1.address)).to.equal(parseEther("100"));

      await spaceTokenICO.connect(openInvestor1).claimSPCTokens();
      expect(await spaceToken.balanceOf(openInvestor1.address)).to.equal(
        parseEther("50")
      );

      await spaceTokenICO.connect(seedInvestor1).claimSPCTokens();
      expect(await spaceToken.balanceOf(seedInvestor1.address)).to.equal(
        parseEther("250")
      );

      expect(await spaceTokenICO.investments(generalInvestor1.address)).to.equal(0);
      expect(await spaceTokenICO.investments(seedInvestor1.address)).to.equal(0);
      expect(await spaceTokenICO.investments(openInvestor1.address)).to.equal(0);

      // treasury should be able to move funds to LP
      const ethAmt = parseEther("80");
      const spcAmt = parseEther("400");
      const spcBalanceBefore = await spaceToken.balanceOf(spaceTokenICO.address);

      // Only treasury should be able to call moveFunds
      await spaceTokenICO.connect(treasury).moveFundsToLiquidityPool(spaceRouter.address, ethAmt, spcAmt);
      
      const spcBalanceAfter = await spaceToken.balanceOf(spaceTokenICO.address);
      expect(spcBalanceBefore.sub(spcBalanceAfter)).to.equal(spcAmt);
      expect(await ethers.provider.getBalance(spaceTokenICO.address)).to.equal(parseEther("0"));
      // LP token balance of treasury should be: (sqr root of 32000 (80 * 400)) - 1000
      expect(await ethSpcLiquidityPair.balanceOf(treasury.address)).to.eq(parseEther("178.885438199983174712"));
    });
  });

  describe("Pause - unpause", async function () {
    it("pause flag should be off by default", async function () {
      expect(await spaceTokenICO.isPaused()).to.equal(false);
    });

    it("should NOT be updatable by non-owner", async function () {
      await expect(
        spaceTokenICO.connect(seedInvestor1).updatePauseFlag(false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should be updatable by owner", async function () {
      await spaceTokenICO.connect(deployer).updatePauseFlag(true);
      expect(await spaceTokenICO.isPaused()).to.equal(true);

      await spaceTokenICO.connect(deployer).updatePauseFlag(false);
      expect(await spaceTokenICO.isPaused()).to.equal(false);
    });

    it("should NOT be able to invest when fundraising is paused", async function () {
      // Pause the fundraise
      spaceTokenICO.connect(deployer).updatePauseFlag(true);

      await expect(
        spaceTokenICO.connect(seedInvestor1).invest()
      ).to.be.revertedWith("Fundraise paused");

      // move to general phase
      await spaceTokenICO.connect(deployer).moveToPhase(1);

      await expect(
        spaceTokenICO.connect(generalInvestor1).invest()
      ).to.be.revertedWith("Fundraise paused");

      // move to open
      await spaceTokenICO.connect(deployer).moveToPhase(2);

      await expect(
        spaceTokenICO.connect(seedInvestor1).invest()
      ).to.be.revertedWith("Fundraise paused");
    });

    it("should be able to seed invest when fundraising is unpaused", async function () {
      // Pause the fundraise
      spaceTokenICO.connect(deployer).updatePauseFlag(true);

      await expect(
        spaceTokenICO.connect(seedInvestor1).invest()
      ).to.be.revertedWith("Fundraise paused");

      // Unpause the fundraise
      spaceTokenICO.connect(deployer).updatePauseFlag(false);

      // verify the seed investment
      await spaceTokenICO
        .connect(seedInvestor1)
        .invest({ value: parseEther("1") });
      await verifyInvestment(seedInvestor1, "1");
    });

    it("should be able to general invest when fundraising is unpaused", async function () {
      // move to general phase
      await spaceTokenICO.connect(deployer).moveToPhase(1);

      // Pause the fundraise
      spaceTokenICO.connect(deployer).updatePauseFlag(true);

      await expect(
        spaceTokenICO.connect(generalInvestor1).invest()
      ).to.be.revertedWith("Fundraise paused");

      // Unpause the fundraise
      spaceTokenICO.connect(deployer).updatePauseFlag(false);

      // verify the general investment
      await spaceTokenICO
        .connect(generalInvestor1)
        .invest({ value: parseEther("1") });
      await verifyInvestment(generalInvestor1, "1");
    });

    it("should be able to open invest when fundraising is unpaused", async function () {
      // move to open phase
      await spaceTokenICO.connect(deployer).moveToPhase(1);
      await spaceTokenICO.connect(deployer).moveToPhase(2);

      // Pause the fundraise
      spaceTokenICO.connect(deployer).updatePauseFlag(true);

      const openInvestor1 = accounts[0];
      await expect(
        spaceTokenICO.connect(openInvestor1).invest()
      ).to.be.revertedWith("Fundraise paused");

      // Unpause the fundraise
      spaceTokenICO.connect(deployer).updatePauseFlag(false);

      // verify the open investment
      await spaceTokenICO
        .connect(openInvestor1)
        .invest({ value: parseEther("1") });
      await verifyInvestment(openInvestor1, "1");
    });
  });

  async function verifyInvestment(investor, expectedInv) {
    const inv = await spaceTokenICO.investments(investor.address);
    // console.log("Inv: " + inv);
    expect(inv.eq(parseEther(expectedInv))).to.equal(true);
  }
});
