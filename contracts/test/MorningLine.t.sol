// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MorningLine} from "../contracts/MorningLine.sol";
import {LineToken} from "../contracts/LineToken.sol";
import {MockUSDC, FeeToken} from "./mocks/Mocks.sol";

contract MorningLineTest is Test {
    uint256 constant DAY = 1 days;
    uint256 constant GRACE = 48 hours;
    uint256 constant FUEL = 1 ether;
    address constant SINK = 0x000000000000000000000000000000000000dEaD;

    MorningLine ml;
    MockUSDC usdc;
    LineToken line;

    address buyer = makeAddr("buyer");
    address payee = makeAddr("payee");
    address checker = makeAddr("checker");
    address stranger = makeAddr("stranger");
    bytes20 constant SHA = bytes20(hex"3f2a9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        line = new LineToken();
        ml = new MorningLine(IERC20(address(usdc)), IERC20(address(line)), FUEL, SINK, DAY, GRACE);

        usdc.mint(buyer, 1_000_000e6);
        vm.startPrank(buyer);
        line.drip(); // 30 LINE
        usdc.approve(address(ml), type(uint256).max);
        line.approve(address(ml), type(uint256).max);
        vm.stopPrank();
    }

    function _spec() internal pure returns (MorningLine.Spec memory) {
        return MorningLine.Spec({
            repo: "Ritapossible/MorningLine",
            branch: "main",
            path: "README.md",
            line: "Sponsored by [Acme](https://acme.xyz)"
        });
    }

    function _open(uint128 daily, uint16 n) internal returns (uint256 id) {
        vm.prank(buyer);
        id = ml.openDeal(payee, checker, daily, n, uint40(block.timestamp), _spec());
    }

    // ------------------------------------------------------------ opening

    function test_open_locksUsdcAndFuel() public {
        uint256 id = _open(1e6, 3);
        assertEq(id, 1);
        assertEq(usdc.balanceOf(address(ml)), 3e6);
        assertEq(line.balanceOf(address(ml)), 3 * FUEL);
        MorningLine.Deal memory d = ml.getDeal(id);
        assertEq(d.buyer, buyer);
        assertEq(d.payee, payee);
        assertEq(d.checker, checker);
        assertEq(d.dayCount, 3);
        assertEq(d.specHash, ml.specHashOf(_spec()));
    }

    function test_open_rejectsBadInput() public {
        MorningLine.Spec memory s = _spec();
        uint40 t = uint40(block.timestamp);
        vm.startPrank(buyer);
        vm.expectRevert(MorningLine.ZeroAddress.selector);
        ml.openDeal(address(0), checker, 1e6, 3, t, s);
        vm.expectRevert(MorningLine.ZeroAddress.selector);
        ml.openDeal(payee, address(0), 1e6, 3, t, s);
        vm.expectRevert(MorningLine.BadAmount.selector);
        ml.openDeal(payee, checker, 0, 3, t, s);
        vm.expectRevert(MorningLine.BadDayCount.selector);
        ml.openDeal(payee, checker, 1e6, 0, t, s);
        vm.expectRevert(MorningLine.BadDayCount.selector);
        ml.openDeal(payee, checker, 1e6, 367, t, s);
        vm.expectRevert(MorningLine.BadStart.selector);
        ml.openDeal(payee, checker, 1e6, 3, t - 1, s);
        vm.expectRevert(MorningLine.BadStart.selector);
        ml.openDeal(payee, checker, 1e6, 3, uint40(block.timestamp + 366 days), s);
        s.line = "";
        vm.expectRevert(MorningLine.BadSpec.selector);
        ml.openDeal(payee, checker, 1e6, 3, t, s);
        vm.stopPrank();
    }

    function test_open_rejectsOversizedSpec() public {
        MorningLine.Spec memory s = _spec();
        s.line = string(new bytes(513));
        vm.prank(buyer);
        vm.expectRevert(MorningLine.BadSpec.selector);
        ml.openDeal(payee, checker, 1e6, 3, uint40(block.timestamp), s);
    }

    function test_open_rejectsFeeOnTransferToken() public {
        FeeToken fee = new FeeToken();
        MorningLine bad = new MorningLine(IERC20(address(fee)), IERC20(address(line)), FUEL, SINK, DAY, GRACE);
        fee.mint(buyer, 100e6);
        vm.startPrank(buyer);
        fee.approve(address(bad), type(uint256).max);
        line.approve(address(bad), type(uint256).max);
        vm.expectRevert(MorningLine.TransferShortfall.selector);
        bad.openDeal(payee, checker, 1e6, 3, uint40(block.timestamp), _spec());
        vm.stopPrank();
    }

    function test_open_withoutFuelReverts() public {
        address poor = makeAddr("poor");
        usdc.mint(poor, 10e6);
        vm.startPrank(poor);
        usdc.approve(address(ml), type(uint256).max);
        line.approve(address(ml), type(uint256).max);
        vm.expectRevert(); // no LINE: the deal cannot be armed
        ml.openDeal(payee, checker, 1e6, 3, uint40(block.timestamp), _spec());
        vm.stopPrank();
    }

    // ------------------------------------------------------------ reports

    function test_report_presentPaysPayeeAndSpendsFuel() public {
        uint256 id = _open(1e6, 3);
        vm.prank(checker);
        ml.report(id, 0, true, SHA);
        assertEq(usdc.balanceOf(payee), 1e6);
        assertEq(line.balanceOf(SINK), FUEL);
        assertEq(uint8(ml.dayStatus(id, 0)), uint8(MorningLine.DayStatus.Paid));
        assertEq(ml.getDeal(id).settled, 1);
    }

    function test_report_missingRefundsBuyer() public {
        uint256 id = _open(1e6, 3);
        uint256 before = usdc.balanceOf(buyer);
        vm.prank(checker);
        ml.report(id, 0, false, bytes20(0));
        assertEq(usdc.balanceOf(buyer), before + 1e6);
        assertEq(usdc.balanceOf(payee), 0);
        assertEq(uint8(ml.dayStatus(id, 0)), uint8(MorningLine.DayStatus.Refunded));
    }

    function test_report_onlyChecker() public {
        uint256 id = _open(1e6, 3);
        address[3] memory others = [buyer, payee, stranger];
        for (uint256 i = 0; i < 3; ++i) {
            vm.prank(others[i]);
            vm.expectRevert(MorningLine.NotChecker.selector);
            ml.report(id, 0, true, SHA);
        }
    }

    function test_report_onceperDay() public {
        uint256 id = _open(1e6, 3);
        vm.startPrank(checker);
        ml.report(id, 0, true, SHA);
        vm.expectRevert(MorningLine.AlreadySettled.selector);
        ml.report(id, 0, false, bytes20(0));
        vm.stopPrank();
    }

    function test_report_window() public {
        uint256 id = _open(1e6, 3);
        vm.startPrank(checker);
        // day 1 has not started yet
        vm.expectRevert(MorningLine.OutsideWindow.selector);
        ml.report(id, 1, true, SHA);
        // last second of day 0's window is accepted; the window closes at end + grace
        vm.warp(block.timestamp + DAY + GRACE - 1);
        ml.report(id, 0, true, SHA);
        vm.warp(block.timestamp + 1 + DAY); // now past day 1's close too
        vm.expectRevert(MorningLine.OutsideWindow.selector);
        ml.report(id, 1, true, SHA);
        vm.stopPrank();
    }

    function test_report_presentNeedsCommit() public {
        uint256 id = _open(1e6, 3);
        vm.prank(checker);
        vm.expectRevert(MorningLine.MissingCommit.selector);
        ml.report(id, 0, true, bytes20(0));
    }

    function test_report_badDayAndUnknownDeal() public {
        uint256 id = _open(1e6, 3);
        vm.startPrank(checker);
        vm.expectRevert(MorningLine.BadDay.selector);
        ml.report(id, 3, true, SHA);
        vm.expectRevert(MorningLine.UnknownDeal.selector);
        ml.report(99, 0, true, SHA);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ reclaim

    function test_reclaim_afterSilence() public {
        uint256 id = _open(1e6, 3);
        uint256 usdcBefore = usdc.balanceOf(buyer);
        uint256 fuelBefore = line.balanceOf(buyer);
        vm.warp(block.timestamp + 3 * DAY + GRACE);
        uint256[] memory all = new uint256[](3);
        (all[0], all[1], all[2]) = (0, 1, 2);
        vm.prank(buyer);
        ml.reclaim(id, all);
        assertEq(usdc.balanceOf(buyer), usdcBefore + 3e6);
        assertEq(line.balanceOf(buyer), fuelBefore + 3 * FUEL);
        assertEq(usdc.balanceOf(address(ml)), 0);
        assertEq(line.balanceOf(address(ml)), 0);
        assertEq(ml.getDeal(id).settled, 3);
    }

    function test_reclaim_notBeforeWindowCloses() public {
        uint256 id = _open(1e6, 3);
        vm.warp(block.timestamp + DAY + GRACE - 1);
        uint256[] memory d0 = new uint256[](1);
        vm.prank(buyer);
        vm.expectRevert(MorningLine.OutsideWindow.selector);
        ml.reclaim(id, d0);
    }

    function test_reclaim_onlyBuyer_andNoDoubleSettle() public {
        uint256 id = _open(1e6, 3);
        vm.prank(checker);
        ml.report(id, 0, true, SHA);
        vm.warp(block.timestamp + 3 * DAY + GRACE);
        uint256[] memory list = new uint256[](1);

        vm.prank(stranger);
        vm.expectRevert(MorningLine.NotBuyer.selector);
        ml.reclaim(id, list);

        vm.prank(buyer); // day 0 was already paid
        vm.expectRevert(MorningLine.AlreadySettled.selector);
        ml.reclaim(id, list);

        uint256[] memory dup = new uint256[](2);
        (dup[0], dup[1]) = (1, 1);
        vm.prank(buyer);
        vm.expectRevert(MorningLine.AlreadySettled.selector);
        ml.reclaim(id, dup);

        uint256[] memory empty = new uint256[](0);
        vm.prank(buyer);
        vm.expectRevert(MorningLine.NothingToReclaim.selector);
        ml.reclaim(id, empty);
    }

    function test_checkerCannotReportAfterReclaim() public {
        uint256 id = _open(1e6, 1);
        vm.warp(block.timestamp + DAY + GRACE);
        uint256[] memory d0 = new uint256[](1);
        vm.prank(buyer);
        ml.reclaim(id, d0);
        vm.prank(checker);
        vm.expectRevert(MorningLine.AlreadySettled.selector);
        ml.report(id, 0, true, SHA);
    }

    // --------------------------------------------------- the demo, end to end

    function test_demo_presentMissingSilent() public {
        uint256 id = _open(1e6, 3);
        uint256 buyerStart = usdc.balanceOf(buyer);

        vm.prank(checker); // day 0: the line is there
        ml.report(id, 0, true, SHA);

        vm.warp(block.timestamp + DAY); // day 1: the line was deleted
        vm.prank(checker);
        ml.report(id, 1, false, bytes20(hex"9c1e000000000000000000000000000000000000"));

        vm.warp(block.timestamp + 2 * DAY + GRACE); // day 2: the checker went quiet
        uint256[] memory d2 = new uint256[](1);
        d2[0] = 2;
        vm.prank(buyer);
        ml.reclaim(id, d2);

        assertEq(usdc.balanceOf(payee), 1e6);
        assertEq(usdc.balanceOf(buyer), buyerStart + 2e6);
        assertEq(usdc.balanceOf(address(ml)), 0);
        assertEq(line.balanceOf(SINK), 2 * FUEL); // two checks ran, one day was never checked
    }

    // -------------------------------------------------------------- fuzz

    /// @notice Whatever happens to each day, every dollar ends with the payee or the buyer, and fuel is spent only on checks.
    function testFuzz_conservation(uint128 daily, uint16 n, uint256 seed) public {
        daily = uint128(bound(daily, 1, 1_000e6));
        n = uint16(bound(n, 1, 20));
        uint256 id = _open(daily, n);
        uint256 buyerStart = usdc.balanceOf(buyer) + uint256(daily) * n;

        uint256 paid;
        uint256 checks;
        uint256[] memory silent = new uint256[](n);
        uint256 silentCount;
        for (uint256 day = 0; day < n; ++day) {
            vm.warp(uint256(ml.getDeal(id).start) + day * DAY + 1);
            uint256 r = uint256(keccak256(abi.encode(seed, day))) % 3;
            if (r == 2) {
                silent[silentCount++] = day;
                continue;
            }
            vm.prank(checker);
            ml.report(id, day, r == 0, r == 0 ? SHA : bytes20(0));
            checks++;
            if (r == 0) paid++;
        }
        vm.warp(uint256(ml.getDeal(id).start) + uint256(n) * DAY + GRACE);
        if (silentCount > 0) {
            uint256[] memory list = new uint256[](silentCount);
            for (uint256 i = 0; i < silentCount; ++i) list[i] = silent[i];
            vm.prank(buyer);
            ml.reclaim(id, list);
        }

        assertEq(usdc.balanceOf(payee), paid * daily);
        assertEq(usdc.balanceOf(buyer), buyerStart - paid * daily);
        assertEq(usdc.balanceOf(address(ml)), 0);
        assertEq(line.balanceOf(SINK), checks * FUEL);
        assertEq(line.balanceOf(address(ml)), 0);
        assertEq(ml.getDeal(id).settled, n);
    }

    // ------------------------------------------------------------- token

    function test_drip_oncePerDay() public {
        vm.prank(stranger);
        line.drip();
        assertEq(line.balanceOf(stranger), 30 ether);
        vm.prank(stranger);
        vm.expectRevert();
        line.drip();
        vm.warp(block.timestamp + 1 days);
        vm.prank(stranger);
        line.drip();
        assertEq(line.balanceOf(stranger), 60 ether);
    }
}
