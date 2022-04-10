// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEthSpcLiquidityPair is IERC20 {
    /**
     * @dev An event to be emitted when liquidity is added to the pool.
     * @param lpProvider: address providing the lquidity
     * @param ethAmt: amount of ETH added
     * @param spcAmt: amount of SPC token added
     * @param lpTokenAmt: amount of LP token minted for lpProvider
     */
    event LiquidityAdded(address indexed lpProvider, uint ethAmt, uint spcAmt, uint lpTokenAmt);

    /**
     * @dev An event to be emitted when liquidity is removed from the pool.
     * @param lpRemover: address removing the liquidity
     * @param ethAmt: amount of ETH transferred back
     * @param spcAmt: amount of SPC token transferred back
     * @param lpTokenAmt: amount of LP token burned from lpRemover's balance
     */
    event LiquidityRemoved(address indexed lpRemover, uint ethAmt, uint spcAmt, uint lpTokenAmt);

    /**
     * @dev An evnt to be emiited when trader swaps in ETH to receive SPC from pool
     * @param trader: address performing the swap
     * @param ethAmtIn: amount of ETH received in to the pool
     * @param spcAmtOut: amount of SPC tokens transffered out of the pool
     */
    event ETHSwappedIn(address indexed trader, uint ethAmtIn, uint spcAmtOut);

    /**
     * @dev An evnt to be emiited when trader swaps in ETH to receive SPC tokens from pool
     * @param trader: address performing the swap
     * @param spcAmtIn: amount of SPC tokens received in to the pool
     * @param ethAmtOut: amount of ETH transffered out of the pool
     */
    event SPCSwappedIn(address indexed trader, uint spcAmtIn, uint ethAmtOut);

    function addLiquidity(address lpProvider) external payable returns(uint ethAmt, uint spcAmt, uint liquidity);

    function removeLiquidity(address lpProvider) external returns(uint ethAmt, uint spcAmt);

    function swapInETH(address trader) external payable returns(uint spcAmtOut);

    function swapInSPC(address trader) external returns(uint ethAmtOut);

    function getReserves() external view returns(uint _ethReserve, uint _spcReserve);

    function calculateAmountOut(uint amtIn, uint amtInReserve, uint amtOutReserve) external pure returns(uint amtOut);
}