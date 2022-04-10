const { expect } = require("chai");
const { ethers } = require("hardhat");

const parseEther = ethers.utils.parseEther;

let lpProvider1;
let trader1;
let spaceToken;
let spaceRouter;

describe("SpaceRouter", function () {
    beforeEach(async function () {
        [
          deployer,
          treasury,
          lpProvider1,
          trader1,
          ...accounts
        ] = await ethers.getSigners();
    
        // Deploy SPC token
        const SpaceTokenFactory = await ethers.getContractFactory(
          "SpaceToken"
        );
        spaceToken = await SpaceTokenFactory.connect(deployer).deploy(
          treasury.address, accounts[4].address
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

        // Deploy Space router
        const SpaceRouterFactory = await ethers.getContractFactory(
            "SpaceRouter"
          );
          spaceRouter = await SpaceRouterFactory.connect(deployer).deploy(
            spaceToken.address, ethSpcLiquidityPair.address
          );
          await spaceRouter.deployed();

          await spaceToken.connect(treasury).transfer(lpProvider1.address, parseEther("1000"));
    });

    describe("deployment", async function () {
        it("should work", async function () {
            expect(spaceRouter === undefined || spaceRouter === null).to.equal(false);
            expect(await spaceRouter.owner()).to.equal(deployer.address);
        });
    });

    describe("addLiquidity", async function () {
        it("should not accept 0 amounts before 1st liquidity", async function () {
            await expect(
                spaceRouter.addLiquidity(0, 0, 0, treasury.address, getDeadlineFromNow(5))
            ).to.be.revertedWith("EthSpcLiquidityPair: Not enough ETH");
        });

        it("should not accept 0 amounts after 1st liquidity", async function () {
            await addLiquidity("1", "5");
            await expect(
                spaceRouter.addLiquidity(0, 0, 0, treasury.address, getDeadlineFromNow(5))
            ).to.be.revertedWith("SpaceRouter: Insufficient amount")
        });

        it("should accept first liquidity", async function () {
            const spcBalanceBefore = await spaceToken.balanceOf(lpProvider1.address);
            console.log("Before SPC: " + spcBalanceBefore);

            // add 1 eth / 9 SPC liquidity
            await addLiquidity("1", "9");
            
            // Verify allowance is consumed
            expect(await spaceToken.allowance(treasury.address, spaceRouter.address)).to.equal("0");

            // Verify treasury SPC balance is reduced by SPC added to the pool
            const spcBalanceAfter = await spaceToken.balanceOf(lpProvider1.address);
            console.log("After SPC: " + spcBalanceAfter);
            expect(spcBalanceBefore.sub(spcBalanceAfter).eq(parseEther("9"))).to.equal(true);
        });

        it("should accept second liquidity with same price ratio", async function () {
            // 1st Liquidity: add 1 eth / 9 SPC liquidity
            await addLiquidity("1", "9");
            
             // 2nd Liquidity: add 1 eth / 9 SPC liquidity
             await addLiquidity("1", "9");
        });

        it("should NOT accept second liquidity with non-optimal ETH", async function () {
            // 1st Liquidity: add 1 eth / 9 SPC liquidity
            await addLiquidity("1", "9");
            
            // 2nd Liquidity: add 1 eth / 8 SPC liquidity
            const desiredEthAmt = parseEther("1");
            const desiredSpcAmt = parseEther("8");
            await spaceToken.connect(treasury).approve(spaceRouter.address, desiredSpcAmt);
            await expect(
                spaceRouter.connect(treasury)
                    .addLiquidity(desiredSpcAmt, desiredEthAmt, desiredSpcAmt, treasury.address, getDeadlineFromNow(5), { value: desiredEthAmt })
            ).to.be.revertedWith("SpaceRouter: non-optimal ETH in");
        });

        it("should NOT accept second liquidity with non-optimal SPC", async function () {
            // 1st Liquidity: add 1 eth / 9 SPC liquidity
            await addLiquidity("1", "9");
            
            // 2nd Liquidity: add 1 eth / 8 SPC liquidity
            const desiredEthAmt = parseEther("0.8");
            const desiredSpcAmt = parseEther("9");
            await spaceToken.connect(treasury).approve(spaceRouter.address, desiredSpcAmt);
            await expect(
                spaceRouter.connect(treasury)
                    .addLiquidity(desiredSpcAmt, desiredEthAmt, desiredSpcAmt, treasury.address, getDeadlineFromNow(5), { value: desiredEthAmt })
            ).to.be.revertedWith("SpaceRouter: non-optimal SPC in");
        });
    });

    describe("removeLiquidity", async function () {
        it("should not accept 0 amounts", async function () {
            await expect(
                spaceRouter.removeLiquidity(0, 0, 0, treasury.address, getDeadlineFromNow(5))
            ).to.be.revertedWith("EthSpcLiquidityPair: Not enough liquidity");
        });

        it("should not tolerate incorrect ETH amount out", async function () {
            // add 3 eth / 27 SPC liquidity
            await addLiquidity("3", "27");
            const lpAmtToRemove = parseEther("3");

            // approve LP tokens for spacerouter
            await ethSpcLiquidityPair.connect(lpProvider1).approve(spaceRouter.address, lpAmtToRemove);

            // remove liquidity should return 1 ETH & 9 SPC back (1/3 of the reserves)
            await expect(
                spaceRouter.connect(lpProvider1)
                    .removeLiquidity(lpAmtToRemove, parseEther("1.1"), parseEther("9"), lpProvider1.address, getDeadlineFromNow(5))
            ).to.be.revertedWith("SpaceRouter: Insufficient ETH amount");
        });

        it("should not tolerate incorrect SPC amount out", async function () {
            // add 3 eth / 27 SPC liquidity
            await addLiquidity("3", "27");
            const lpAmtToRemove = parseEther("3");

            // approve LP tokens for spacerouter
            await ethSpcLiquidityPair.connect(lpProvider1).approve(spaceRouter.address, lpAmtToRemove);

            // remove liquidity should return 1 ETH & 9 SPC back (1/3 of the reserves)
            await expect(
                spaceRouter.connect(lpProvider1)
                    .removeLiquidity(lpAmtToRemove, parseEther("1"), parseEther("10"), lpProvider1.address, getDeadlineFromNow(5))
            ).to.be.revertedWith("SpaceRouter: Insufficient SPC amount");
        });

        it("should return correct ETH & SPC", async function () {
            // add 3 eth / 27 SPC liquidity
            await addLiquidity("3", "27");
            
            const lpBalanceBefore = await ethSpcLiquidityPair.balanceOf(lpProvider1.address);
            console.log("Before LP: " + lpBalanceBefore);

            const lpAmtToRemove = parseEther("3");

            // approve LP tokens for spacerouter
            await ethSpcLiquidityPair.connect(lpProvider1).approve(spaceRouter.address, lpAmtToRemove);

            // remove liquidity with expecting 1 ETH & 9 SPC back (3 lp tokens = 1/3 of the reserves)
            await spaceRouter.connect(lpProvider1)
                .removeLiquidity(lpAmtToRemove, parseEther("1"), parseEther("9"), lpProvider1.address, getDeadlineFromNow(5));

            // Verify allowance is consumed
            expect(await ethSpcLiquidityPair.allowance(lpProvider1.address, spaceRouter.address)).to.equal("0");

            // Verify LP balance is reduced by LP tokens remove from the pool
            const lpBalanceAfter = await ethSpcLiquidityPair.balanceOf(lpProvider1.address);
            console.log("After LP: " + lpBalanceAfter);
            expect(lpBalanceBefore.sub(lpBalanceAfter).eq(lpAmtToRemove)).to.equal(true);
        });
    });

    describe("swapInETH", async function () {
        it("should revert whithout liquidity", async function () {
            await expect(
                spaceRouter
                    .connect(trader1)
                    .swapInETH(trader1.address, parseEther("1"), getDeadlineFromNow(5))
            ).to.be.revertedWith("EthSpcLiquidityPair: No Liquidity");
        });

        it("should revert when no ETH is provided", async function () {
            // add 10 eth / 50 SPC liquidity
            await addLiquidity("10", "50");

            await expect(
                spaceRouter
                    .connect(trader1)
                    .swapInETH(trader1.address, parseEther("1"), getDeadlineFromNow(5))
            ).to.be.revertedWith("EthSpcLiquidityPair: Not enough ETH Provided");
        });

        it("should not tolerate SPC amt less than specified minimum", async function () {
            // add 10 eth / 50 SPC liquidity
            await addLiquidity("10", "50");
            const expectedSpc = parseEther("5");
            await expect(
                spaceRouter
                    .connect(trader1)
                    .swapInETH(trader1.address, expectedSpc, getDeadlineFromNow(5), { value: parseEther("1") })
            ).to.be.revertedWith("SpaceRouter: Not enough SPC out");
        });

        it("should return correct SPC token amt", async function () {
            // add 10 eth / 50 SPC liquidity
            await addLiquidity("10", "50");

            const spcBalanceBefore = await spaceToken.balanceOf(trader1.address);
            console.log("Before SPC: " + spcBalanceBefore);
            const expectedSpc = parseEther("4.5");
            await spaceRouter
                .connect(trader1)
                .swapInETH(trader1.address, expectedSpc, getDeadlineFromNow(5), { value: parseEther("1") });
            
            const spcBalanceAfter = await spaceToken.balanceOf(trader1.address);
            console.log("After SPC: " + spcBalanceAfter);
            expect(spcBalanceAfter.sub(spcBalanceBefore).gte(expectedSpc)).to.equal(true);
        });
    });

    describe("swapInSPC", async function () {
        it("should revert whithout liquidity", async function () {
            await spaceToken.connect(lpProvider1).approve(spaceRouter.address, parseEther("1"));
            await expect(
                spaceRouter
                    .swapInSPC(lpProvider1.address, parseEther("1"), 1, getDeadlineFromNow(5))
            ).to.be.revertedWith("EthSpcLiquidityPair: No Liquidity");
        });

        it("should revert when no SPC is provided", async function () {
            // add 10 eth / 50 SPC liquidity
            await addLiquidity("10", "50");
            
            await spaceToken.connect(lpProvider1).approve(spaceRouter.address, parseEther("1"));

            await expect(
                spaceRouter
                    .connect(lpProvider1)
                    .swapInSPC(lpProvider1.address, 0, 1, getDeadlineFromNow(5))
            ).to.be.revertedWith("EthSpcLiquidityPair: Not enough SPC Provided");
        });

        it("should not accept when ETH amt out is less than specified minimum", async function () {
            const spcAmtIn = parseEther("5");
            const expectedEth = parseEther("1");

            // add 10 eth / 50 SPC liquidity
            await addLiquidity("10", "50");

            // approve 5 spc
            await spaceToken.connect(lpProvider1).approve(spaceRouter.address, spcAmtIn);

            await expect(
                spaceRouter
                    .connect(lpProvider1)
                    .swapInSPC(lpProvider1.address, spcAmtIn, expectedEth, getDeadlineFromNow(5))
            ).to.be.revertedWith("SpaceRouter: Not enough ETH out");
        });

        it("should return correct ETH token amt", async function () {
            const spcAmtIn = parseEther("5");
            const expectedEth = parseEther("0.9");

            // add 10 eth / 50 SPC liquidity
            await addLiquidity("10", "50");

            // approve 5 spc
            await spaceToken.connect(lpProvider1).approve(spaceRouter.address, spcAmtIn);

            const ethBalanceBefore = await ethers.provider.getBalance(lpProvider1.address);
            console.log("Before ETH: " + ethBalanceBefore);
            
            await spaceRouter
                .connect(lpProvider1)
                .swapInSPC(lpProvider1.address, spcAmtIn, expectedEth, getDeadlineFromNow(5));
            
            const ethBalanceAfter = await ethers.provider.getBalance(lpProvider1.address);
            console.log("After ETH: " + ethBalanceAfter);
            expect(ethBalanceAfter.sub(ethBalanceBefore).gte(expectedEth)).to.equal(true);
        });
    });

    describe("deadline tests", async function () {
        it("should not accept addLiquidity after deadline", async function () {
            const deadline = getDeadlineFromNow(5); // deadline is 5 mins from now
            // forward block time by 6 mins
            await increaseTime(6);
            await expect(
                spaceRouter.addLiquidity(1, 1, 1, treasury.address, deadline)
            ).to.be.revertedWith("Passed the deadline");
        });

        it("should not accept removeLiquidity after deadline", async function () {
            const deadline = getDeadlineFromNow(5); // deadline is 5 mins from now
            // forward block time by 6 mins
            await increaseTime(6);
            await expect(
                spaceRouter.removeLiquidity(1, 1, 1, treasury.address, deadline)
            ).to.be.revertedWith("Passed the deadline");
        });

        it("should not accept swapInETH after deadline", async function () {
            const deadline = getDeadlineFromNow(5); // deadline is 5 mins from now
            // forward block time by 6 mins
            await increaseTime(6);
            await expect(
                spaceRouter.swapInETH(trader1.address, 1, deadline)
            ).to.be.revertedWith("Passed the deadline");
        });

        it("should not accept swapInSPC after deadline", async function () {
            const deadline = getDeadlineFromNow(5); // deadline is 5 mins from now
            // forward block time by 6 mins
            await increaseTime(6);
            await expect(
                spaceRouter.swapInSPC(trader1.address, 1, 1, deadline)
            ).to.be.revertedWith("Passed the deadline");
        });
    })

    async function increaseTime(mins) {
        await network.provider.send("evm_increaseTime", [60 * mins]);
        // Need to mine block after increasing time
        await network.provider.send("evm_mine", []);
    }

    function getDeadlineFromNow(mins) {
        const deadlineDate = new Date();
        deadlineDate.setMinutes(deadlineDate.getMinutes() + mins);  // add specified minutes
        deadlineDate.setMilliseconds(0);    // roundout millis to avoid BigNumber underflow exception
        return deadlineDate.getTime()/1000; // convert to unix timestamp in seconds
    }

    async function addLiquidity(ethAmt, spcAmt) {
        const desiredEthAmt = parseEther(ethAmt);
        const desiredSpcAmt = parseEther(spcAmt);
        await spaceToken.connect(lpProvider1).approve(spaceRouter.address, desiredSpcAmt);
        await spaceRouter.connect(lpProvider1)
            .addLiquidity(desiredSpcAmt, desiredEthAmt, desiredSpcAmt, lpProvider1.address, getDeadlineFromNow(5), { value: desiredEthAmt });
    }
});