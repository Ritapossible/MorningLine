// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DemoUSDC
/// @notice A 6-decimal stand-in for USDC, used only by the demo deployment on Base Sepolia so a
/// stranger can open a deal without waiting on an external testnet faucet. Anyone can take a free
/// daily drip. It is worth nothing and has no owner. The production deployment uses real USDC.
contract DemoUSDC is ERC20 {
    uint256 public constant DRIP_AMOUNT = 100e6;
    uint256 public constant DRIP_INTERVAL = 1 days;

    mapping(address account => uint256 nextDrip) public nextDripAt;

    error DripTooSoon(uint256 nextDrip);

    constructor() ERC20("Demo USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint `DRIP_AMOUNT` to the caller, at most once per `DRIP_INTERVAL`.
    function drip() external {
        uint256 next = nextDripAt[msg.sender];
        if (block.timestamp < next) revert DripTooSoon(next);
        nextDripAt[msg.sender] = block.timestamp + DRIP_INTERVAL;
        _mint(msg.sender, DRIP_AMOUNT);
    }
}
