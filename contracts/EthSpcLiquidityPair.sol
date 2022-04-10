// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IEthSpcLiquidityPair.sol";
import "./libraries/Math.sol";

contract EthSpcLiquidityPair is IEthSpcLiquidityPair, ERC20, ReentrancyGuard, Ownable {
    /// Minimum liquidity of the pool. It is burned during first liquidity addition.
    uint public constant MIN_LIQUIDITY = 1000;

    address private immutable _pairAddress;
    IERC20 private immutable _spcToken;
    uint private ethReserve;
    uint private spcReserve;
    
    constructor(address spcToken) ERC20("ETH-SPC Liquidity Token", "EthSpcLP") {
        _pairAddress = address(this);
        _spcToken = IERC20(spcToken);
    }

    /**
     * @notice Adds liquidity (ETH, SPC) to the pool 
     * and mints out propotional LP tokens to specified LP provider address.
     * SPC tokens need to be transferred in before calling this method.
     */
    function addLiquidity(address lpProvider) external payable returns(uint ethAmt, uint spcAmt, uint liquidity) {
        /// gas cost optimization
        (uint _ethReserve, uint _spcReserve) = (ethReserve, spcReserve);
        
        /// Calculate ETH sent in by LP
        uint ethBalance = _pairAddress.balance;
        ethAmt = ethBalance - _ethReserve;
        require(ethAmt > 0, "EthSpcLiquidityPair: Not enough ETH");

        /// Calculate SPC tokens sent in by LP
        uint spcTokenBalance = _spcToken.balanceOf(_pairAddress);
        spcAmt = spcTokenBalance - _spcReserve;
        require(spcAmt > 0, "EthSpcLiquidityPair: Not enough SPC");

        uint totalSupply = totalSupply();
        if (totalSupply == 0) {
            /// first liquidity provider, so use special calculation for the new lp token amt
            liquidity = Math.sqrt(ethAmt * spcAmt) - MIN_LIQUIDITY;

            /// burn Min Liq Amt by minting it to SpaceToken
            _mint(address(_spcToken), 1000);
        }
        else {
            /// calculate the new lp token amt by using minimum value among pair
            uint liqPerEth = (ethAmt * totalSupply) / _ethReserve;
            uint liqPerSpc = (spcAmt * totalSupply) / _spcReserve;
            liquidity = Math.min(liqPerSpc, liqPerEth);
        }

        require(liquidity > 0, "EthSpcLiquidityPair: Insufficient liquidity added");
        
        /// update the reserves
        updateReserves();

        /// mint the lp tokens & transfer to the LP provider
        _mint(lpProvider, liquidity);

        emit LiquidityAdded(lpProvider, msg.value, spcAmt, liquidity);
    }

    /**
     * @notice Removes liquidity (ETH, SPC) from the pool.
     * It burns the specified LP tokens and
     * transfers propotional ETH & SPC tokens to the specified LP provider address.
     * LP tokens need to be transferred in before calling this method.
     */
    function removeLiquidity(address lpProvider) external nonReentrant returns (uint ethAmt, uint spcAmt) {
        uint liquidity = balanceOf(_pairAddress);
        require(liquidity > 0, "EthSpcLiquidityPair: Not enough liquidity");

        uint ethBalance = _pairAddress.balance;
        uint spcBalance = _spcToken.balanceOf(_pairAddress);
        uint totalSupply = totalSupply();
        ethAmt = (liquidity * ethBalance) / totalSupply;
        spcAmt = (liquidity * spcBalance) / totalSupply;
        require(ethAmt > 0 && spcAmt > 0, "EthSpcLiquidityPair: Insuffiecient liquidity burned");

        /// burn the LP tokens sent to this contract
        _burn(_pairAddress, liquidity);

        /// Transfer eth & spc amounts to lp provider
        require(_spcToken.transfer(lpProvider, spcAmt), "EthSpcLiquidityPair: SPC transfer failed");
        (bool success,) = lpProvider.call{value: ethAmt}("");
        require(success, "EthSpcLiquidityPair: Fail to transfer ETH");

        /// update the reserves
        updateReserves();

        emit LiquidityRemoved(lpProvider, ethAmt, spcAmt, liquidity);
    }

    /**
     * @notice Receives ETH in to the pool and transfers proportional SPC tokens out of the pool.
     */
    function swapInETH(address trader) external payable returns(uint spcAmtOut) {
        /// gas cost optimization
        (uint _ethReserve, uint _spcReserve) = (ethReserve, spcReserve);
        require(_ethReserve > 0 && _spcReserve > 0, "EthSpcLiquidityPair: No Liquidity");
        require(_pairAddress.balance > _ethReserve, "EthSpcLiquidityPair: Not enough ETH Provided");

        /// Calculate ETH amount in & SPC amount out
        uint ethAmtIn = _pairAddress.balance - _ethReserve;
        spcAmtOut = this.calculateAmountOut(ethAmtIn, _ethReserve, _spcReserve);
        require(spcAmtOut > 0, "EthSpcLiquidityPair: Insufficient SPC out");

        // Transfer SPC tokens to trader
        require(_spcToken.transfer(trader, spcAmtOut), "EthSpcLiquidityPair: Failed to transfer SPC");

        // update reserves
        updateReserves();
        
        emit ETHSwappedIn(trader, ethAmtIn, spcAmtOut);
    }

    /**
     * @notice Receives SPC tokens in to the pool and transfers proportional ETH out of the pool.
     * SPC tokens must transferred into the pool before calling this function.
     */
    function swapInSPC(address trader) external nonReentrant returns(uint ethAmtOut) {
        /// gas cost optimization
        (uint _ethReserve, uint _spcReserve) = (ethReserve, spcReserve);
        require(_ethReserve > 0 && _spcReserve > 0, "EthSpcLiquidityPair: No Liquidity");

        /// Calculate SPC amount in and ETH amount out
        uint spcAmtIn = _spcToken.balanceOf(_pairAddress) - _spcReserve;
        require(spcAmtIn > 0, "EthSpcLiquidityPair: Not enough SPC Provided");
        ethAmtOut = this.calculateAmountOut(spcAmtIn, _spcReserve, _ethReserve);
        require(ethAmtOut > 0, "EthSpcLiquidityPair: Insufficient ETH out");

        /// Transfer ETH to trader
        (bool success,) = trader.call{value: ethAmtOut}("");
        require(success, "EthSpcLiquidityPair: Fail to transfer ETH");

        // update reserves
        updateReserves();
        
        emit SPCSwappedIn(trader, spcAmtIn, ethAmtOut);
    }

    /**
     * Syncs ETH & SPC reserves to match the current balances of the contract.
     */
    function syncReserves() external {
        updateReserves();
    }

    /**
     * Provides current ETH and SPC reserve amount of the pool.
     */
    function getReserves() external view returns(uint _ethReserve, uint _spcReserve) {
        (_ethReserve, _spcReserve) = (ethReserve, spcReserve);
    }

    /**
     * Calculates amount out for specified amount in & reserve amounts after applying 1% trade fee
     * @param amtIn: amount being swapped in
     * @param amtInReserve: current reserve amount of asset being added to pool
     * @param amtOutReserve: current reserve amount of asset being taken out of pool
     */
    function calculateAmountOut(uint amtIn, uint amtInReserve, uint amtOutReserve) external pure returns(uint amtOut) {
        // Apply 1% trade fee to amount in
        uint amtInAfterFee = amtIn - ((amtIn * 1)/ 100);
        uint newAmtOutReserve = (amtInReserve * amtOutReserve) / (amtInReserve + amtInAfterFee);
        amtOut = amtOutReserve - newAmtOutReserve;
    } 

    /**
     * Updates current ETH and SPC reserve amounts of the pool.
     */
    function updateReserves() private {
        ethReserve = _pairAddress.balance;
        spcReserve = _spcToken.balanceOf(_pairAddress);
    }
}