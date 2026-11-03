// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MorningLine
/// @notice Escrow that pays for a sponsor line in a GitHub file one day at a time.
///
/// A buyer locks `dailyAmount * dayCount` USDC plus one unit of fuel per day. Each day the
/// deal's checker reports whether the exact line was present in the pinned file at the
/// latest commit of the pinned branch, together with that commit's SHA. A present day pays
/// the payee; a missing day refunds the buyer. Every report spends one unit of fuel. If a
/// day is not reported within `reportGrace` after it ends, the buyer can reclaim it.
///
/// There is no owner, no upgrade path and no admin function. The checker of a deal is fixed
/// when the deal is opened and can only choose, per day, between paying the payee and
/// refunding the buyer: no code path sends a deal's funds anywhere else.
contract MorningLine is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum DayStatus {
        Open,
        Paid,
        Refunded
    }

    struct Deal {
        address buyer;
        uint40 start;
        uint16 dayCount;
        uint16 settled;
        address payee;
        address checker;
        uint128 dailyAmount;
        bytes32 specHash;
    }

    /// @notice What must be present: the exact `line` in `path`, at the latest commit of `branch` in `repo`.
    struct Spec {
        string repo; // "owner/name"
        string branch;
        string path;
        string line;
    }

    uint256 public constant MAX_DAYS = 366;
    uint256 public constant MAX_FIELD_BYTES = 512;
    uint256 public constant MAX_START_DELAY = 365 days;

    IERC20 public immutable usdc;
    IERC20 public immutable fuelToken;
    uint256 public immutable fuelPerCheck;
    address public immutable fuelSink;
    uint256 public immutable dayLength;
    uint256 public immutable reportGrace;

    uint256 public dealCount;
    mapping(uint256 dealId => Deal) private _deals;
    mapping(uint256 dealId => mapping(uint256 day => DayStatus)) private _status;

    event DealOpened(
        uint256 indexed dealId,
        address indexed buyer,
        address indexed payee,
        address checker,
        uint128 dailyAmount,
        uint16 dayCount,
        uint40 start,
        bytes32 specHash
    );
    event DealSpec(uint256 indexed dealId, string repo, string branch, string path, string line);
    event DayReported(uint256 indexed dealId, uint256 indexed day, bool present, bytes20 commitSha);
    event DayReclaimed(uint256 indexed dealId, uint256 indexed day);

    error ZeroAddress();
    error BadConfig();
    error BadAmount();
    error BadDayCount();
    error BadStart();
    error BadSpec();
    error UnknownDeal();
    error NotChecker();
    error NotBuyer();
    error BadDay();
    error AlreadySettled();
    error OutsideWindow();
    error MissingCommit();
    error TransferShortfall();
    error NothingToReclaim();

    constructor(
        IERC20 usdc_,
        IERC20 fuelToken_,
        uint256 fuelPerCheck_,
        address fuelSink_,
        uint256 dayLength_,
        uint256 reportGrace_
    ) {
        if (address(usdc_) == address(0) || address(fuelToken_) == address(0) || fuelSink_ == address(0)) {
            revert ZeroAddress();
        }
        if (fuelPerCheck_ == 0 || dayLength_ == 0 || reportGrace_ == 0) revert BadConfig();
        usdc = usdc_;
        fuelToken = fuelToken_;
        fuelPerCheck = fuelPerCheck_;
        fuelSink = fuelSink_;
        dayLength = dayLength_;
        reportGrace = reportGrace_;
    }

    // ---------------------------------------------------------------- buyer

    /// @notice Lock USDC and fuel for a deal. The caller is the buyer.
    /// @param start When day 0 begins. Must not be in the past.
    function openDeal(
        address payee,
        address checker,
        uint128 dailyAmount,
        uint16 dayCount,
        uint40 start,
        Spec calldata spec
    ) external nonReentrant returns (uint256 dealId) {
        if (payee == address(0) || checker == address(0)) revert ZeroAddress();
        if (dailyAmount == 0) revert BadAmount();
        if (dayCount == 0 || dayCount > MAX_DAYS) revert BadDayCount();
        if (start < block.timestamp || start > block.timestamp + MAX_START_DELAY) revert BadStart();
        _checkField(spec.repo);
        _checkField(spec.branch);
        _checkField(spec.path);
        _checkField(spec.line);

        bytes32 specHash = keccak256(abi.encode(spec.repo, spec.branch, spec.path, spec.line));
        dealId = ++dealCount;
        _deals[dealId] = Deal({
            buyer: msg.sender,
            start: start,
            dayCount: dayCount,
            settled: 0,
            payee: payee,
            checker: checker,
            dailyAmount: dailyAmount,
            specHash: specHash
        });

        _pullExact(usdc, uint256(dailyAmount) * dayCount);
        _pullExact(fuelToken, fuelPerCheck * dayCount);

        emit DealOpened(dealId, msg.sender, payee, checker, dailyAmount, dayCount, start, specHash);
        emit DealSpec(dealId, spec.repo, spec.branch, spec.path, spec.line);
    }

    /// @notice Refund days whose report window closed without a report, with their unused fuel.
    function reclaim(uint256 dealId, uint256[] calldata dayList) external nonReentrant {
        Deal storage d = _existing(dealId);
        if (msg.sender != d.buyer) revert NotBuyer();
        uint256 n = dayList.length;
        if (n == 0) revert NothingToReclaim();

        for (uint256 i = 0; i < n; ++i) {
            uint256 day = dayList[i];
            if (day >= d.dayCount) revert BadDay();
            if (_status[dealId][day] != DayStatus.Open) revert AlreadySettled();
            (, uint256 closes) = _window(d, day);
            if (block.timestamp < closes) revert OutsideWindow();
            _status[dealId][day] = DayStatus.Refunded;
            emit DayReclaimed(dealId, day);
        }
        d.settled += uint16(n);

        usdc.safeTransfer(d.buyer, uint256(d.dailyAmount) * n);
        fuelToken.safeTransfer(d.buyer, fuelPerCheck * n);
    }

    // -------------------------------------------------------------- checker

    /// @notice Settle one day. Present pays the payee; missing refunds the buyer. Spends one fuel.
    /// @param commitSha The commit the check read. Required when `present` is true.
    function report(uint256 dealId, uint256 day, bool present, bytes20 commitSha) external nonReentrant {
        Deal storage d = _existing(dealId);
        if (msg.sender != d.checker) revert NotChecker();
        if (day >= d.dayCount) revert BadDay();
        if (_status[dealId][day] != DayStatus.Open) revert AlreadySettled();
        (uint256 opens, uint256 closes) = _window(d, day);
        if (block.timestamp < opens || block.timestamp >= closes) revert OutsideWindow();
        if (present && commitSha == bytes20(0)) revert MissingCommit();

        _status[dealId][day] = present ? DayStatus.Paid : DayStatus.Refunded;
        d.settled += 1;

        fuelToken.safeTransfer(fuelSink, fuelPerCheck);
        usdc.safeTransfer(present ? d.payee : d.buyer, d.dailyAmount);

        emit DayReported(dealId, day, present, commitSha);
    }

    // ---------------------------------------------------------------- views

    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return _deals[dealId];
    }

    function dayStatus(uint256 dealId, uint256 day) external view returns (DayStatus) {
        return _status[dealId][day];
    }

    /// @notice `[opens, closes)`: when a report for `day` is accepted. Reclaim is possible from `closes`.
    function dayWindow(uint256 dealId, uint256 day) external view returns (uint256 opens, uint256 closes) {
        Deal storage d = _existing(dealId);
        if (day >= d.dayCount) revert BadDay();
        return _window(d, day);
    }

    function specHashOf(Spec calldata spec) external pure returns (bytes32) {
        return keccak256(abi.encode(spec.repo, spec.branch, spec.path, spec.line));
    }

    // ------------------------------------------------------------- internal

    function _existing(uint256 dealId) private view returns (Deal storage d) {
        d = _deals[dealId];
        if (d.buyer == address(0)) revert UnknownDeal();
    }

    function _window(Deal storage d, uint256 day) private view returns (uint256 opens, uint256 closes) {
        opens = uint256(d.start) + day * dayLength;
        closes = opens + dayLength + reportGrace;
    }

    function _checkField(string calldata s) private pure {
        uint256 len = bytes(s).length;
        if (len == 0 || len > MAX_FIELD_BYTES) revert BadSpec();
    }

    /// @dev Reject tokens that deliver less than requested (fee-on-transfer), so every deal is fully backed.
    function _pullExact(IERC20 token, uint256 amount) private {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert TransferShortfall();
    }
}
