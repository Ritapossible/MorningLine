// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title LineToken (LINE)
/// @notice Fuel for MorningLine checks during the hackathon: every daily check spends one LINE.
/// Anyone can take a free daily drip. It is never sold and has no owner. If Morning Line raises
/// on Vibestarter, the next MorningLine deployment points its fuel at the project's own token.
contract LineToken is ERC20 {
    uint256 public constant DRIP_AMOUNT = 30 ether;
    uint256 public constant DRIP_INTERVAL = 1 days;

    mapping(address account => uint256 nextDrip) public nextDripAt;

    error DripTooSoon(uint256 nextDrip);

    constructor() ERC20("Morning Line Fuel", "LINE") {}

    /// @notice Mint `DRIP_AMOUNT` LINE to the caller, at most once per `DRIP_INTERVAL`.
    function drip() external {
        uint256 next = nextDripAt[msg.sender];
        if (block.timestamp < next) revert DripTooSoon(next);
        nextDripAt[msg.sender] = block.timestamp + DRIP_INTERVAL;
        _mint(msg.sender, DRIP_AMOUNT);
    }
}
