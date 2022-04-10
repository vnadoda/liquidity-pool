// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.8;

interface ISpaceRouter {
    function addLiquidity(
        uint desiredSpcAmt,
        uint minEthAmt,
        uint minSpcAmt,
        address to,
        uint deadline
    ) external payable returns(uint ethAmtIn, uint spcAmtIn, uint liquidity);

    function removeLiquidity(
        uint liquidity,
        uint minEthAmt,
        uint minSpcAmt,
        address to,
        uint deadline
    ) external returns (uint ethAmt, uint spcAmt);

    function swapInETH(
        address trader, 
        uint minSpcAmtOut,
        uint deadline) external payable returns(uint spcAmtOut);
    
    function swapInSPC(
        address trader,
        uint spcAmtIn,
        uint minEthAmtOut,
        uint deadline) external returns(uint ethAmtOut);
}