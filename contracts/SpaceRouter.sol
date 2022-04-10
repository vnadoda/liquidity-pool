// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./EthSpcLiquidityPair.sol";
import "./interfaces/ISpaceRouter.sol";
import "./interfaces/IEthSpcLiquidityPair.sol";

contract SpaceRouter is ISpaceRouter, Ownable {
    address private immutable _pairAddress;
    IEthSpcLiquidityPair private immutable _pair;
    IERC20 private immutable _spcToken;

    modifier ensure(uint deadline) {
        require(block.timestamp <= deadline, "Passed the deadline");
        _;
    }

    constructor(address spcToken, address lpPair) {
        _pair = IEthSpcLiquidityPair(lpPair);
        _spcToken = IERC20(spcToken);
        _pairAddress = lpPair;
    }

    /**
     * @notice Adds liquidity (ETH, SPC) to the pool 
     * and mints out propotional LP tokens.
     * SPC tokens need to be approved before calling this method.
     *
     * @param desiredSpcAmt: SPC amount that should be added to the pool.
     * @param minEthAmt: Transaction will revert if ETH amount added doesn't meet min amt specified.
     * @param minSpcAmt: Transaction will revert if SPC amount added doesn't meet min amt specified.
     * @param to: Address where the LP tokens wull be transferred.
     * @param deadline: Trasaction will revert if it can not be executed within deadline specfied.
     */
    function addLiquidity(
        uint desiredSpcAmt,
        uint minEthAmt,
        uint minSpcAmt,
        address to,
        uint deadline
    ) external payable ensure(deadline) returns(uint ethAmtIn, uint spcAmtIn, uint liquidity) {
        (uint ethAmt, uint spcAmt) = calculateOptimalAmountsIn(msg.value, desiredSpcAmt, minEthAmt, minSpcAmt);
        
        /// transfer specified SPC amt from LP provider to pair contract
        uint spcBalanceBefore = _spcToken.balanceOf(_pairAddress);
        require(_spcToken.transferFrom(msg.sender, _pairAddress, spcAmt), "SPC transferFrom failed");
        uint spcBalanceAfter = _spcToken.balanceOf(_pairAddress);

        /// Because of token transfer tax, we need to verify that SPC amount in is less than or equal to min amt specified
        require((spcBalanceAfter - spcBalanceBefore) >= minSpcAmt, "SpaceRouter: not enough SPC in");

        /// Add liquidity using pair contract
        (ethAmtIn, spcAmtIn, liquidity) = _pair.addLiquidity{value: ethAmt}(to);

        /// transfer unused eth amt back
        if (msg.value > ethAmtIn) {
            (bool success,) = msg.sender.call{ value: (msg.value - ethAmtIn) }("");
            require(success, "SpaceRouter: Failed to trasfer unused ETH");
        }
    }

    /**
     * @notice Removes liquidity (ETH, SPC) from the pool.
     * It burns the specified LP tokens to return propotional ETH/SPC.
     * Caller need to approve LP token amount being removed from the pool before call this function.
     *
     * @param liquidity: LP token amt that should be burned.
     * @param minEthAmt: Transaction will revert if ETH amount returned doesn't meet min amt specified.
     * @param minSpcAmt: Transaction will revert if SPC amount returned doesn't meet min amt specified.
     * @param to: Address where the ETH & SPC tokens will be transferred.
     * @param deadline: Trasaction will revert if it can not be executed within deadline specfied.
     */
    function removeLiquidity(
        uint liquidity,
        uint minEthAmt,
        uint minSpcAmt,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint ethAmt, uint spcAmt) {
         /// transfer specified liquidity amt from LP provider to pair contract
        require(_pair.transferFrom(msg.sender, address(_pair), liquidity), "SpaceRouter: LP token transferFrom failed");

        /// Remove liquidity using pair contract
        (ethAmt, spcAmt) = _pair.removeLiquidity(to);

        /// We can not calculate exact SPC amount out ahead because SPC token transfer can be taxed.
        /// So instead we will verify that SPC amt out is greather than or equal to minimum specified after removing liquidity.
        require(ethAmt >= minEthAmt, "SpaceRouter: Insufficient ETH amount");
        require(spcAmt >= minSpcAmt, "SpaceRouter: Insufficient SPC amount");
    }

    /**
     * @notice Swaps in provided amount of ETH to return SPC tokens.
     * @param to: address to where SPC will be transferred
     * @param minSpcAmtOut: Transaction will revert if SPC amount returned doesn't meet min amt specified.
     * @param deadline: Trasaction will revert if it can not be executed within deadline specfied.
     */
    function swapInETH(
        address to, 
        uint minSpcAmtOut,
        uint deadline) external payable ensure(deadline) returns(uint spcAmtOut)
    {
        /// We can not calculate exact SPC amount out ahead because SPC token transfer can be taxed
        /// plus there is trading fee for the swap.
        /// So instead we will verify that SPC amt out is within slippage after swap
        uint spcBalanceBefore = _spcToken.balanceOf(to);

        /// perform swap using pair contract
        _pair.swapInETH{value: msg.value}(to);

        uint spcBalanceAfter = _spcToken.balanceOf(to);
        spcAmtOut = spcBalanceAfter - spcBalanceBefore;
        require(spcAmtOut >= minSpcAmtOut, "SpaceRouter: Not enough SPC out");
    }

    /**
     * @notice Swaps in provided amount of SPC token to return ETH.
     * 
     * @param to: Address to where ETH will be transferred. 
     *                Caller needs to approve this SPC token amount before calling.
     * @param spcAmtIn: SPC amount to be swapped for ETH.
     * @param minEthAmtOut: Transaction will revert if ETH returned doesn't meet minimum amount specified.
     * @param deadline: Trasaction will revert if it can not be executed within deadline specfied.
     */
    function swapInSPC(
        address to,
        uint spcAmtIn,
        uint minEthAmtOut,
        uint deadline) external ensure(deadline) returns(uint ethAmtOut)
    {
        /// Transfer SPC tokens to pair contract from allowance
        require(_spcToken.transferFrom(to, _pairAddress, spcAmtIn), "SpaceRouter: Failed to transferFrom SPC");

        /// We can not calculate exact ETH amount out ahead because SPC token transfer can be taxed,
        /// plus there is trading fee for the swap.
        /// So instead we will verify that ETH amt out is within slippage after swap
        ethAmtOut = _pair.swapInSPC(to);
        require(ethAmtOut >= minEthAmtOut, "SpaceRouter: Not enough ETH out");
    }

    /**
     * @dev Calculates optimal amounts of ETH & SPC for adding liquidity into the pool based on current reserve ratio.
     */
    function calculateOptimalAmountsIn(
        uint desiredEthAmt,
        uint desiredSpcAmt,
        uint minEthAmt,
        uint minSpcAmt
    ) private view returns(uint ethAmt, uint spcAmt) {
        (uint ethReserve, uint spcReserve) = _pair.getReserves();

        if (ethReserve == 0 && spcReserve == 0) {
            /// first time liquidity means you get desired amounts in
             (ethAmt, spcAmt) = (desiredEthAmt, desiredSpcAmt);
        }
        else {
            /// consider optimal amt of SPC required to be added compared to ETH
            uint optimalSpcAmt = quote(desiredEthAmt, ethReserve, spcReserve);
            if (optimalSpcAmt <= desiredSpcAmt) {
                require(optimalSpcAmt >= minSpcAmt, "SpaceRouter: non-optimal SPC in");
                (ethAmt, spcAmt) = (desiredEthAmt, optimalSpcAmt);
            }
            else {
                /// consider optimal amt of ETH required to be added compared to SPC
                uint optimalEthAmt = quote(desiredSpcAmt, spcReserve, ethReserve);
                assert(optimalEthAmt <= desiredEthAmt);
                require(optimalEthAmt >= minEthAmt, "SpaceRouter: non-optimal ETH in");
                (ethAmt, spcAmt) = (optimalEthAmt, desiredSpcAmt);
            }
        }
    }

    /**
     * @dev Calculates & provides amount B that can be returned for given amount A and reserve amounts specified 
     */
    function quote(uint amtA, uint reserveA, uint reserveB) private pure returns(uint amtB) {
        require(amtA > 0, "SpaceRouter: Insufficient amount");
        require(reserveA > 0 && reserveB > 0, "SpaceRouter: Zero reserves");
        amtB = (reserveB * amtA) / reserveA;
    }
}