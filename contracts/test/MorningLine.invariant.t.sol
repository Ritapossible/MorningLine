// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MorningLine} from "../contracts/MorningLine.sol";
import {LineToken} from "../contracts/LineToken.sol";
import {MockUSDC} from "./mocks/Mocks.sol";

/// @dev Drives random sequences of open / report / wait / reclaim across many deals.
contract Handler is Test {
    MorningLine public ml;
    MockUSDC public usdc;
    LineToken public line;
    address public checker = makeAddr("checker");
    address[3] public buyers = [makeAddr("b0"), makeAddr("b1"), makeAddr("b2")];
    address public payee = makeAddr("payee");

    uint256 public ghostPaid; // USDC sent to payees
    uint256 public ghostChecks; // reports made (fuel spent)

    constructor(MorningLine ml_, MockUSDC usdc_, LineToken line_) {
        ml = ml_;
        usdc = usdc_;
        line = line_;
        for (uint256 i = 0; i < 3; ++i) {
            usdc.mint(buyers[i], 1e15);
            vm.startPrank(buyers[i]);
            usdc.approve(address(ml), type(uint256).max);
            line.approve(address(ml), type(uint256).max);
            vm.stopPrank();
        }
    }

    function open(uint256 who, uint128 daily, uint16 n) external {
        address b = buyers[who % 3];
        daily = uint128(bound(daily, 1, 1_000e6));
        n = uint16(bound(n, 1, 10));
        if (line.balanceOf(b) < uint256(n) * ml.fuelPerCheck()) {
            vm.warp(block.timestamp + 1 days); // drip is once a day
            vm.prank(b);
            line.drip();
        }
        vm.prank(b);
        ml.openDeal(payee, checker, daily, n, uint40(block.timestamp), MorningLine.Spec("o/r", "main", "README.md", "x"));
    }

    function report(uint256 dealSeed, uint256 daySeed, bool present) external {
        uint256 count = ml.dealCount();
        if (count == 0) return;
        uint256 id = bound(dealSeed, 1, count);
        MorningLine.Deal memory d = ml.getDeal(id);
        uint256 day = bound(daySeed, 0, d.dayCount - 1);
        if (ml.dayStatus(id, day) != MorningLine.DayStatus.Open) return;
        (uint256 opens, uint256 closes) = ml.dayWindow(id, day);
        if (block.timestamp < opens || block.timestamp >= closes) return;
        vm.prank(checker);
        ml.report(id, day, present, present ? bytes20(uint160(1)) : bytes20(0));
        ghostChecks++;
        if (present) ghostPaid += d.dailyAmount;
    }

    function reclaim(uint256 dealSeed, uint256 daySeed) external {
        uint256 count = ml.dealCount();
        if (count == 0) return;
        uint256 id = bound(dealSeed, 1, count);
        MorningLine.Deal memory d = ml.getDeal(id);
        uint256 day = bound(daySeed, 0, d.dayCount - 1);
        if (ml.dayStatus(id, day) != MorningLine.DayStatus.Open) return;
        (, uint256 closes) = ml.dayWindow(id, day);
        if (block.timestamp < closes) return;
        uint256[] memory list = new uint256[](1);
        list[0] = day;
        vm.prank(d.buyer);
        ml.reclaim(id, list);
    }

    function wait(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 3 days));
    }

    /// @dev USDC the contract still owes: unsettled days of every deal.
    function owedUsdc() external view returns (uint256 sum) {
        for (uint256 id = 1; id <= ml.dealCount(); ++id) {
            MorningLine.Deal memory d = ml.getDeal(id);
            sum += uint256(d.dailyAmount) * (d.dayCount - d.settled);
        }
    }

    function owedFuel() external view returns (uint256 sum) {
        for (uint256 id = 1; id <= ml.dealCount(); ++id) {
            MorningLine.Deal memory d = ml.getDeal(id);
            sum += ml.fuelPerCheck() * (d.dayCount - d.settled);
        }
    }

    function settledMatchesStatuses() external view returns (bool) {
        for (uint256 id = 1; id <= ml.dealCount(); ++id) {
            MorningLine.Deal memory d = ml.getDeal(id);
            uint256 closed;
            for (uint256 day = 0; day < d.dayCount; ++day) {
                if (ml.dayStatus(id, day) != MorningLine.DayStatus.Open) closed++;
            }
            if (closed != d.settled) return false;
        }
        return true;
    }
}

contract MorningLineInvariantTest is Test {
    address constant SINK = 0x000000000000000000000000000000000000dEaD;
    MorningLine ml;
    MockUSDC usdc;
    LineToken line;
    Handler handler;

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        line = new LineToken();
        ml = new MorningLine(IERC20(address(usdc)), IERC20(address(line)), 1 ether, SINK, 1 days, 48 hours);
        handler = new Handler(ml, usdc, line);
        targetContract(address(handler));
    }

    /// The contract holds exactly what it still owes: never less (insolvent), never more (stuck).
    function invariant_usdcFullyBacked() public view {
        assertEq(usdc.balanceOf(address(ml)), handler.owedUsdc());
    }

    function invariant_fuelFullyBacked() public view {
        assertEq(line.balanceOf(address(ml)), handler.owedFuel());
    }

    /// Fuel leaves the contract only to the sink, one unit per report.
    function invariant_fuelSpentOnlyOnChecks() public view {
        assertEq(line.balanceOf(SINK), handler.ghostChecks() * 1 ether);
    }

    /// Payees received exactly the days that were reported present.
    function invariant_payeePaidOnlyForPresentDays() public view {
        assertEq(usdc.balanceOf(handler.payee()), handler.ghostPaid());
    }

    function invariant_settledCounterMatchesDays() public view {
        assertTrue(handler.settledMatchesStatuses());
    }
}
