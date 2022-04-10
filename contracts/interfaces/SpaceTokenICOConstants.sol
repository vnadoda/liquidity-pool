// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.8;

/**
 * @notice CollectorDAO constants/structs/events
 */
abstract contract SpaceTokenICOConstants {
    /// @dev Max total suppy for SPC token in lowest denomination - equivalent to wei
    uint public constant MAX_TOKEN_SUPPLY = 500000 * (10 ** 18);

    /// @dev 2% tax on every SPC transfer put into a treasury when isTaxInEffect is true
    uint public constant TRANSFER_TAX_PERCENTAGE = 2;

    /// @dev This contract aims to raise 30,000 Ether by performing an ICO
    uint public constant MAX_TOTAL_INVESTMENT = 30000 ether;

    /// @dev Seed phase has maximum total private contribution limit of 15,000 Ether
    uint public constant MAX_TOTAL_SEED_INVESTMENT = 15000 ether;

    /// @dev An individual seed contribution limit of 1,500 Ether
    uint public constant MAX_SEED_INVESTMENT = 1500 ether;

    /// @dev An individual general contribution limit of 1,000 Ether
    uint public constant MAX_GENERAL_INVESTMENT = 1000 ether;

    /// @dev ETH to SPC conversion rate
    uint public constant ETH_TO_SPC_CONVERSION = 5;

    /// @dev Total SPC available for ICO
    uint public constant ICO_SPC_AMOUNT = MAX_TOTAL_INVESTMENT * ETH_TO_SPC_CONVERSION;

    /// @dev Treasury holding of SPC tokens in lowest denomination - equivalent to wei
    uint internal constant SPC_TREASURY_AMT = (MAX_TOKEN_SUPPLY - (ICO_SPC_AMOUNT));

    /// @notice An enum for various phases of the ICO.
    /// ICO moves from phase seed -> general -> open
    /// Contract owner can move a phase forwards, but not backwards at any time.
    enum Phase {
        Seed,
        General,
        Open
    }
}