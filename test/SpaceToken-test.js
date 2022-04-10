const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseEther = ethers.utils.parseEther;

describe("SpaceToken", function () {
  let deployer;
  let treasury;
  let accounts;
  let spaceTokenIco, spaceToken;

  beforeEach(async function () {
    [
      deployer,
      treasury,
      spaceTokenIco,
      ...accounts
    ] = await ethers.getSigners();

    const SpaceTokenFactory = await ethers.getContractFactory(
      "SpaceToken"
    );
    spaceToken = await SpaceTokenFactory.connect(deployer).deploy(
      treasury.address, spaceTokenIco.address
    );
    await spaceToken.deployed();
  });

  describe("deployment", async function () {
    it("should create the SPC token", async function () {
      expect(await spaceToken.name()).to.equal("Space Token");
      expect(await spaceToken.symbol()).to.equal("SPC");
    });

    it("should mint SPC tokens to treasury & ICO address", async function () {
      expect(await spaceToken.balanceOf(treasury.address)).to.equal(parseEther("350000"));
      expect(await spaceToken.balanceOf(spaceTokenIco.address)).to.equal(parseEther("150000"));
      expect(await spaceToken.totalSupply()).to.equal(parseEther("500000"));
    });
  });

  describe("Tax", async function () {
    it("tax flag should be off by default", async function () {
      expect(await spaceToken.isTaxInEffect()).to.equal(false);
    });

    it("should NOT be updatable by non-owner", async function () {
      await expect(
        spaceToken.connect(accounts[0]).updateTaxFlag(false)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should be updatable by owner", async function () {
      await spaceToken.connect(deployer).updateTaxFlag(true);
      expect(await spaceToken.isTaxInEffect()).to.equal(true);

      await spaceToken.connect(deployer).updateTaxFlag(false);
      expect(await spaceToken.isTaxInEffect()).to.equal(false);
    });

    it("should tax the transfer when tax is in effect", async function () {
      // Tax is in affect
      await spaceToken.connect(deployer).updateTaxFlag(true);

      // Treasury transfers SPC tokens
      const recipient = accounts[0];
      await spaceToken.connect(treasury).transfer(recipient.address, parseEther("100"));

      // Recipient's SPC balance should be 98 = 100 - 2 (tax)
      expect(await spaceToken.balanceOf(recipient.address)).to.equal(parseEther("98"));

      // Recipient transfers 50 SPC token to someone else
      const luckyGuy = accounts[1];
      await spaceToken
        .connect(recipient)
        .transfer(luckyGuy.address, parseEther("50"));

      // Lucky guy's SPC balance should be 49 = 50 - 1
      expect(await spaceToken.balanceOf(luckyGuy.address)).to.equal(parseEther("49"));
    
      // Recipient's SPC balance should be 48 = 98 - 50
      expect(await spaceToken.balanceOf(recipient.address)).to.equal(parseEther("48"));

      // treasury's SPC balance should be 350K - 100 + 3 SPC tokens
      expect(await spaceToken.balanceOf(treasury.address)).to.equal(parseEther("349903"));
    });

    it("should NOT tax the transfer when tax is NOT in effect", async function () {
      // Tax is NOT in effect by default
      // Treasury transfers 100 SPC token to someone else
      const luckyGuy = accounts[1];
      await spaceToken.connect(treasury).transfer(luckyGuy.address, parseEther("1000"));

      // luckyGuy's SPC balance should be 1000
      expect(await spaceToken.balanceOf(luckyGuy.address)).to.equal(parseEther("1000"));

      // treasury's SPC balance should be 350K - 1000 SPC tokens
      expect(await spaceToken.balanceOf(treasury.address)).to.equal(parseEther("349000"));
    });
  });
});
