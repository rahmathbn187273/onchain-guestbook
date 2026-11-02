// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Guestbook
/// @notice Anyone can post a short public message; messages are stored on-chain forever.
contract Guestbook {
    /// @dev Maximum message size in BYTES (UTF-8). Emojis/non-Latin chars use more than 1 byte.
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    struct Message {
        address author;    // wallet that posted the message
        string text;       // the message itself
        uint256 timestamp; // block time when it was posted
    }

    /// @dev All messages in posting order (index 0 = oldest).
    Message[] private messages;

    /// @notice Emitted every time a new message is posted.
    event MessagePosted(
        address indexed author,
        uint256 indexed id,
        string text,
        uint256 timestamp
    );

    /// @notice Post a new message to the guestbook.
    /// @param text The message (1 to 280 bytes).
    function postMessage(string calldata text) external {
        uint256 len = bytes(text).length;
        require(len > 0, "Message cannot be empty");
        require(len <= MAX_MESSAGE_LENGTH, "Message too long (max 280 bytes)");

        messages.push(Message(msg.sender, text, block.timestamp));

        emit MessagePosted(msg.sender, messages.length - 1, text, block.timestamp);
    }

    /// @notice Total number of messages posted so far.
    function messageCount() external view returns (uint256) {
        return messages.length;
    }

    /// @notice Get one message by its id (0 = first message ever posted).
    function getMessage(uint256 id) external view returns (Message memory) {
        require(id < messages.length, "Message does not exist");
        return messages[id];
    }

    /// @notice Get up to `limit` of the most recent messages, NEWEST FIRST.
    /// @param limit Maximum number of messages to return.
    function getRecentMessages(uint256 limit) external view returns (Message[] memory) {
        uint256 total = messages.length;
        uint256 n = limit < total ? limit : total;

        Message[] memory recent = new Message[](n);
        for (uint256 i = 0; i < n; i++) {
            recent[i] = messages[total - 1 - i];
        }
        return recent;
    }
}
