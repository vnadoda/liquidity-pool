// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ISpaceRouter.sol";
import "./interfaces/SpaceTokenICOConstants.sol";
import "./SpaceToken.sol";

contract SpaceTokenICO is SpaceTokenICOConstants, Ownable {
    /// @dev treasury account managing the tokens
    address private immutable _treasuryAccount;

    /// @dev space token address
    SpaceToken public immutable _spaceToken;

    /// @dev tracks total investments by all investors
    uint public totalInvestment;

    /// @dev mapping to track investments
    mapping(address => uint) public investments;

    /// @dev A whitelist of seed investors
    mapping(address => bool) private _seedInvestors;

    /// @dev tracks the current pahse of the ICO
    Phase public currentPhase = Phase.Seed;

    /// @dev flag to track whether fundraise is paused or not
    ///          Contract owner can pause & unpause fundraising anytime
    bool public isPaused = false;

    constructor(address treasuryAccount_)
    {
        _treasuryAccount = treasuryAccount_;
        _spaceToken = new SpaceToken(_treasuryAccount, address(this));
    }

    /**
     * @notice adds an array of specified addresses as seed investors
     */
    function addSeedInvestors(address[] memory seedInvestors) external onlyOwner {
        require(currentPhase == Phase.Seed, "Not seed phase");
        for (uint256 index = 0; index < seedInvestors.length; index++) {
            _seedInvestors[seedInvestors[index]] = true;   
        }
    }

    /**
     * @notice Investors invests ETH to buy SPC tokens
     */
    function invest() external payable {
        require(!isPaused, "Fundraise paused");
        require((totalInvestment + msg.value) <= MAX_TOTAL_INVESTMENT, "Above max total investment limit");
        _verifyIndividualInvestmentLimit();

        /// Seed phase specific checks
        if (currentPhase == Phase.Seed) {
            require(_seedInvestors[msg.sender], "Not Seed Investor");
            require(totalInvestment + msg.value <= MAX_TOTAL_SEED_INVESTMENT, "Max seed investment");
        }
        
        investments[msg.sender] += msg.value;
        totalInvestment += msg.value;
    }

    /**
     * @notice An owner can update a flag that toggles fundraise on/off
     */
    function updatePauseFlag(bool pause) external onlyOwner {
        isPaused = pause;
    }

    /**
     * @notice An owner can move ICO forward one phase at a time
     */
    function moveToPhase(Phase newPhase) external onlyOwner {
        require(uint(newPhase) == uint(currentPhase) + 1, "New phase is not valid");
        require(uint(newPhase) <= uint(type(Phase).max), "Can't move forward");

        currentPhase = Phase(newPhase);
    }

    /**
     * @notice Investors can claim their SPC tokens after ICO is in open phase
     */
    function claimSPCTokens() external {
        require(currentPhase == Phase.Open, "Not open phase");
        require(investments[msg.sender] > 0, "No balance");

        uint spcTokenAmount = (investments[msg.sender] * ETH_TO_SPC_CONVERSION);
        investments[msg.sender] = 0;

        /// transfer SPC tokens to the investor
        _spaceToken.transfer(msg.sender, spcTokenAmount);
    }

    /** 
     * @notice Moves the ETH & SPC funds to the ETH-SPC liquidity pool.
     * Treasury needs to approve SPC transfer before calling this function.
    */
    function moveFundsToLiquidityPool(address poolRouterAddress, uint ethAmt, uint spcAmt) external {
        require(currentPhase == Phase.Open, "SpaceTokenICO: Not open phase");
        require(msg.sender == _treasuryAccount, "SpaceTokenICO: Not Treasury");
        require(ethAmt <= address(this).balance, "SpaceTokenICO: Not enough ETH");

        if (address(this).balance > 0) {
            /// this contract needs to approve SPC allowance before calling addLiquidity
            _spaceToken.approve(poolRouterAddress, spcAmt);

            /// Add liquidity using router contract and transfer LP tokens  to the treasury
            /// Allows 1% slippage
            uint minEthAmt = ethAmt - (ethAmt / 100);
            uint minSpcAmt = spcAmt - (spcAmt / 100);
            ISpaceRouter router = ISpaceRouter(poolRouterAddress);
            router.addLiquidity{value: ethAmt}(spcAmt, minEthAmt, minSpcAmt, _treasuryAccount, (block.timestamp + 1 minutes));
        }
    }

    /**
     * @notice Specifies whether a specified address is seed investor or not
     */
    function isSeedInvestor(address investor) external view returns (bool) {
        return _seedInvestors[investor];
    }

    /**
     * @dev private functon to verify investment limit based on the current phase of the ICO.
     */
    function _verifyIndividualInvestmentLimit() private view {
        if (currentPhase == Phase.Seed && (investments[msg.sender] + msg.value) > MAX_SEED_INVESTMENT) {
            revert("Above seed investment limit");
        }
        else if(currentPhase == Phase.General && (investments[msg.sender] + msg.value) > MAX_GENERAL_INVESTMENT) {
            revert("Above general investment limit");
        }
    }
}
