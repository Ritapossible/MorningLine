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
/// latest commit of the pinned branch, together with that commit's SHA and a hash of the file
/// it read. A present day pays the payee; a missing day refunds the buyer. Every report spends
/// one unit of fuel. If a day is not reported within `reportGrace` after it ends, the buyer
/// can reclaim it.
///
/// A deal can change length, never terms:
/// - the buyer can cancel, which ends the deal after the days already started plus
///   `cancelNotice` more, so a payee who added the line is never cut off without notice;
/// - the payee can release, which ends the deal after the days already started;
/// - the buyer can extend a running deal by more days at the same price.
/// Days removed by cancel or release are refunded to the buyer with their fuel, at once.
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

    uint256 public constant VERSION = 2;
    uint256 public constant MAX_DAYS = 366;
    uint256 public constant MAX_FIELD_BYTES = 512;
    uint256 public constant MAX_START_DELAY = 365 days;

    IERC20 public immutable usdc;
    IERC20 public immutable fuelToken;
    uint256 public immutable fuelPerCheck;
    address public immutable fuelSink;
    uint256 public immutable dayLength;
    uint256 public immutable reportGrace;
    /// @notice Days that still run after a buyer cancels, counted from the first day not yet started.
    uint256 public immutable cancelNotice;

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
    /// @param fileHash keccak256 of the raw file the check read; zero if the file was not there.
    event DayReported(uint256 indexed dealId, uint256 indexed day, bool present, bytes20 commitSha, bytes32 fileHash);
    event DayReclaimed(uint256 indexed dealId, uint256 indexed day);
    /// @notice The deal now ends after `newDayCount` days; `refunded` days went back to the buyer.
    event DealShortened(uint256 indexed dealId, address indexed by, uint16 oldDayCount, uint16 newDayCount, uint256 refunded);
    event DealExtended(uint256 indexed dealId, uint16 oldDayCount, uint16 newDayCount);

    error ZeroAddress();
    error BadConfig();
    error BadAmount();
    error BadDayCount();
    error BadStart();
    error BadSpec();
    error UnknownDeal();
    error NotChecker();
    error NotBuyer();
    error NotPayee();
    error BadDay();
    error AlreadySettled();
    error OutsideWindow();
    error MissingCommit();
    error TransferShortfall();
    error NothingToReclaim();
    error NothingToShorten();
    error DealEnded();

    constructor(
        IERC20 usdc_,
        IERC20 fuelToken_,
        uint256 fuelPerCheck_,
        address fuelSink_,
        uint256 dayLength_,
        uint256 reportGrace_,
        uint256 cancelNotice_
    ) {
        if (address(usdc_) == address(0) || address(fuelToken_) == address(0) || fuelSink_ == address(0)) {
            revert ZeroAddress();
        }
        if (fuelPerCheck_ == 0 || dayLength_ == 0 || reportGrace_ == 0 || cancelNotice_ == 0) revert BadConfig();
        usdc = usdc_;
        fuelToken = fuelToken_;
        fuelPerCheck = fuelPerCheck_;
        fuelSink = fuelSink_;
        dayLength = dayLength_;
        reportGrace = reportGrace_;
        cancelNotice = cancelNotice_;
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

    /// @notice End the deal early. Days already started still run, plus `cancelNotice` more; every
    /// later day is refunded now with its fuel.
    function cancel(uint256 dealId) external nonReentrant {
        Deal storage d = _existing(dealId);
        if (msg.sender != d.buyer) revert NotBuyer();
        _shorten(dealId, d, _started(d) + cancelNotice);
    }

    /// @notice The payee ends the deal: days already started still run; every later day is
    /// refunded to the buyer now with its fuel.
    function release(uint256 dealId) external nonReentrant {
        Deal storage d = _existing(dealId);
        if (msg.sender != d.payee) revert NotPayee();
        _shorten(dealId, d, _started(d));
    }

    /// @notice Add days to a running deal at the same price. The new days follow the last one.
    function extend(uint256 dealId, uint16 extraDays) external nonReentrant {
        Deal storage d = _existing(dealId);
        if (msg.sender != d.buyer) revert NotBuyer();
        if (extraDays == 0) revert BadDayCount();
        // Only while the last day has not ended, so new days never start in the past.
        if (block.timestamp >= uint256(d.start) + uint256(d.dayCount) * dayLength) revert DealEnded();
        uint256 newCount = uint256(d.dayCount) + extraDays;
        if (newCount > MAX_DAYS) revert BadDayCount();

        uint16 old = d.dayCount;
        d.dayCount = uint16(newCount);
        _pullExact(usdc, uint256(d.dailyAmount) * extraDays);
        _pullExact(fuelToken, fuelPerCheck * extraDays);
        emit DealExtended(dealId, old, uint16(newCount));
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
    /// @param fileHash keccak256 of the raw file read at that commit; zero if it was not there.
    function report(uint256 dealId, uint256 day, bool present, bytes20 commitSha, bytes32 fileHash)
        external
        nonReentrant
    {
        Deal storage d = _existing(dealId);
        if (msg.sender != d.checker) revert NotChecker();
        if (day >= d.dayCount) revert BadDay();
        if (_status[dealId][day] != DayStatus.Open) revert AlreadySettled();
        (uint256 opens, uint256 closes) = _window(d, day);
        if (block.timestamp < opens || block.timestamp >= closes) revert OutsideWindow();
        if (present && (commitSha == bytes20(0) || fileHash == bytes32(0))) revert MissingCommit();

        _status[dealId][day] = present ? DayStatus.Paid : DayStatus.Refunded;
        d.settled += 1;

        fuelToken.safeTransfer(fuelSink, fuelPerCheck);
        usdc.safeTransfer(present ? d.payee : d.buyer, d.dailyAmount);

        emit DayReported(dealId, day, present, commitSha, fileHash);
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

    /// @notice How many days have started (opened) so far. These can no longer be removed.
    function daysStarted(uint256 dealId) external view returns (uint256) {
        return _started(_existing(dealId));
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

    /// @dev Days whose window has opened, capped at the deal's length. A day can only be settled
    /// once it has opened, so every settled day is below this count: shortening a deal to it or
    /// beyond never removes a settled day.
    function _started(Deal storage d) private view returns (uint256) {
        if (block.timestamp < d.start) return 0;
        uint256 n = (block.timestamp - d.start) / dayLength + 1;
        return n < d.dayCount ? n : d.dayCount;
    }

    /// @dev End the deal after `newCount` days, refunding every removed day with its fuel.
    function _shorten(uint256 dealId, Deal storage d, uint256 newCount) private {
        uint16 old = d.dayCount;
        if (newCount >= old) revert NothingToShorten();
        uint256 removed = old - newCount;
        d.dayCount = uint16(newCount);

        usdc.safeTransfer(d.buyer, uint256(d.dailyAmount) * removed);
        fuelToken.safeTransfer(d.buyer, fuelPerCheck * removed);
        emit DealShortened(dealId, msg.sender, old, uint16(newCount), removed);
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
