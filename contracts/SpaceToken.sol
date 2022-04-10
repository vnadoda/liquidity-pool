// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.8;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/SpaceTokenICOConstants.sol";

contract SpaceToken is SpaceTokenICOConstants, ERC20Capped, Ownable {
    /// @dev treasury account managing the tokens
    address private immutable _treasuryAccount;

    /// @dev SpaceTokenICO contract address
    address private _icoAddress;

    /// @notice flag to track whether transfer shoud be taxed or not.
    ///         Owner can update this flag at anytime
    bool public isTaxInEffect = false;

    constructor(address treasuryAccount_, address icoAddress_) 
        ERC20("Space Token", "SPC") 
        ERC20Capped(MAX_TOKEN_SUPPLY) 
    {
        _treasuryAccount = treasuryAccount_;
        _icoAddress = icoAddress_;

        /// mint non-ICO SPC to treasury
        super._mint(_treasuryAccount, SPC_TREASURY_AMT);

        /// mint remaining SPC to ICO address
        super._mint(_icoAddress, ICO_SPC_AMOUNT);
    }

    /**
     * @notice An owner can update a flag that toggles 2% tax on/off
     */
    function updateTaxFlag(bool tax) external onlyOwner {
        isTaxInEffect = tax;
    }

    /**
     * @dev Overriding transfer to add taxing logic.
     * A 2% tax on every transfer that gets put into a treasury account, when tax flag is ON.
     */
    function _transfer(address from, address to, uint256 amount) internal virtual override {
        uint amtToTransfer = amount;

        /// Only apply tax when it is in effect and 
        /// transfer is not done by SpaceTokn ICO contract
        if (isTaxInEffect && from != _icoAddress) {
            /// transfer tax to treasury
            uint tax = (amount * TRANSFER_TAX_PERCENTAGE) / 100;
            super._transfer(from, _treasuryAccount, tax);
            amtToTransfer = amount - tax;
        }
        
        super._transfer(from, to, amtToTransfer);
    }
}