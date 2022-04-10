const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseEther = ethers.utils.parseEther;

let trader;
let spaceToken;
let ethSpcLiquidityPair;

describe("EthSpcLiquidityPair", function () {
    beforeEach(async function () {
        [
          deployer,
          treasury,
          trader,
          ...accounts
        ] = await ethers.getSigners();
    
        // Deploy SPC token
        const SpaceTokenFactory = await ethers.getContractFactory(
          "SpaceToken"
        );
        spaceToken = await SpaceTokenFactory.connect(deployer).deploy(
          treasury.address, accounts[5].address
        );
        await spaceToken.deployed();
    
        // Deploy EthSpcLiquidityPair
        const EthSpcLiquidityPairFactory = await ethers.getContractFactory(
            "EthSpcLiquidityPair"
          );
          ethSpcLiquidityPair = await EthSpcLiquidityPairFactory.connect(deployer).deploy(
            spaceToken.address, 
          );
          await ethSpcLiquidityPair.deployed();
    });

    describe("deployment", async function () {
        it("should work", async function () {
            expect(ethSpcLiquidityPair === undefined || ethSpcLiquidityPair === null).to.equal(false);
            expect(await ethSpcLiquidityPair.owner()).to.equal(deployer.address);
        });
    });

    describe("addLiquidity", async function () {
        it("should revert without sending ETH", async function () {
            await expect(
                ethSpcLiquidityPair.addLiquidity(treasury.address)
            ).to.be.revertedWith("EthSpcLiquidityPair: Not enough ETH");
        });

        it("should work on first liquidity", async function () {
            const expectedLpAmt = parseEther("3").sub(1000);    // reduce by min liquidity
            // allow some SPC from treasury to ethSpc pair
            let spcAmt = parseEther("9");
            await addSPCAllowance(spcAmt);

            // sending 1 ETH & 9 SPC
            let ethAmt = parseEther("1");
            await expect(() => ethSpcLiquidityPair.addLiquidity(treasury.address, { value: ethAmt }))
                .to.changeTokenBalance(ethSpcLiquidityPair, treasury, expectedLpAmt)    // treasury receive 3 lp token

            // verify reserves
            await verifyReserves(ethAmt, spcAmt);

            // verify lp token total supply
            expect(await ethSpcLiquidityPair.totalSupply()).to.equal(parseEther("3"));

            // verify ethSpcLiquidityPair's allowance is used
            expect(await spaceToken.allowance(treasury.address, ethSpcLiquidityPair.address)).to.equal(parseEther("0"));

            // verify that min liq is minted to SpaceToken
            expect(await ethSpcLiquidityPair.balanceOf(spaceToken.address)).to.equal(1000);
        });

        it("should work on second liquidity", async function () {
            const expectedLpAmt = parseEther("3");

            // 1st liquidity add: sending 1 ETH & 9 SPC
            const spcAmt = parseEther("18");
            const ethAmt = parseEther("2");
            await addLiquidity(ethAmt, spcAmt);

            // verify reserves & lp token total supply after 1st liquidity add
            await verifyReserves(ethAmt, spcAmt);
            expect(await ethSpcLiquidityPair.totalSupply()).to.equal(parseEther("6"));

            // sending another 1 ETH & 9 SPC
            await addSPCAllowance(parseEther("9"));
            await expect(() => ethSpcLiquidityPair.addLiquidity(treasury.address, { value: parseEther("1")}))
                .to.changeTokenBalance(ethSpcLiquidityPair, treasury, parseEther("3"));    // treasury receives 3 lp token
            
            // verify reserves & lp token total supply after 2nd liquidity add
            await verifyReserves(parseEther("3"), parseEther("27"));
            expect(await ethSpcLiquidityPair.totalSupply()).to.equal(parseEther("9"));
        });
    });

    describe("removeLiquidity", async function () {
        it("should revert without LP token balance", async function () {
            await expect(
                ethSpcLiquidityPair.removeLiquidity(treasury.address)
            ).to.be.revertedWith("Not enough liquidity");
        });

        it("should burn lp token & reduce reserves", async function () {
            // 1st liquidity add: sending 2 ETH & 8 SPC by treasury
            const ethAmt = parseEther("2");
            const spcAmt = parseEther("8");
            await addLiquidity(ethAmt, spcAmt);

            const expectedLpAmt = parseEther("4").sub(1000);
            expect(await ethSpcLiquidityPair.balanceOf(treasury.address))
                .to.equal(expectedLpAmt);
            
            await verifyReserves(ethAmt, spcAmt);
            const totalSupplyBeforeBurn = await ethSpcLiquidityPair.totalSupply();

            // Remove liquidity by 1 LP token
            const lpTokenToBeRemoved = parseEther("1");
            await ethSpcLiquidityPair.connect(treasury).transfer(ethSpcLiquidityPair.address, lpTokenToBeRemoved);
            await ethSpcLiquidityPair.removeLiquidity(treasury.address);

            // Verify that LP token balance reduce by 1
            expect(await ethSpcLiquidityPair.balanceOf(treasury.address))
                .to.equal(expectedLpAmt.sub(lpTokenToBeRemoved));
            
            await verifyReserves(
                parseEther("1.5"), 
                parseEther("6")
            );

            // Verify total supply of LP tokens
            expect(await ethSpcLiquidityPair.totalSupply())
                .to.equal(totalSupplyBeforeBurn.sub(lpTokenToBeRemoved));
        });
    });

    describe("swapInETH", async function () {
        it("should revert without liquidity", async function () {
            await expect(ethSpcLiquidityPair.swapInETH(accounts[0].address))
                .to.be.revertedWith("EthSpcLiquidityPair: No Liquidity");
        });

        it("should revert without providing ETH", async function () {
            await addLiquidity(parseEther("10"), parseEther("50"));
            await expect(ethSpcLiquidityPair.swapInETH(accounts[0].address))
                .to.be.revertedWith("EthSpcLiquidityPair: Not enough ETH Provided");
        });

        it("should return SPC", async function () {
            const spcBalanceBefore = await spaceToken.balanceOf(trader.address);
            console.log("Before SPC: " + spcBalanceBefore);

            // add liquidity
            await addLiquidity(parseEther("10"), parseEther("50"));

            // perform swap
            const expectedSpc = parseEther("4.5");
            await ethSpcLiquidityPair.swapInETH(trader.address, { value: parseEther("1")});

            const spcBalanceAfter = await spaceToken.balanceOf(trader.address);
            console.log("After SPC: " + spcBalanceAfter);

            // verify SPC balance change
            expect(spcBalanceAfter.sub(spcBalanceBefore).gte(expectedSpc)).to.equal(true);

            // Verify that pair's ETH & SPC balance matches with reserves
            await verifyBalanceAndReserveMatches();
        });
    });

    describe("swapInSPC", async function () {
        it("should revert without liquidity", async function () {
            await expect(ethSpcLiquidityPair.swapInSPC(accounts[0].address))
                .to.be.revertedWith("EthSpcLiquidityPair: No Liquidity");
        });

        it("should revert without providing SPC", async function () {
            await addLiquidity(parseEther("10"), parseEther("50"));
            await expect(ethSpcLiquidityPair.swapInSPC(accounts[0].address))
                .to.be.revertedWith("EthSpcLiquidityPair: Not enough SPC Provided");
        });

        it("should return ETH", async function () {
            const spcAmtIn = parseEther("5");
            const expectedEth = parseEther("0.9");

            // Add liquidity
            await addLiquidity(parseEther("10"), parseEther("50"));

            // Add SPC allowance for swap
            await addSPCAllowance(spcAmtIn);

            const ethBalanceBefore = await ethers.provider.getBalance(trader.address);
            console.log("Before ETH: " + ethBalanceBefore);

            // perform swap
            await ethSpcLiquidityPair.swapInSPC(trader.address);

            console.log("Pair ETH Balance: ", await ethers.provider.getBalance(ethSpcLiquidityPair.address)); 
            
            const ethBalanceAfter = await ethers.provider.getBalance(trader.address);
            console.log("After ETH: " + ethBalanceAfter);
            const receivedEth = ethBalanceAfter.sub(ethBalanceBefore);
            console.log("Received ETH: " + receivedEth);
            expect(receivedEth.gte(expectedEth) && receivedEth.lte(parseEther("1"))).to.equal(true);

            // Verify that pair's ETH & SPC balance matches with reserves
            await verifyBalanceAndReserveMatches();
        });
    });

    async function addLiquidity(ethAmt, spcAmt) {
        await addSPCAllowance(spcAmt, ethSpcLiquidityPair);

        // 1st liquidity add: sending specified ETH & SPC
        await ethSpcLiquidityPair.addLiquidity(treasury.address, { value: ethAmt });
    }

    // allow specified SPC from treasury to ethSpc pair
    async function addSPCAllowance(targetAmt) {
        await spaceToken.connect(treasury).approve(accounts[0].address, targetAmt);
        await spaceToken.connect(accounts[0]).transferFrom(treasury.address, ethSpcLiquidityPair.address, targetAmt);
    }

    async function verifyReserves(expectedEthAmt, expectedSpcAmt) {
        const [ethReserve, spcReserve] = await ethSpcLiquidityPair.getReserves();
        expect(ethReserve).to.equal(expectedEthAmt);
        expect(spcReserve).to.equal(expectedSpcAmt);
        await verifyBalanceAndReserveMatches();
    }

    async function verifyBalanceAndReserveMatches() {
        // Verify that pair's ETH & SPC balance matches with reserves
        const [ethReserve, spcReserve] = await ethSpcLiquidityPair.getReserves();
        expect((await ethers.provider.getBalance(ethSpcLiquidityPair.address)).eq(ethReserve));
        expect((await spaceToken.balanceOf(ethSpcLiquidityPair.address)).eq(spcReserve));
    }
});